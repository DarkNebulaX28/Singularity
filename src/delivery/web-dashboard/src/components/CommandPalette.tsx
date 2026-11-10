import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Package, Cpu, Terminal, Key, LogOut, Server, Settings, Users, CornerDownLeft } from 'lucide-react';
import { api } from '../services/api-client.js';
import type { NavTab } from './Sidebar.js';
import type { ServerInstanceData } from './ServerCard.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onToggle?: () => void;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onSelectServer?: (server: ServerInstanceData) => void;
  onOpenCreateWizard: () => void;
  onOpenSftpModal: () => void;
  onOpenPasswordModal: () => void;
  onLogout: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onToggle,
  onClose,
  onNavigate,
  onSelectServer,
  onOpenCreateWizard,
  onOpenSftpModal,
  onOpenPasswordModal,
  onLogout
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [servers, setServers] = useState<ServerInstanceData[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      api.get<ServerInstanceData[]>('/servers').then((list) => {
        if (Array.isArray(list)) setServers(list);
      }).catch(() => {});
    }
  }, [isOpen]);

  const actions = useMemo(() => {
    const serverActions = servers.map((srv) => ({
      id: `srv-${srv.id}`,
      label: `Abrir servidor: ${srv.name} (${srv.loader.toUpperCase()} ${srv.gameVersion})`,
      icon: Server,
      category: srv.status === 'online' ? '🟢 ONLINE' : '⚪ INSTANCIA',
      action: () => {
        onNavigate('servers');
        onSelectServer?.(srv);
        onClose();
      }
    }));

    return [
      ...serverActions,
      {
        id: 'create-server',
        label: 'Crear nuevo servidor Minecraft (Paper, Purpur, Fabric, Forge...)',
        icon: Plus,
        category: 'Servidores',
        action: () => {
          onOpenCreateWizard();
          onClose();
        }
      },
      {
        id: 'nav-servers',
        label: 'Ir a Mission Control (Panel Principal de Servidores)',
        icon: Terminal,
        category: 'Navegación',
        action: () => {
          onNavigate('servers');
          onClose();
        }
      },
      {
        id: 'nav-catalog',
        label: 'Explorar Catálogo Singularity (Plugins, Mods, Modpacks)',
        icon: Package,
        category: 'Navegación',
        action: () => {
          onNavigate('catalog');
          onClose();
        }
      },
      {
        id: 'nav-java',
        label: 'Gestionar Runtimes de Java (Adoptium Temurin JDK)',
        icon: Cpu,
        category: 'Navegación',
        action: () => {
          onNavigate('java');
          onClose();
        }
      },
      {
        id: 'nav-users',
        label: 'Gestionar Cuentas y Permisos RBAC',
        icon: Users,
        category: 'Navegación',
        action: () => {
          onNavigate('users');
          onClose();
        }
      },
      {
        id: 'nav-settings',
        label: 'Abrir Configuración del Sistema e IDE Predeterminado',
        icon: Settings,
        category: 'Sistema',
        action: () => {
          onNavigate('settings');
          onClose();
        }
      },
      {
        id: 'sftp-info',
        label: 'Conectar vía SFTP en Antigravity IDE / VS Code (:2022)',
        icon: Terminal,
        category: 'Herramientas',
        action: () => {
          onOpenSftpModal();
          onClose();
        }
      },
      {
        id: 'change-pass',
        label: 'Cambiar contraseña de acceso del operador',
        icon: Key,
        category: 'Seguridad',
        action: () => {
          onOpenPasswordModal();
          onClose();
        }
      },
      {
        id: 'logout',
        label: 'Cerrar sesión en Singularity',
        icon: LogOut,
        category: 'Seguridad',
        action: () => {
          onLogout();
          onClose();
        }
      }
    ];
  }, [servers, onNavigate, onSelectServer, onOpenCreateWizard, onOpenSftpModal, onOpenPasswordModal, onLogout, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onToggle) onToggle();
        else onClose();
        return;
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex]!.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onToggle, filtered, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-20 p-4 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-nebula-900 border border-nebula-750 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-nebula-800 bg-nebula-950">
          <Search className="w-4 h-4 text-nebula-accent shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca un servidor, plugin, comando o sección (↑/↓ para navegar)..."
            className="w-full bg-transparent text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-nebula-850 text-slate-400 rounded border border-nebula-700 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Action List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-slate-500">
              No se encontraron acciones ni servidores para "{query}"
            </div>
          ) : (
            filtered.map((act, idx) => {
              const Icon = act.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={act.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={act.action}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all text-left group ${
                    isSelected
                      ? 'bg-nebula-800 text-white border border-nebula-accent/40 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-nebula-850 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isSelected ? 'text-nebula-accent' : 'text-slate-400 group-hover:text-nebula-accent'
                      }`}
                    />
                    <span className="truncate font-medium">{act.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-nebula-950 text-slate-400 border border-nebula-800">
                      {act.category}
                    </span>
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-nebula-accent" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-nebula-800 bg-nebula-950/90 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>↑↓ Navegar &bull; Enter Ejecutar &bull; Esc Cerrar</span>
          <span className="text-nebula-cyber">Singularity Command Center</span>
        </div>
      </div>
    </div>
  );
};
