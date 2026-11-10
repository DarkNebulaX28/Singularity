import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Search, LogOut, Shield, Terminal, Key, Cloud, Monitor, Activity } from 'lucide-react';
import { getMinecraftAvatarUrl, STEVE_AVATAR_SVG } from '../utils/minecraft-skin';
import type { ServerConnectionProfile } from '../types/desktop.js';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenSftpModal: () => void;
  onOpenProfileModal?: () => void;
  onOpenConnectionModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onOpenSftpModal,
  onOpenProfileModal,
  onOpenConnectionModal
}) => {
  const { user, logout } = useAuth();
  const skinNick = user?.minecraftUsername || user?.username || 'Steve';

  const [activeProfile, setActiveProfile] = useState<ServerConnectionProfile | null>(null);
  const [clockText, setClockText] = useState<string>(() => new Date().toLocaleTimeString('es-ES', { hour12: false }));

  useEffect(() => {
    if (typeof window !== 'undefined' && window.singularityDesktop?.getActiveConnection) {
      window.singularityDesktop.getActiveConnection().then(setActiveProfile).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(new Date().toLocaleTimeString('es-ES', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 border-b border-nebula-800 bg-nebula-900/95 backdrop-blur-md px-4 flex items-center justify-between z-20 select-none shrink-0">
      {/* Left: Quick search & Command Palette Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 bg-nebula-950 border border-nebula-800 rounded-xl hover:border-nebula-accent/50 hover:text-slate-100 transition-all shadow-inner active:scale-[0.98] group"
        >
          <Search className="w-3.5 h-3.5 text-nebula-accent group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Buscar servidor, plugin, mod o comando...</span>
          <span className="sm:hidden">Comandos...</span>
          <kbd className="ml-2 sm:ml-6 px-1.5 py-0.5 text-[10px] font-mono bg-nebula-900 text-nebula-accent rounded border border-nebula-750 shadow-sm">
            Ctrl+K
          </kbd>
        </button>

        {/* Tactical Telemetry Clock Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-nebula-950/80 border border-nebula-850 text-[10px] font-mono tabular-nums text-slate-400">
          <Activity className="w-3 h-3 text-nebula-accent" />
          <span>SYS</span>
          <span className="text-slate-200 font-semibold">{clockText}</span>
        </div>
      </div>

      {/* Right: Remote/Local Connection Switcher, SFTP, IDE status & User Info */}
      <div className="flex items-center gap-2.5">
        {/* Environment / Server Connection Switcher Badge */}
        <button
          onClick={onOpenConnectionModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium rounded-xl transition-all border border-nebula-800 bg-nebula-950 hover:border-nebula-700 text-slate-300 shadow-inner group active:scale-[0.98]"
          title="Cambiar entre servidor VPS Cloud y Servidor Local"
        >
          {activeProfile?.type === 'local' ? (
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="hidden sm:inline font-semibold group-hover:text-slate-100 transition-colors">
            {activeProfile?.name || (typeof window !== 'undefined' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost' ? 'NebulaX Cloud' : 'Local Host')}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        </button>

        <button
          onClick={onOpenSftpModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-nebula-cyber bg-nebula-cyber/10 border border-nebula-cyber/30 rounded-xl hover:bg-nebula-cyber/20 transition-all active:scale-[0.98]"
          title="Micro-servidor SFTP Port 2022 para Antigravity IDE y VS Code"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="tabular-nums">SFTP :2022</span>
        </button>

        {user && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-nebula-800">
            {/* Interactive User Profile Trigger */}
            <button
              onClick={onOpenProfileModal}
              className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-nebula-850 border border-transparent hover:border-nebula-750 transition-all text-left group active:scale-[0.98]"
              title="Ver mi perfil y personalizar avatar de Minecraft"
            >
              <div className="w-7 h-7 rounded-lg bg-nebula-950 border border-nebula-750 flex items-center justify-center overflow-hidden shrink-0 shadow">
                <img
                  src={getMinecraftAvatarUrl(skinNick, 28)}
                  alt={user.username}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = STEVE_AVATAR_SVG;
                  }}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                />
              </div>

              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-nebula-accent transition-colors leading-tight">
                  {user.displayName || user.username}
                </span>
                <span className="text-[10px] font-mono font-semibold tracking-wider text-nebula-accent flex items-center justify-end gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  {user.role}
                </span>
              </div>
            </button>

            {user.mustChangePassword && (
              <button
                onClick={onOpenProfileModal}
                className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                title="Debes cambiar tu contraseña inicial"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 border border-transparent hover:border-rose-500/30 transition-all active:scale-[0.97]"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
