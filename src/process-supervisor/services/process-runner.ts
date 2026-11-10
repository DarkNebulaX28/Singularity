import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import treeKill from 'tree-kill';
import pidusage from 'pidusage';
import type { ServerInstance } from '../../servers/models/server-instance.js';
import type {
  ConnectedPlayer,
  PlayerEvent,
  ProcessMetrics,
  ProcessState,
  StartProcessOptions
} from '../models/process-state.js';
import { ConsoleBuffer } from './console-buffer.js';
import { CrashAnalyzer } from '../crash-analyzer/crash-analyzer.js';

const AUTO_RESTART_DELAY_MS = 5000;
const AUTO_RESTART_WINDOW_MS = 5 * 60 * 1000;
const MAX_AUTO_RESTARTS = 3;

function killProcessTree(pid: number, signal: string = 'SIGTERM'): Promise<void> {
  return new Promise((resolve) => {
    treeKill(pid, signal, () => {
      resolve();
    });
  });
}

export class ProcessRunner extends EventEmitter {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly states = new Map<string, ProcessState>();
  private readonly buffers = new Map<string, ConsoleBuffer>();
  private readonly activePlayers = new Map<string, ConnectedPlayer[]>();
  private readonly crashRestartCounts = new Map<string, { count: number; firstCrashAt: number }>();
  private readonly autoRestartTimers = new Map<string, NodeJS.Timeout>();
  private readonly crashAnalyzer: CrashAnalyzer;

  constructor(crashAnalyzer?: CrashAnalyzer) {
    super();
    this.crashAnalyzer = crashAnalyzer ?? new CrashAnalyzer();
  }

  detectPlayerEvent(logLine: string): PlayerEvent | null {
    const joinMatch = logLine.match(/\[.*(?:INFO|Server thread\/INFO)\]:\s*(\w+)\s+joined the game/i);
    if (joinMatch && joinMatch[1]) {
      return {
        type: 'join',
        username: joinMatch[1]
      };
    }

    const leaveMatch = logLine.match(/\[.*(?:INFO|Server thread\/INFO)\]:\s*(\w+)\s+left the game/i);
    if (leaveMatch && leaveMatch[1]) {
      return {
        type: 'leave',
        username: leaveMatch[1]
      };
    }

    return null;
  }

  async startProcess(
    instance: ServerInstance,
    options: StartProcessOptions
  ): Promise<ProcessState> {
    if (this.processes.has(instance.id)) {
      throw new Error(`El servidor '${instance.id}' ya tiene un proceso activo en ejecución.`);
    }

    const pendingTimer = this.autoRestartTimers.get(instance.id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.autoRestartTimers.delete(instance.id);
    }

    const child = spawn(options.executable, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const pid = child.pid ?? 0;
    const now = new Date().toISOString();

    const state: ProcessState = {
      instanceId: instance.id,
      pid,
      status: 'starting',
      startedAt: now,
      exitCode: null
    };

    const buffer = this.buffers.get(instance.id) ?? new ConsoleBuffer(2000);
    this.processes.set(instance.id, child);
    this.states.set(instance.id, state);
    this.buffers.set(instance.id, buffer);
    this.activePlayers.set(instance.id, []);

    this.emit('status-change', { instanceId: instance.id, status: 'starting' });

    // Handle stdout
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      buffer.push(text);

      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      for (const line of lines) {
        this.emit('console-line', { instanceId: instance.id, line });

        // Check if server is ready ("Done (X.Xs)!")
        if (/Done \(\d+\.\d+s\)!/i.test(line)) {
          state.status = 'online';
          this.crashRestartCounts.delete(instance.id);
          this.emit('status-change', { instanceId: instance.id, status: 'online' });
        }

        // Check for player joins / leaves
        const playerEvent = this.detectPlayerEvent(line);
        if (playerEvent) {
          const currentPlayers = this.activePlayers.get(instance.id) ?? [];
          if (playerEvent.type === 'join') {
            const updated = [
              ...currentPlayers.filter((p) => p.username !== playerEvent.username),
              { username: playerEvent.username, joinedAt: new Date().toISOString() }
            ];
            this.activePlayers.set(instance.id, updated);
          } else if (playerEvent.type === 'leave') {
            const updated = currentPlayers.filter((p) => p.username !== playerEvent.username);
            this.activePlayers.set(instance.id, updated);
          }
          this.emit('player-event', { instanceId: instance.id, event: playerEvent });
        }

        // Check for crash patterns
        const diagnostic = this.crashAnalyzer.analyze(line);
        if (diagnostic) {
          this.emit('crash-detected', { instanceId: instance.id, diagnostic });
        }
      }
    });

    // Handle stderr
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      buffer.push(text);

      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      for (const line of lines) {
        this.emit('console-line', { instanceId: instance.id, line });

        const diagnostic = this.crashAnalyzer.analyze(line);
        if (diagnostic) {
          this.emit('crash-detected', { instanceId: instance.id, diagnostic });
        }
      }
    });

    // Handle process exit
    child.on('exit', (code) => {
      const wasStopping = state.status === 'stopping';
      state.exitCode = code;
      state.status = code === 0 || wasStopping ? 'offline' : 'crashed';
      this.activePlayers.delete(instance.id);

      // Perform a final check of the whole buffer for crashes if exit was non-zero
      if (code !== 0 && !wasStopping) {
        const fullLogs = buffer.getLines().join('\n');
        const diagnostic = this.crashAnalyzer.analyze(fullLogs);
        if (diagnostic) {
          this.emit('crash-detected', { instanceId: instance.id, diagnostic });
        }
      }

      this.processes.delete(instance.id);
      this.emit('status-change', { instanceId: instance.id, status: state.status });

      // Automatic crash recovery if autoRestart is enabled
      if (state.status === 'crashed' && instance.autoRestart) {
        const nowMs = Date.now();
        const tracker = this.crashRestartCounts.get(instance.id);
        let nextCount = 1;
        let firstCrashAt = nowMs;

        if (tracker && nowMs - tracker.firstCrashAt < AUTO_RESTART_WINDOW_MS) {
          nextCount = tracker.count + 1;
          firstCrashAt = tracker.firstCrashAt;
        }

        this.crashRestartCounts.set(instance.id, { count: nextCount, firstCrashAt });

        if (nextCount <= MAX_AUTO_RESTARTS) {
          const msg = `[Singularity] Auto-Restart activo: Reiniciando servidor tras caída en ${AUTO_RESTART_DELAY_MS / 1000}s (Intento ${nextCount}/${MAX_AUTO_RESTARTS})...`;
          buffer.push(msg + '\n');
          this.emit('console-line', { instanceId: instance.id, line: msg });

          const timer = setTimeout(() => {
            this.autoRestartTimers.delete(instance.id);
            if (!this.processes.has(instance.id)) {
              this.startProcess(instance, options).catch(() => {});
            }
          }, AUTO_RESTART_DELAY_MS);
          timer.unref?.();
          this.autoRestartTimers.set(instance.id, timer);
        } else {
          const abortMsg = `[Singularity] Auto-Restart detenido: El servidor falló ${MAX_AUTO_RESTARTS} veces seguidas en menos de 5 minutos.`;
          buffer.push(abortMsg + '\n');
          this.emit('console-line', { instanceId: instance.id, line: abortMsg });
        }
      }
    });

    return state;
  }

  sendCommand(instanceId: string, command: string): void {
    const child = this.processes.get(instanceId);
    if (!child || !child.stdin || child.stdin.destroyed) {
      throw new Error(`El servidor '${instanceId}' no está activo para recibir comandos.`);
    }

    child.stdin.write(command.endsWith('\n') ? command : command + '\n');
  }

  async stopProcess(instanceId: string, gracefulTimeoutMs: number = 15000): Promise<void> {
    const pendingTimer = this.autoRestartTimers.get(instanceId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.autoRestartTimers.delete(instanceId);
    }

    const child = this.processes.get(instanceId);
    const state = this.states.get(instanceId);

    if (!child || !state) {
      return;
    }

    state.status = 'stopping';
    this.emit('status-change', { instanceId, status: 'stopping' });

    // 1. Send graceful "/stop" command to stdin
    try {
      this.sendCommand(instanceId, 'stop');
    } catch {
      // Ignore if stdin is not available
    }

    // 2. Wait up to gracefulTimeoutMs for natural exit
    const hasExitedNaturally = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, gracefulTimeoutMs);

      child.once('exit', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });

    // 3. Force tree-kill if still running after timeout
    if (!hasExitedNaturally && child.pid) {
      await killProcessTree(child.pid, 'SIGKILL');
    }

    state.status = 'offline';
    this.processes.delete(instanceId);
    this.activePlayers.delete(instanceId);
    this.emit('status-change', { instanceId, status: 'offline' });
  }

  async getMetrics(instanceId: string): Promise<ProcessMetrics | null> {
    const child = this.processes.get(instanceId);
    if (!child || !child.pid) {
      return null;
    }

    try {
      const stats = await pidusage(child.pid);
      return {
        cpuPercent: Math.round(stats.cpu * 10) / 10,
        memoryBytes: stats.memory,
        uptimeSeconds: Math.round(stats.elapsed / 1000)
      };
    } catch {
      return null;
    }
  }

  getPlayers(instanceId: string): ConnectedPlayer[] {
    return this.activePlayers.get(instanceId) ?? [];
  }

  getBuffer(instanceId: string): ConsoleBuffer | null {
    return this.buffers.get(instanceId) ?? null;
  }

  getState(instanceId: string): ProcessState | null {
    return this.states.get(instanceId) ?? null;
  }
}
