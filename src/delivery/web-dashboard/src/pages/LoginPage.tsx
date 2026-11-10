import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Server,
  Sparkles,
  Check,
  KeyRound,
  Cloud,
  Monitor,
  Cpu,
  Code2,
  Activity,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ConnectionSwitcherModal } from '../components/ConnectionSwitcherModal.js';
import type { ServerConnectionProfile } from '../types/desktop.js';

export interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading?: boolean;
  initialError?: string | null;
}

const SAVED_OPERATOR_KEY = 'singularity_last_operator';

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  isLoading = false,
  initialError = null
}) => {
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SAVED_OPERATOR_KEY) || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [rememberOperator, setRememberOperator] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Connection management & modal state
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<ServerConnectionProfile | null>(null);

  // Real-time backend health & telemetry
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost' ||
      activeProfile?.type === 'local');

  const isElectronApp =
    typeof window !== 'undefined' && Boolean((window as any).singularityDesktop?.isElectron);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.singularityDesktop?.getActiveConnection) {
      window.singularityDesktop
        .getActiveConnection()
        .then(setActiveProfile)
        .catch(() => {});
    }
  }, []);

  // Live UTC / Local tactical clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkHealth = useCallback(async () => {
    setServerStatus((prev) => (prev === 'online' ? 'online' : 'checking'));
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const end = performance.now();
        setLatency(Math.max(1, Math.round(end - start)));
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 12000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password.trim()) {
      setError('Por favor ingresa tu identificador de operador y clave maestra.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (typeof window !== 'undefined') {
        if (rememberOperator) {
          localStorage.setItem(SAVED_OPERATOR_KEY, cleanUser);
        } else {
          localStorage.removeItem(SAVED_OPERATOR_KEY);
        }
      }
      await onLogin(cleanUser, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al autenticar credenciales');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDefaultCredentials = () => {
    setUsername('admin');
    setPassword('singularity');
    setAutoFilled(true);
    setError(null);
    setTimeout(() => setAutoFilled(false), 2500);
  };

  const activeNodeName =
    activeProfile?.name ||
    (isLocalHost ? 'Workstation Local (127.0.0.1)' : `Nodo Cloud (${window.location.hostname})`);

  return (
    <div className="min-h-screen w-full bg-nebula-950 text-slate-200 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Subtle Tactical Blueprint Grid & Ambient Lighting */}
      <div className="absolute inset-0 bg-tactical-grid pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_15%_0%,rgba(16,185,129,0.10),transparent),radial-gradient(ellipse_60%_50%_at_85%_100%,rgba(6,182,212,0.08),transparent)] pointer-events-none" />

      {/* Top Tactical Telemetry Header Bar */}
      <header className="relative z-10 w-full border-b border-nebula-800/80 bg-nebula-950/80 backdrop-blur-md px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Singularity" className="w-5 h-5 object-contain" />
            <span className="font-bold tracking-wider text-white">SINGULARITY</span>
            <span className="text-slate-600">//</span>
            <span className="text-[11px] text-nebula-accent font-semibold">NEBULAX STUDIO</span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-nebula-900 border border-nebula-800 text-[10px] text-slate-400 tabular-nums">
            BUILD v0.1.1-ALPHA
          </span>
          {isElectronApp && (
            <span className="px-2 py-0.5 rounded bg-nebula-cyber/10 border border-nebula-cyber/30 text-[10px] text-nebula-cyber font-semibold">
              DESKTOP CLIENT
            </span>
          )}
        </div>

        {/* Live Telemetry Readout */}
        <div className="flex items-center gap-4 tabular-nums">
          <button
            type="button"
            onClick={checkHealth}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-nebula-900/90 border border-nebula-800 hover:border-nebula-700 transition-colors"
            title="Haz clic para verificar estado del Core"
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  serverStatus === 'online'
                    ? 'bg-emerald-400'
                    : serverStatus === 'checking'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  serverStatus === 'online'
                    ? 'bg-emerald-500'
                    : serverStatus === 'checking'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              {serverStatus === 'online'
                ? 'CORE ONLINE'
                : serverStatus === 'checking'
                ? 'SONDEANDO...'
                : 'CORE OFFLINE'}
            </span>
            {latency !== null && serverStatus === 'online' && (
              <span className="text-[11px] text-nebula-cyber font-semibold border-l border-nebula-800 pl-2">
                {latency} ms
              </span>
            )}
          </button>

          {currentTime && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
              <Activity className="w-3.5 h-3.5 text-nebula-accent" />
              <span>{currentTime}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Split-Screen Mission Control Layout */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* LEFT COLUMN (7 Cols): Mission Control Architecture & Node Switcher */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            {/* Hero Title Block */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nebula-accent/10 border border-nebula-accent/30 text-nebula-accent text-[11px] font-mono font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Orquestador de Servidores Minecraft de Nueva Generación</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight text-white leading-[1.08]">
                Control Total para tu Infraestructura{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-nebula-accent via-emerald-400 to-nebula-cyber">
                  Local y Cloud 24/7
                </span>
              </h1>

              <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                Gestiona instancias <strong className="text-slate-200">Paper, Purpur, Fabric, NeoForge y Vanilla</strong> con supervisión de procesos en vivo, editor de código oficial de <strong className="text-slate-200">VS Code &amp; Antigravity IDE</strong> integrado y blindaje de seguridad de nivel estudio.
              </p>
            </div>

            {/* Active Node & Connection Switcher Card (Web & Desktop) */}
            <div className="p-4 rounded-2xl bg-nebula-900/90 border border-nebula-800 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${
                    isLocalHost
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  }`}
                >
                  {isLocalHost ? <Monitor className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      NODO OBJETIVO ACTIVO
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        serverStatus === 'online'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {serverStatus === 'online' ? 'CONECTADO' : 'SIN RESPUESTA'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                    <span>{activeNodeName}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                    {activeProfile?.url || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConnectionModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-nebula-850 hover:bg-nebula-800 text-nebula-cyber border border-nebula-750 text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cambiar Nodo / VPS</span>
              </button>
            </div>

            {/* 3 Tactical Capability Bento Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-xl bg-nebula-900/60 border border-nebula-800/90 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>[ 01 // SUPERVISOR ]</span>
                  <Cpu className="w-3.5 h-3.5 text-nebula-accent" />
                </div>
                <div className="text-xs font-bold text-slate-200">Auto-Restart &amp; JVM</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Telemetría real de CPU/RAM, detección automática de Java 8/17/21 y recuperación ante caídas.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-nebula-900/60 border border-nebula-800/90 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>[ 02 // STUDIO IDE ]</span>
                  <Code2 className="w-3.5 h-3.5 text-nebula-cyber" />
                </div>
                <div className="text-xs font-bold text-slate-200">VS Code &amp; Antigravity</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Editor multi-pestaña con validación YAML/JSON en vivo y puente Auto-Sync con tu IDE de escritorio.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-nebula-900/60 border border-nebula-800/90 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>[ 03 // ZERO-TRUST ]</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xs font-bold text-slate-200">RBAC + SFTP :2022</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Permisos granulares por servidor, protección anti-fuerza bruta y servidor SFTP integrado.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (5 Cols): Operator Authentication Terminal */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <div className="bg-nebula-900/90 backdrop-blur-2xl border border-nebula-750 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/80 relative overflow-hidden">
              {/* Top Emerald/Cyan Precision Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nebula-accent via-nebula-cyber to-transparent" />

              {/* Terminal Header */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-nebula-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-nebula-950 border border-nebula-800 flex items-center justify-center text-nebula-accent shadow-inner">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      TERMINAL DE AUTENTICACIÓN
                    </h2>
                    <p className="text-[11px] font-mono text-slate-400">
                      Ingresa tus credenciales de operador
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-nebula-950 px-2 py-1 rounded border border-nebula-800">
                  {serverStatus === 'online' ? (
                    <Wifi className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-rose-400" />
                  )}
                  <span>TLS/JWT</span>
                </div>
              </div>

              {/* Error Alert Banner (aria-live for accessibility) */}
              <div aria-live="polite">
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold block text-rose-300">Acceso Rechazado</span>
                      <span className="text-rose-200/90">{error}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="singularity-login-username"
                    className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between"
                  >
                    <span>Operador / Usuario</span>
                    <span className="text-[10px] text-slate-500 font-sans normal-case">
                      Identificador de cuenta
                    </span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="singularity-login-username"
                      name="username"
                      type="text"
                      required
                      autoFocus={!username}
                      autoComplete="username"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full pl-10 pr-3 py-2.5 bg-nebula-950 border border-nebula-800 rounded-xl text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-nebula-accent focus:ring-2 focus:ring-nebula-accent/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="singularity-login-password"
                    className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between"
                  >
                    <span>Contraseña Maestra</span>
                    {capsLockActive ? (
                      <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Bloq Mayús Activo
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-sans normal-case">
                        Clave de seguridad
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="singularity-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus={Boolean(username)}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handleKeyEvent}
                      onKeyDown={handleKeyEvent}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-nebula-950 border border-nebula-800 rounded-xl text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-nebula-accent focus:ring-2 focus:ring-nebula-accent/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Operator + Local Initial Key Helper */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberOperator}
                      onChange={(e) => setRememberOperator(e.target.checked)}
                      className="rounded border-nebula-750 bg-nebula-950 text-nebula-accent focus:ring-0"
                    />
                    <span>Recordar operador</span>
                  </label>

                  {isLocalHost && (
                    <button
                      type="button"
                      onClick={fillDefaultCredentials}
                      className="text-[11px] font-mono text-slate-400 hover:text-nebula-accent transition-colors flex items-center gap-1"
                      title="Autocompletar credenciales iniciales de instalación local"
                    >
                      {autoFilled ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Clave inicial lista</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5 text-nebula-cyber" />
                          <span>Autocompletar clave local</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Primary Submit Button with Tactile Feedback & Shortcut Hint */}
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-nebula-accent via-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 hover:shadow-emerald-500/25 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verificando Credenciales...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Sesión en Singularity</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Security Telemetry Strip */}
              <div className="mt-6 pt-4 border-t border-nebula-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>PROTECCIÓN ANTI-BRUTEFORCE ACTIVA</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Server className="w-3.5 h-3.5 text-nebula-cyber shrink-0" />
                  <span>SFTP :2022</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Tactical Footer */}
      <footer className="relative z-10 w-full border-t border-nebula-900 bg-nebula-950/80 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
        <div>
          NEBULAX STUDIO &bull; SINGULARITY MISSION CONTROL &bull; SCREAMING ARCHITECTURE
        </div>
        <div className="flex items-center gap-3">
          <span>COMPATIBLE CON VANILLA / PAPER / FABRIC / NEOFORGE / FORGE</span>
        </div>
      </footer>

      {/* Connection Switcher Modal */}
      <ConnectionSwitcherModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        onSwitched={(p) => setActiveProfile(p)}
      />
    </div>
  );
};
