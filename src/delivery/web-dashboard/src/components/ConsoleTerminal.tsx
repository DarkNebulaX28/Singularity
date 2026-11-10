import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Trash2, ArrowDownCircle, CornerDownLeft, RotateCw, AlertTriangle, Copy, Check, Sparkles } from 'lucide-react';
import { getAuthToken } from '../services/api-client.js';
import type { CrashDiagnosticData } from './CrashAlertBanner.js';

const COMMAND_SUGGESTIONS = [
  { cmd: 'help', desc: 'Muestra la lista de comandos del servidor' },
  { cmd: 'list', desc: 'Muestra los jugadores conectados' },
  { cmd: 'tps', desc: 'Muestra el rendimiento actual en TPS (Paper/Spigot)' },
  { cmd: 'plugins', desc: 'Lista todos los plugins activos en Paper/Bukkit' },
  { cmd: 'chunky radius 1000', desc: 'Define el radio de pre-generación de Chunky' },
  { cmd: 'chunky start', desc: 'Inicia la pre-generación de terreno con Chunky' },
  { cmd: 'chunky pause', desc: 'Pausa la tarea activa de Chunky' },
  { cmd: 'chunky progress', desc: 'Muestra el progreso de generación de Chunky' },
  { cmd: 'spark profiler start', desc: 'Inicia diagnóstico de rendimiento con Spark' },
  { cmd: 'save-all', desc: 'Guarda el mundo en disco inmediatamente' },
  { cmd: 'whitelist on', desc: 'Activa la lista blanca del servidor' },
  { cmd: 'whitelist add ', desc: 'Añade un jugador a la whitelist' },
  { cmd: 'op ', desc: 'Otorga permisos de operador a un jugador' },
  { cmd: 'deop ', desc: 'Revoca permisos de operador' },
  { cmd: 'gamemode creative ', desc: 'Cambia jugador a modo Creativo' },
  { cmd: 'gamemode survival ', desc: 'Cambia jugador a modo Supervivencia' },
  { cmd: 'time set day', desc: 'Cambia la hora del mundo a día' },
  { cmd: 'weather clear', desc: 'Despeja el clima actual' },
  { cmd: 'stop', desc: 'Detiene el servidor de forma segura' }
];

interface ConsoleTerminalProps {
  serverId: string;
  isOnline: boolean;
  onCrashDetected?: (diagnostic: CrashDiagnosticData) => void;
  onStatusChange?: (status: string) => void;
  onPlayerEvent?: (event: unknown) => void;
}

export const ConsoleTerminal: React.FC<ConsoleTerminalProps> = ({
  serverId,
  isOnline,
  onCrashDetected,
  onStatusChange,
  onPlayerEvent
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const retryCountRef = useRef(0);

  // Preserve latest callbacks and flags across renders without re-triggering effects
  const callbacksRef = useRef({
    onCrashDetected,
    onStatusChange,
    onPlayerEvent
  });
  callbacksRef.current = {
    onCrashDetected,
    onStatusChange,
    onPlayerEvent
  };

  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logLinesRef = useRef<string[]>([]);

  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [proxyWarning, setProxyWarning] = useState(false);

  // Quick Command Presets
  const quickCommands = [
    { label: '/help', cmd: 'help' },
    { label: '/list', cmd: 'list' },
    { label: '/tps', cmd: 'tps' },
    { label: '/plugins', cmd: 'plugins' },
    { label: 'chunky radius 1000', cmd: 'chunky radius 1000' },
    { label: 'chunky start', cmd: 'chunky start' },
    { label: '/save-all', cmd: 'save-all' },
    { label: '/stop', cmd: 'stop' }
  ];

  const matchingSuggestions = useMemo(() => {
    const raw = commandInput.replace(/^\//, '').trim().toLowerCase();
    if (!raw) return [];
    return COMMAND_SUGGESTIONS.filter(
      (s) => s.cmd.toLowerCase().startsWith(raw) && s.cmd.toLowerCase() !== raw
    ).slice(0, 4);
  }, [commandInput]);

  const connect = () => {
    if (!isMountedRef.current) return;
    const term = termInstance.current;
    const token = getAuthToken() || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/servers/${serverId}/console?token=${encodeURIComponent(token)}`;

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Cleanly close prior socket without triggering onclose loops
    if (socketRef.current) {
      const prevSocket = socketRef.current;
      socketRef.current = null;
      try {
        prevSocket.onopen = null;
        prevSocket.onmessage = null;
        prevSocket.onclose = null;
        prevSocket.onerror = null;
        if (prevSocket.readyState === WebSocket.OPEN || prevSocket.readyState === WebSocket.CONNECTING) {
          prevSocket.close();
        }
      } catch {
        // ignore
      }
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    setIsReconnecting(true);
    if (term) {
      term.writeln(`\x1b[36m[Singularity]\x1b[0m Conectando a canal interactivo...`);
    }

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        setIsReconnecting(false);
        setProxyWarning(false);
        retryCountRef.current = 0;
        if (term) {
          term.writeln('\x1b[32m[Singularity]\x1b[0m Conexión en tiempo real activa.');
        }

        // Keepalive heartbeat every 20s to prevent reverse proxy idle timeouts
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        if (!term) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') return;

          if (msg.type === 'history' && Array.isArray(msg.lines)) {
            term.clear();
            logLinesRef.current = msg.lines.slice(-400);
            for (const line of msg.lines) {
              term.writeln(line);
            }
            if (autoScrollRef.current) term.scrollToBottom();
          } else if (msg.type === 'log' && typeof msg.line === 'string') {
            logLinesRef.current.push(msg.line);
            if (logLinesRef.current.length > 500) {
              logLinesRef.current.shift();
            }
            term.writeln(msg.line);
            if (autoScrollRef.current) term.scrollToBottom();
          } else if (msg.type === 'status' && typeof msg.status === 'string') {
            callbacksRef.current.onStatusChange?.(msg.status);
          } else if (msg.type === 'crash' && msg.diagnostic) {
            callbacksRef.current.onCrashDetected?.(msg.diagnostic as CrashDiagnosticData);
          } else if (msg.type === 'player-event' && msg.data) {
            callbacksRef.current.onPlayerEvent?.(msg.data);
          }
        } catch {
          term.writeln(event.data);
        }
      };

      socket.onclose = (ev) => {
        if (!isMountedRef.current || intentionalCloseRef.current) return;
        setIsConnected(false);
        setIsReconnecting(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        if (ev.code === 1008) {
          if (term) {
            term.writeln('\x1b[31m[Singularity]\x1b[0m Sesión expirada o no autorizada. Recarga la página.');
          }
          return;
        }

        retryCountRef.current += 1;
        if (retryCountRef.current > 4) {
          setProxyWarning(true);
        }

        if (term) {
          term.writeln('\x1b[33m[Singularity]\x1b[0m Canal desconectado. Reintentando en 3s...');
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !intentionalCloseRef.current) {
            connect();
          }
        }, 3000);
      };

      socket.onerror = () => {
        setIsConnected(false);
      };
    } catch (err: unknown) {
      if (term) {
        term.writeln(`\x1b[31m[Singularity Error]\x1b[0m ${err instanceof Error ? err.message : 'Error al conectar'}`);
      }
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;
    isMountedRef.current = true;
    intentionalCloseRef.current = false;
    retryCountRef.current = 0;

    // Initialize xterm only once per serverId
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
      fontSize: 12,
      lineHeight: 1.25,
      theme: {
        background: '#090b10',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        selectionBackground: '#1e293b',
        black: '#151b26',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      convertEol: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial connection to canonical path
    connect();

    return () => {
      isMountedRef.current = false;
      intentionalCloseRef.current = true;
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (socketRef.current) {
        const s = socketRef.current;
        socketRef.current = null;
        try {
          s.onopen = null;
          s.onmessage = null;
          s.onclose = null;
          s.onerror = null;
          s.close();
        } catch {
          // ignore
        }
      }
      term.dispose();
    };
  }, [serverId]); // STRICTLY depend only on serverId so parent re-renders don't teardown socket

  const sendCommand = (cmd: string) => {
    const trimmed = cmd.replace(/^\//, '').trim();
    if (!trimmed) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'command', command: trimmed }));
    } else {
      termInstance.current?.writeln(`\x1b[31m[Error]\x1b[0m No se puede enviar comando: Consola desconectada.`);
    }

    setCommandHistory((prev) => {
      const next = [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 40);
      return next;
    });
    setHistoryIndex(-1);
    setCommandInput('');
  };

  const handleCopyLogs = () => {
    const plainText = logLinesRef.current
      .map((line) => line.replace(/\x1b\[[0-9;]*m/g, ''))
      .join('\n');
    navigator.clipboard.writeText(plainText || 'Consola sin registros');
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && matchingSuggestions.length > 0 && matchingSuggestions[0]) {
      e.preventDefault();
      setCommandInput(matchingSuggestions[0].cmd);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(nextIdx);
      setCommandInput(commandHistory[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      } else {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx] || '');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendCommand(commandInput);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-nebula-950 border border-nebula-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Console Action Bar */}
      <div className="h-10 px-4 border-b border-nebula-800/80 bg-nebula-900/90 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : isReconnecting ? 'bg-amber-400 animate-spin' : 'bg-red-500'}`} />
          <span className="text-slate-300 font-semibold">Consola Interactiva</span>
          <span className="text-[10px] text-slate-500">
            {isConnected ? '(En vivo)' : isOnline ? '(En ejecución)' : '(Servidor offline)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && (
            <button
              onClick={() => {
                setProxyWarning(false);
                retryCountRef.current = 0;
                connect();
              }}
              disabled={isReconnecting}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-nebula-700 transition-colors disabled:opacity-50"
              title="Reconectar WebSocket"
            >
              <RotateCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
              <span>Reconectar</span>
            </button>
          )}

          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-nebula-950 hover:bg-nebula-800 text-slate-300 border border-nebula-800 transition-colors active:scale-[0.98]"
            title="Copiar registros de consola al portapapeles"
          >
            {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLogs ? 'Copiado' : 'Copiar Logs'}</span>
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
              autoScroll
                ? 'bg-nebula-accent/20 border-nebula-accent/40 text-nebula-accent font-semibold'
                : 'bg-nebula-950 border-nebula-800 text-slate-400'
            }`}
            title="Auto-scroll"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          <button
            onClick={() => {
              logLinesRef.current = [];
              termInstance.current?.clear();
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-nebula-800 transition-colors"
            title="Limpiar pantalla"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {proxyWarning && (
        <div className="px-4 py-2 bg-amber-950/60 border-b border-amber-500/30 text-amber-200 text-[11px] font-mono flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Canal WebSocket no responde. Si usas Nginx / Cloudflare, verifica que <code>Websockets Support</code> esté activo.
            </span>
          </div>
          <button
            onClick={() => {
              setProxyWarning(false);
              retryCountRef.current = 0;
              connect();
            }}
            className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-300 font-bold shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Interactive xterm Container */}
      <div className="flex-1 p-3 min-h-0 bg-[#090b10] overflow-hidden">
        <div ref={terminalRef} className="w-full h-full" />
      </div>

      {/* Live Autocomplete Suggestions Bar */}
      {matchingSuggestions.length > 0 && (
        <div className="px-3 py-1.5 border-t border-nebula-800 bg-nebula-900/95 flex items-center gap-2 overflow-x-auto shrink-0 text-[11px] font-mono">
          <span className="text-[10px] text-nebula-accent flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3" />
            <span>Tab:</span>
          </span>
          {matchingSuggestions.map((sug) => (
            <button
              key={sug.cmd}
              type="button"
              onClick={() => setCommandInput(sug.cmd)}
              className="px-2 py-0.5 rounded bg-nebula-950 border border-nebula-750 hover:border-nebula-accent text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <span className="text-nebula-accent font-bold">{sug.cmd}</span>
              <span className="text-[10px] text-slate-500 font-sans hidden sm:inline">&mdash; {sug.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Quick Command Suggestions Chips */}
      <div className="px-3 py-1.5 border-t border-nebula-850 bg-nebula-950 flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs font-mono">
        <span className="text-[10px] text-slate-500 mr-1 select-none">Rápido:</span>
        {quickCommands.map((item) => (
          <button
            key={item.cmd}
            type="button"
            onClick={() => sendCommand(item.cmd)}
            className="px-2 py-0.5 rounded bg-nebula-900 border border-nebula-800 hover:border-nebula-700 hover:text-nebula-accent text-slate-400 text-[11px] transition-colors shrink-0 active:scale-[0.97]"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Console Input Bar */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-nebula-800 bg-nebula-900/95 flex items-center gap-2 shrink-0">
        <div className="relative flex-1 flex items-center">
          <span className="absolute left-3 text-nebula-accent font-mono text-xs select-none">❯</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Comando Minecraft (↑/↓ historial, Tab autocompletar, ej. op Steve, chunky start)..."
            className="w-full pl-7 pr-3 py-1.5 bg-nebula-950 border border-nebula-800 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="px-3.5 py-1.5 bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40"
        >
          <span>Enviar</span>
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
