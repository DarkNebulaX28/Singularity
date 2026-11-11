import React, { useState } from 'react';
import { Server, Package, Cpu, Settings, Users, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SingularityLogo } from './SingularityLogo.js';

export type NavTab = 'servers' | 'catalog' | 'java' | 'users' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  serverCount: number;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, serverCount, isAdmin = true }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('singularity_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('singularity_sidebar_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    {
      id: 'servers' as NavTab,
      label: 'Mission Control',
      icon: Server,
      badge: serverCount > 0 ? `${serverCount}` : undefined
    },
    {
      id: 'catalog' as NavTab,
      label: 'Catálogo Unificado',
      icon: Package,
      badge: 'Plugins/Mods'
    },
    {
      id: 'java' as NavTab,
      label: 'Java Runtimes',
      icon: Cpu,
      badge: 'JDK'
    },
    ...(isAdmin
      ? [
          {
            id: 'users' as NavTab,
            label: 'Cuentas & Accesos',
            icon: Users,
            badge: 'RBAC'
          }
        ]
      : []),
    {
      id: 'settings' as NavTab,
      label: 'Configuración',
      icon: Settings
    }
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-60'
      } border-r border-nebula-800 bg-nebula-900/95 flex flex-col justify-between shrink-0 select-none transition-all duration-200`}
    >
      <div>
        {/* Brand Header */}
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-nebula-800">
          <div className="flex items-center min-w-0">
            {collapsed ? (
              <SingularityLogo variant="badge" size="sm" animated />
            ) : (
              <SingularityLogo
                variant="lockup"
                size="sm"
                animated
                versionBadge="v0.1.3"
                subtitle="NEBULAX STUDIO"
              />
            )}
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-nebula-850 transition-colors"
            title={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-2.5 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                } rounded-xl text-xs font-medium transition-all active:scale-[0.98] ${
                  isActive
                    ? 'bg-nebula-800/90 text-nebula-accent border border-nebula-accent/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-nebula-850 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-nebula-accent' : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!collapsed && item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tabular-nums shrink-0 ${
                      isActive
                        ? 'bg-nebula-accent/20 text-nebula-accent border border-nebula-accent/30'
                        : 'bg-nebula-950 text-slate-400 border border-nebula-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-nebula-800/80 bg-nebula-950/50">
        {collapsed ? (
          <div className="flex justify-center" title="Core Node :3000 Online">
            <span className="w-2.5 h-2.5 rounded-full bg-nebula-accent animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-nebula-accent animate-pulse" />
              <span className="font-mono text-slate-300 font-semibold">Core Node</span>
            </span>
            <span className="font-mono tabular-nums text-slate-500">:3000</span>
          </div>
        )}
      </div>
    </aside>
  );
};
