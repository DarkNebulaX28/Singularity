import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { api } from './services/api-client.js';
import { Header } from './components/Header.js';
import { Sidebar, type NavTab } from './components/Sidebar.js';
import { CommandPalette } from './components/CommandPalette.js';
import { Dashboard } from './pages/Dashboard.js';
import { ServerDetailPage } from './pages/ServerDetailPage.js';
import { CatalogExplorer } from './pages/CatalogExplorer.js';
import { LoginPage } from './pages/LoginPage.js';
import { UserProfileModal } from './components/UserProfileModal.js';
import { ConnectionSwitcherModal } from './components/ConnectionSwitcherModal.js';
import { UsersManagementPage } from './pages/UsersManagementPage.js';
import { JavaManagerPage } from './pages/JavaManagerPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import type { ServerInstanceData } from './components/ServerCard.js';
import {
  Orbit,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Copy
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, token, isLoading, login, logout } = useAuth();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<NavTab>('servers');

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSftpModalOpen, setIsSftpModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'security'>('profile');
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);

  // Selected Server for Detail View
  const [selectedServer, setSelectedServer] = useState<ServerInstanceData | null>(null);
  const [catalogTargetServerId, setCatalogTargetServerId] = useState<string | undefined>(undefined);
  const [catalogDefaultType, setCatalogDefaultType] = useState<'all' | 'mod' | 'plugin'>('all');
  const [serverCount, setServerCount] = useState<number>(0);

  useEffect(() => {
    if (!token || !user) return;
    api.get<ServerInstanceData[]>('/servers').then((list) => {
      if (Array.isArray(list)) setServerCount(list.length);
    }).catch(() => {});
  }, [token, user, currentTab, isCreateWizardOpen]);

  // Copy feedback
  const [copiedSftp, setCopiedSftp] = useState(false);

  const openProfileModal = (tab: 'profile' | 'security' = 'profile') => {
    setProfileModalTab(tab);
    setIsProfileModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-nebula-950 text-slate-400 gap-3 select-none">
        <Orbit className="w-8 h-8 text-nebula-accent animate-spin" />
        <span className="text-xs font-mono tracking-widest text-slate-500 uppercase">
          Cargando Singularity...
        </span>
      </div>
    );
  }

  // 1. Unauthenticated Login Screen
  if (!token || !user) {
    return (
      <LoginPage
        onLogin={async (uname, pass) => {
          await login(uname, pass);
        }}
      />
    );
  }

  // 2. Main Authenticated Application Layout
  return (
    <div className="h-screen w-screen flex flex-col bg-nebula-950 overflow-hidden">
      {/* Top Header */}
      <Header
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSftpModal={() => setIsSftpModalOpen(true)}
        onOpenProfileModal={() => openProfileModal('profile')}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
      />

      {/* Main Workspace (Sidebar + Content Area) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setSelectedServer(null);
          }}
          serverCount={serverCount}
          isAdmin={user.role === 'ADMIN'}
        />

        <main className={`flex-1 flex flex-col min-h-0 bg-nebula-950/70 ${selectedServer ? 'p-3 sm:p-4 overflow-hidden' : 'p-6 overflow-y-auto'}`}>
          {/* First Login Mandatory Password Change Warning */}
          {user.mustChangePassword && (
            <div className="mb-4 p-4 rounded-xl bg-nebula-warning/10 border border-nebula-warning/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-nebula-warning shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-nebula-warning">
                    Rotación de contraseña requerida
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Estás usando las credenciales por defecto. Por seguridad de tu servidor, debes actualizar tu contraseña.
                  </p>
                </div>
              </div>
              <button
                onClick={() => openProfileModal('security')}
                className="px-3.5 py-1.5 text-xs font-bold bg-nebula-warning text-slate-950 rounded-lg hover:bg-amber-400 transition-colors shadow-sm"
              >
                Actualizar ahora
              </button>
            </div>
          )}

          {/* Tab Views */}
          {currentTab === 'servers' && (
            selectedServer ? (
              <ServerDetailPage
                serverId={selectedServer.id}
                onBack={() => setSelectedServer(null)}
                onNavigateToCatalog={() => {
                  const isPluginLoader = ['paper', 'purpur', 'spigot', 'bukkit'].includes(
                    selectedServer.loader.toLowerCase()
                  );
                  setCatalogTargetServerId(selectedServer.id);
                  setCatalogDefaultType(isPluginLoader ? 'plugin' : 'mod');
                  setSelectedServer(null);
                  setCurrentTab('catalog');
                }}
              />
            ) : (
              <Dashboard
                onSelectServer={(srv) => setSelectedServer(srv)}
                onOpenWizard={() => setIsCreateWizardOpen(true)}
                isWizardOpen={isCreateWizardOpen}
                onCloseWizard={() => setIsCreateWizardOpen(false)}
              />
            )
          )}

          {currentTab === 'catalog' && (
            <CatalogExplorer
              defaultServerId={catalogTargetServerId}
              defaultProjectType={catalogDefaultType}
            />
          )}

          {currentTab === 'users' && (
            <UsersManagementPage />
          )}

          {currentTab === 'java' && (
            <JavaManagerPage />
          )}

          {currentTab === 'settings' && (
            <SettingsPage onOpenProfileModal={(tab) => openProfileModal(tab || 'profile')} />
          )}
        </main>
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onToggle={() => setIsCommandPaletteOpen((prev) => !prev)}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => {
          setCurrentTab(tab);
          setSelectedServer(null);
        }}
        onSelectServer={(srv) => {
          setCurrentTab('servers');
          setSelectedServer(srv);
        }}
        onOpenCreateWizard={() => {
          setSelectedServer(null);
          setCurrentTab('servers');
          setIsCreateWizardOpen(true);
        }}
        onOpenSftpModal={() => setIsSftpModalOpen(true)}
        onOpenPasswordModal={() => openProfileModal('security')}
        onLogout={logout}
      />

      {/* SFTP Guide Modal for Antigravity IDE */}
      {isSftpModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsSftpModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-nebula-900 border border-nebula-750 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-full bg-nebula-cyber" />
            <div className="p-6">
              <div className="flex items-center gap-2.5 text-nebula-cyber font-bold text-sm mb-2">
                <Terminal className="w-5 h-5" />
                <span>Conexión SFTP Directa (Antigravity IDE)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Singularity incluye un servidor SFTP nativo en el puerto 2022. Conéctalo desde Antigravity IDE o VS Code para editar archivos en vivo con latencia cero.
              </p>

              <div className="bg-nebula-950 p-3.5 rounded-xl border border-nebula-800 font-mono text-xs space-y-2 mb-4 tabular-nums">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Host:</span>
                  <span>localhost / IP del VPS</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Puerto SFTP:</span>
                  <span className="text-nebula-accent font-semibold">2022</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Usuario:</span>
                  <span>{user.username}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Raíz de Servidores:</span>
                  <span className="text-slate-400">/data/servers</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    const sftpHost = window.location.hostname || 'localhost';
                    navigator.clipboard.writeText(`sftp://${user.username}@${sftpHost}:2022`);
                    setCopiedSftp(true);
                    setTimeout(() => setCopiedSftp(false), 2000);
                  }}
                  className="flex items-center gap-1.5 text-xs font-mono text-nebula-cyber hover:text-cyan-300 transition-colors"
                >
                  {copiedSftp ? <CheckCircle2 className="w-3.5 h-3.5 text-nebula-accent" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSftp ? '¡URI Copiada!' : 'Copiar URI SFTP'}</span>
                </button>
                <button
                  onClick={() => setIsSftpModalOpen(false)}
                  className="px-4 py-1.5 bg-nebula-800 hover:bg-nebula-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile & Security Personalization Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        initialTab={profileModalTab}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Server & Environment Connection Switcher Modal */}
      <ConnectionSwitcherModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
      />
    </div>
  );
};
