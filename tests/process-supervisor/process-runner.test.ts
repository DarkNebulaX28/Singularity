import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessRunner } from '../../src/process-supervisor/services/process-runner.js';
import type { ServerInstance } from '../../src/servers/models/server-instance.js';

describe('ProcessRunner', () => {
  let runner: ProcessRunner;

  const mockInstance: ServerInstance = {
    id: 'test_srv_01',
    name: 'Test Server',
    loader: 'paper',
    gameVersion: '1.21.4',
    memoryMb: 1024,
    port: 25565,
    status: 'offline',
    eulaAccepted: true,
    autoRestart: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(() => {
    runner = new ProcessRunner();
  });

  it('should parse player join and leave messages from stdout', () => {
    const joinLog = '[12:00:00 INFO]: Steve joined the game';
    const playerJoined = runner.detectPlayerEvent(joinLog);

    expect(playerJoined).toEqual({
      type: 'join',
      username: 'Steve'
    });

    const leaveLog = '[12:05:00 INFO]: Steve left the game';
    const playerLeft = runner.detectPlayerEvent(leaveLog);

    expect(playerLeft).toEqual({
      type: 'leave',
      username: 'Steve'
    });

    const chatLog = '[12:06:00 INFO]: <Steve> Hello world!';
    expect(runner.detectPlayerEvent(chatLog)).toBeNull();
  });

  it('should handle lifecycle of simulated subprocess cleanly', async () => {
    const childProcessScript = `
      console.log('[Server thread/INFO]: Starting minecraft server version 1.21.4');
      console.log('[Server thread/INFO]: Done (2.5s)! For help, type "help"');
      process.stdin.on('data', (d) => {
        const cmd = d.toString().trim();
        if (cmd === 'stop' || cmd === '/stop') {
          console.log('[Server thread/INFO]: Stopping server');
          process.exit(0);
        } else {
          console.log('[Server thread/INFO]: Executed: ' + cmd);
        }
      });
      setInterval(() => {}, 1000);
    `;

    const state = await runner.startProcess(mockInstance, {
      executable: process.execPath,
      args: ['-e', childProcessScript],
      cwd: process.cwd()
    });

    expect(state.instanceId).toBe(mockInstance.id);
    expect(state.status).toBe('starting');
    expect(state.pid).toBeGreaterThan(0);

    // Send a command to stdin
    runner.sendCommand(mockInstance.id, 'say hello');

    // Wait for output with retry loop
    const startWait = Date.now();
    while (Date.now() - startWait < 3000) {
      const currentLines = runner.getBuffer(mockInstance.id)?.getLines() ?? [];
      if (
        currentLines.some((l) => l.includes('Starting minecraft server')) &&
        currentLines.some((l) => l.includes('Executed: say hello'))
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    const lines = runner.getBuffer(mockInstance.id)?.getLines() ?? [];
    expect(lines.some((l) => l.includes('Starting minecraft server'))).toBe(true);
    expect(lines.some((l) => l.includes('Executed: say hello'))).toBe(true);

    // Stop process
    await runner.stopProcess(mockInstance.id, 2000);
    expect(runner.getState(mockInstance.id)?.status).toBe('offline');
  });

  it('should detect crash and emit crash-detected event', async () => {
    const crashScript = `
      console.log('Exception in thread "main" java.lang.UnsupportedClassVersionError: net/minecraft/bundler/Main has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0');
      process.exit(1);
    `;

    const crashPromise = new Promise<{ instanceId: string; diagnostic: { code: string } }>((resolve) => {
      runner.once('crash-detected', (event) => {
        resolve(event);
      });
    });

    await runner.startProcess(mockInstance, {
      executable: process.execPath,
      args: ['-e', crashScript],
      cwd: process.cwd()
    });

    const eventArg = await crashPromise;
    expect(eventArg.instanceId).toBe(mockInstance.id);
    expect(eventArg.diagnostic.code).toBe('JAVA_VERSION_MISMATCH');
  });

  it('should track active players via getPlayers across join, leave, and process stop (BUG-04)', async () => {
    const playerScript = `
      console.log('[Server thread/INFO]: Done (1.2s)! For help, type "help"');
      console.log('[12:00:01 INFO]: Alex joined the game');
      console.log('[12:00:02 INFO]: Steve joined the game');
      process.stdin.on('data', (d) => {
        const cmd = d.toString().trim();
        if (cmd === 'leave_alex') {
          console.log('[12:01:00 INFO]: Alex left the game');
        } else if (cmd === 'stop') {
          process.exit(0);
        }
      });
      setInterval(() => {}, 1000);
    `;

    await runner.startProcess(mockInstance, {
      executable: process.execPath,
      args: ['-e', playerScript],
      cwd: process.cwd()
    });

    const startWait = Date.now();
    while (Date.now() - startWait < 3000) {
      if (runner.getPlayers(mockInstance.id).length === 2) break;
      await new Promise((r) => setTimeout(r, 40));
    }

    expect(runner.getPlayers(mockInstance.id).map((p) => p.username)).toEqual(['Alex', 'Steve']);

    runner.sendCommand(mockInstance.id, 'leave_alex');
    const leaveWait = Date.now();
    while (Date.now() - leaveWait < 3000) {
      if (runner.getPlayers(mockInstance.id).length === 1) break;
      await new Promise((r) => setTimeout(r, 40));
    }

    expect(runner.getPlayers(mockInstance.id).map((p) => p.username)).toEqual(['Steve']);

    await runner.stopProcess(mockInstance.id, 2000);
    expect(runner.getPlayers(mockInstance.id)).toEqual([]);
  });
});
