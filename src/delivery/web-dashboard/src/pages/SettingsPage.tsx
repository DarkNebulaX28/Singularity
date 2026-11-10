import React, { useState, useEffect } from 'react';
import {
  Settings,
  Terminal,
  Server,
  Shield,
  Key,
  Copy,
  CheckCircle2,
  Monitor,
  Code2,
  LogOut,
  Save,
  Bell,
  Power,
  Volume2,
  User,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useDialog } from '../context/DialogContext.js';
import { getMinecraftAvatarUrl, STEVE_AVATAR_SVG } from '../utils/minecraft-skin.js';
import type { DesktopNotificationConfig, AutoStartSettings } from '../types/desktop.js';

interface SettingsPageProps {
  onOpenProfileModal: (tab?: 'profile' | 'security') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenProfileModal }) => {
  const { user, logout } = useAuth();
  const { toast } = useDialog();

  // Terminal Preferences (Stored in localStorage)
  const [fontSize, setFontSize] = useState<number>(() => {
    return parseInt(localStorage.getItem('singularity_term_fontsize') || '13', 10);
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('singularity_term_font') || 'JetBrains Mono';
  });
  const [scrollback, setScrollback] = useState<number>(() => {
    return parseInt(localStorage.getItem('singularity_term_scrollback') || '3000', 10);
  });
  const [autoScroll, setAutoScroll] = useState<boolean>(() => {
    return localStorage.getItem('singularity_term_autoscroll') !== 'false';
  });

  // IDE preference
  const [preferredIde, setPreferredIde] = useState<string>(() => {
    return localStorage.getItem('singularity_preferred_ide') || 'antigravity';
  });

  const [savedFeedback, setSavedFeedback] = useState(false);
  const [copiedSftp, setCopiedSftp] = useState(false);
  const [testNotifFeedback, setTestNotifFeedback] = useState(false);

  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).singularityDesktop?.isElectron);

  // Desktop Native Integration States
  const [autoStart, setAutoStart] = useState<AutoStartSettings>({
    enabled: false,
    startHidden: false
  });
  const [notifConfig, setNotifConfig] = useState<DesktopNotificationConfig>({
    enabled: true,
    serverStatus: true,
    serverCrash: true,
    playerEvents: true,
    sound: true
  });

  useEffect(() => {
    if (isDesktop && window.singularityDesktop) {
      if (window.singularityDesktop.getAutoStartSettings) {
        window.singularityDesktop.getAutoStartSettings().then((s) => setAutoStart(s)).catch(() => {});
      }
      if (window.singularityDesktop.getNotificationConfig) {
        window.singularityDesktop.getNotificationConfig().then((c) => setNotifConfig(c)).catch(() => {});
      }
    }
  }, [isDesktop]);

  const handleToggleAutoStart = async (enabled: boolean) => {
    const next = { ...autoStart, enabled };
    setAutoStart(next);
    if (isDesktop && window.singularityDesktop?.setAutoStartSettings) {
      const res = await window.singularityDesktop.setAutoStartSettings(next);
      setAutoStart(res);
      toast(enabled ? 'Inicio automático con Windows activado' : 'Inicio automático desactivado', 'info');
    }
  };

  const handleToggleStartHidden = async (startHidden: boolean) => {
    const next = { ...autoStart, startHidden };
    setAutoStart(next);
    if (isDesktop && window.singularityDesktop?.setAutoStartSettings) {
      const res = await window.singularityDesktop.setAutoStartSettings(next);
      setAutoStart(res);
    }
  };

  const handleUpdateNotificationConfig = async (updates: Partial<DesktopNotificationConfig>) => {
    const next = { ...notifConfig, ...updates };
    setNotifConfig(next);
    if (isDesktop && window.singularityDesktop?.setNotificationConfig) {
      const res = await window.singularityDesktop.setNotificationConfig(updates);
      setNotifConfig(res);
    }
  };

  const handleTestNotification = async () => {
    if (isDesktop && window.singularityDesktop?.showNotification) {
      await window.singularityDesktop.showNotification({
        title: '🌌 Singularity Mission Control',
        body: '¡Notificaciones nativas de Windows configuradas y funcionando con éxito!',
        type: 'info'
      });
      setTestNotifFeedback(true);
      toast('Notificación nativa enviada a Windows', 'success');
      setTimeout(() => setTestNotifFeedback(false), 3000);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('singularity_term_fontsize', fontSize.toString());
    localStorage.setItem('singularity_term_font', fontFamily);
    localStorage.setItem('singularity_term_scrollback', scrollback.toString());
    localStorage.setItem('singularity_term_autoscroll', autoScroll.toString());
    localStorage.setItem('singularity_preferred_ide', preferredIde);

    setSavedFeedback(true);
    toast('Preferencias de consola e IDE guardadas', 'success');
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  const handleResetDefaults = () => {
    setFontSize(13);
    setFontFamily('JetBrains Mono');
    setScrollback(3000);
    setAutoScroll(true);
    setPreferredIde('antigravity');
    localStorage.setItem('singularity_term_fontsize', '13');
    localStorage.setItem('singularity_term_font', 'JetBrains Mono');
    localStorage.setItem('singularity_term_scrollback', '3000');
    localStorage.setItem('singularity_term_autoscroll', 'true');
    localStorage.setItem('singularity_preferred_ide', 'antigravity');
    toast('Preferencias restauradas a valores de fábrica', 'info');
  };

  const copySftpCommand = () => {
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
    navigator.clipboard.writeText(`sftp -P 2022 ${user?.username || 'admin'}@${host}`);
    setCopiedSftp(true);
    toast('Comando SFTP copiado al portapapeles', 'success');
    setTimeout(() => setCopiedSftp(false), 2000);
  };

  const skinNick = user?.minecraftUsername || user?.username || 'Steve';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-nebula-accent" />
            <span>Configuración & Preferencias Operativas</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Parámetros de arranque en Windows, notificaciones nativas, puente de IDE, consola interactiva y entorno operativo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedFeedback && (
            <div className="px-3.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>¡Preferencias sincronizadas!</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl bg-nebula-900 hover:bg-nebula-850 border border-nebula-800 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Restaurar valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Valores de Fábrica</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Settings & Preferences Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Windows Native OS Integration (Desktop Only) */}
          {isDesktop && (
            <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-nebula-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Power className="w-4 h-4 text-nebula-accent" />
                  <h2 className="text-sm font-bold text-white">Integración con Windows & Notificaciones Nativas</h2>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-nebula-800 text-nebula-accent border border-nebula-accent/30 font-bold">
                  ELECTRON DESKTOP
                </span>
              </div>

              {/* Auto-Start on Boot */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Arranque del Sistema Operativo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-nebula-950 border border-nebula-850 cursor-pointer hover:border-nebula-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoStart.enabled}
                      onChange={(e) => handleToggleAutoStart(e.target.checked)}
                      className="mt-0.5 rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                    />
                    <div>
                      <span className="block text-xs font-bold text-slate-200">Iniciar con Windows</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Arrancar Singularity automáticamente al iniciar sesión en el PC.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                    autoStart.enabled
                      ? 'bg-nebula-950 border-nebula-850 cursor-pointer hover:border-nebula-700'
                      : 'bg-nebula-950/40 border-nebula-900 opacity-50 cursor-not-allowed'
                  }`}>
                    <input
                      type="checkbox"
                      disabled={!autoStart.enabled}
                      checked={autoStart.startHidden}
                      onChange={(e) => handleToggleStartHidden(e.target.checked)}
                      className="mt-0.5 rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                    />
                    <div>
                      <span className="block text-xs font-bold text-slate-200">Silencioso en Bandeja</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Iniciar minimizado en el tray sin abrir la ventana principal.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Native Toast Notifications Configuration */}
              <div className="pt-3 border-t border-nebula-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-nebula-cyber" />
                    Notificaciones en el Centro de Acciones de Windows
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifConfig.enabled}
                      onChange={(e) => handleUpdateNotificationConfig({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-nebula-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-nebula-accent"></div>
                  </label>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 ${!notifConfig.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-nebula-950 border border-nebula-850 cursor-pointer hover:border-nebula-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifConfig.serverStatus}
                      onChange={(e) => handleUpdateNotificationConfig({ serverStatus: e.target.checked })}
                      className="rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                    />
                    <span className="text-xs text-slate-300">🟢 Estado de Servidores (En línea / Detenido)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-nebula-950 border border-nebula-850 cursor-pointer hover:border-nebula-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifConfig.serverCrash}
                      onChange={(e) => handleUpdateNotificationConfig({ serverCrash: e.target.checked })}
                      className="rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                    />
                    <span className="text-xs text-slate-300">🔴 Alertas de Crash y Diagnósticos</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-nebula-950 border border-nebula-850 cursor-pointer hover:border-nebula-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifConfig.playerEvents}
                      onChange={(e) => handleUpdateNotificationConfig({ playerEvents: e.target.checked })}
                      className="rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                    />
                    <span className="text-xs text-slate-300">👤 Jugadores (Entradas / Salidas)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-nebula-950 border border-nebula-850 cursor-pointer hover:border-nebula-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={notifConfig.sound}
                      onChange={(e) => handleUpdateNotificationConfig({ sound: e.target.checked })}
                      className="rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                    />
                    <span className="text-xs text-slate-300 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                      Sonido del Sistema
                    </span>
                  </label>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="px-3.5 py-2 bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-nebula-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Probar Notificación de Windows</span>
                  </button>
                  {testNotifFeedback && (
                    <span className="text-xs font-mono text-emerald-400 animate-in fade-in">
                      ¡Notificación enviada al sistema!
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Terminal & Console Preferences */}
          <form onSubmit={handleSavePreferences} className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-nebula-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-nebula-cyber" />
                <h2 className="text-sm font-bold text-white">Consola Táctica de Minecraft & Puente IDE</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                XTERM.JS / MONACO
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Tipografía de Terminal
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-accent font-mono"
                >
                  <option value="JetBrains Mono">JetBrains Mono (Oficial)</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Consolas">Consolas</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Tamaño de Fuente (<span className="font-mono tabular-nums">{fontSize}px</span>)
                </label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-accent font-mono"
                >
                  <option value={11}>11px (Compacto / Alta Densidad)</option>
                  <option value={12}>12px (Equilibrado)</option>
                  <option value={13}>13px (Predeterminado)</option>
                  <option value={14}>14px (Grande)</option>
                  <option value={16}>16px (Accesible)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Buffer de Historial (Scrollback)
                </label>
                <select
                  value={scrollback}
                  onChange={(e) => setScrollback(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-accent font-mono"
                >
                  <option value={1000}>1,000 líneas</option>
                  <option value={3000}>3,000 líneas (Predeterminado)</option>
                  <option value={5000}>5,000 líneas</option>
                  <option value={10000}>10,000 líneas (Alto consumo)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-nebula-950 border border-nebula-800 cursor-pointer hover:border-nebula-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded bg-nebula-900 border-nebula-700 text-nebula-accent focus:ring-0"
                  />
                  <span className="text-xs text-slate-300 font-medium">Auto-scroll hacia los nuevos logs</span>
                </label>
              </div>
            </div>

            {/* Live Terminal Font & Size Preview */}
            <div className="p-3 rounded-xl bg-black/90 border border-nebula-800 space-y-1 shadow-inner">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pb-1 border-b border-nebula-900">
                <span>VISTA PREVIA DE CONSOLA EN VIVO</span>
                <span>{fontFamily} &bull; {fontSize}px &bull; {scrollback.toLocaleString()} líneas</span>
              </div>
              <div
                style={{ fontFamily: `"${fontFamily}", monospace`, fontSize: `${fontSize}px` }}
                className="leading-relaxed pt-1 space-y-0.5 select-none"
              >
                <div className="text-slate-400">
                  <span className="text-slate-600">[12:00:01]</span> <span className="text-cyan-400">[Server thread/INFO]</span>: Loading Paper 1.21.4-R0.1-SNAPSHOT...
                </div>
                <div className="text-emerald-400">
                  <span className="text-slate-600">[12:00:03]</span> <span className="text-emerald-300">[Server thread/INFO]</span>: Done (1.842s)! For help, type "help"
                </div>
              </div>
            </div>

            {/* IDE Preference */}
            <div className="pt-3 border-t border-nebula-800/80 space-y-2">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-nebula-purple" />
                IDE Predeterminado para Edición Externa
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'antigravity', label: 'Antigravity IDE', desc: 'Google AGY' },
                  { id: 'vscode', label: 'VS Code', desc: 'Microsoft' },
                  { id: 'cursor', label: 'Cursor', desc: 'AI Code Editor' },
                  { id: 'explorer', label: 'Explorador', desc: 'Archivos Host' }
                ].map((ide) => (
                  <button
                    key={ide.id}
                    type="button"
                    onClick={() => setPreferredIde(ide.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      preferredIde === ide.id
                        ? 'bg-nebula-purple/15 border-nebula-purple text-white shadow-sm'
                        : 'bg-nebula-950 border-nebula-850 text-slate-400 hover:border-nebula-700'
                    }`}
                  >
                    <span className="block text-xs font-bold font-mono">{ide.label}</span>
                    <span className="block text-[10px] text-slate-500 font-sans mt-0.5">{ide.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98] text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-nebula-accent/20 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Preferencias de Interfaz</span>
            </button>
          </form>

          {/* Micro-Server SFTP Information Tile */}
          <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-nebula-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-nebula-accent" />
                <h2 className="text-sm font-bold text-white">Micro-Servidor SFTP Embebido (:2022)</h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                ACTIVO
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Permite conectarse a cualquier instancia de Minecraft desde FileZilla, Cyberduck, VS Code o Antigravity IDE con tu usuario y contraseña de Singularity.
            </p>

            <div className="p-3 rounded-xl bg-nebula-950 border border-nebula-850 font-mono text-xs flex items-center justify-between">
              <span className="text-slate-300">
                sftp -P 2022 {user?.username || 'admin'}@127.0.0.1
              </span>
              <button
                type="button"
                onClick={copySftpCommand}
                className="px-2.5 py-1 rounded-lg bg-nebula-900 hover:bg-nebula-800 border border-nebula-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-[11px] transition-colors"
                title="Copiar comando de conexión"
              >
                {copiedSftp ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSftp ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): System Telemetry & Identity Card */}
        <div className="space-y-6">
          {/* User Identity & Profile Quick Trigger */}
          <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-nebula-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-nebula-accent" />
                <h2 className="text-sm font-bold text-white">Credencial de Operador</h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-nebula-800 text-nebula-accent border border-nebula-accent/30 font-bold">
                {user?.role}
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-nebula-950 border border-nebula-850">
              <img
                src={getMinecraftAvatarUrl(skinNick, 44)}
                alt={skinNick}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = STEVE_AVATAR_SVG;
                }}
                className="w-11 h-11 rounded-lg border border-nebula-800 object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-white truncate">
                  @{user?.username}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user?.displayName || 'Sin alias visible'}
                </div>
                <div className="text-[10px] font-mono text-nebula-cyber truncate">
                  Skin: {skinNick}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenProfileModal('profile')}
                className="w-full py-2 px-3 rounded-xl bg-nebula-950 hover:bg-nebula-850 border border-nebula-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-nebula-cyber" />
                <span>Editar Perfil & Skin 3D</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenProfileModal('security')}
                className="w-full py-2 px-3 rounded-xl bg-nebula-950 hover:bg-nebula-850 border border-nebula-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                <Key className="w-3.5 h-3.5 text-nebula-accent" />
                <span>Cambiar Contraseña</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>

          {/* Node & Architecture Info */}
          <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-3">
            <div className="flex items-center gap-2 border-b border-nebula-800/80 pb-3">
              <Monitor className="w-4 h-4 text-nebula-cyber" />
              <h2 className="text-sm font-bold text-white">Entorno de Ejecución</h2>
            </div>

            <div className="space-y-2 text-xs font-mono tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Modo:</span>
                <span className="text-nebula-accent font-bold">
                  {isDesktop ? 'Electron Desktop' : 'Web & Headless API'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Core Port:</span>
                <span className="text-white">:3000 (HTTP/WS)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">SFTP Port:</span>
                <span className="text-nebula-cyber font-bold">:2022</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Directorio Servidores:</span>
                <span className="text-slate-300 text-[11px] truncate max-w-[140px]" title="data/servers">
                  data/servers
                </span>
              </div>
            </div>
          </div>

          {/* About NebulaX Studio */}
          <div className="p-4 rounded-2xl bg-nebula-950/60 border border-nebula-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <img src="/favicon.svg" alt="Singularity" className="w-5 h-5 object-contain" />
              <span className="text-xs font-bold text-white tracking-wider font-mono">SINGULARITY</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-nebula-800 text-nebula-accent border border-nebula-accent/30">
                v0.1.2-alpha
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Un producto oficial de <strong>NebulaX Studio</strong> & <strong>Xavier Aimacaña</strong>.
            </p>
            <span className="text-[10px] text-slate-500 font-mono block">
              Bajo Licencia MIT (Open Source 2026)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
