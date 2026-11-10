import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Terminal as TerminalIcon,
  Sliders,
  Package,
  HardDrive,
  Code2,
  Download,
  Copy,
  Check,
  Activity,
  AlertTriangle,
  X,
  ChevronDown,
  FolderOpen,
  Archive,
  Clock
} from 'lucide-react';
import { api } from '../services/api-client.js';
import type { ServerInstanceData } from '../components/ServerCard.js';
import { ConsoleTerminal } from '../components/ConsoleTerminal.js';
import { PlayerManager, type PlayerData } from '../components/PlayerManager.js';
import { CrashAlertBanner, type CrashDiagnosticData } from '../components/CrashAlertBanner.js';
import { InstalledContentList } from '../components/InstalledContentList.js';
import { PropertiesEditor } from '../components/PropertiesEditor.js';
import { FileManager } from '../components/FileManager.js';
import { BackupManager } from '../components/BackupManager.js';
import { TaskScheduler } from '../components/TaskScheduler.js';

interface ServerDetailPageProps {
  serverId: string;
  onBack: () => void;
  onNavigateToCatalog?: () => void;
}

export const ServerDetailPage: React.FC<ServerDetailPageProps> = ({
  serverId,
  onBack,
  onNavigateToCatalog
}) => {
  const [server, setServer] = useState<ServerInstanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'console' | 'files' | 'properties' | 'content' | 'backups' | 'scheduler'>('console');
  const [activeCrash, setActiveCrash] = useState<CrashDiagnosticData | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [isDownloadingJar, setIsDownloadingJar] = useState(false);
  const [jarDownloadMsg, setJarDownloadMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [copiedSftp, setCopiedSftp] = useState(false);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [metrics, setMetrics] = useState<{ cpuPercent: number; memoryBytes: number; uptimeSeconds: number } | null>(null);

  // Desktop IDE Bridge Integration: Available in Electron or when running locally on host
  const isDesktop = typeof window !== 'undefined' && (
    Boolean((window as any).singularityDesktop?.isElectron) ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
  const [availableIdes, setAvailableIdes] = useState<Array<{ id: string; name: string; isAvailable: boolean }>>([]);
  const [isIdeMenuOpen, setIsIdeMenuOpen] = useState(false);
  const [ideFeedbackMsg, setIdeFeedbackMsg] = useState<string | null>(null);
  const ideMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDesktop) {
      const desktopApi = (window as any).singularityDesktop;
      if (desktopApi?.getAvailableIdes) {
        desktopApi.getAvailableIdes().then((ides: Array<{ id: string; name: string; isAvailable: boolean }>) => {
          setAvailableIdes(ides);
        }).catch(() => {});
      } else {
        api.get<Array<{ id: string; name: string; isAvailable: boolean }>>('/servers/ides').then((ides) => {
          setAvailableIdes(ides);
        }).catch(() => {});
      }
    }
  }, [isDesktop]);

  // Click outside to close IDE dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ideMenuRef.current && !ideMenuRef.current.contains(e.target as Node)) {
        setIsIdeMenuOpen(false);
      }
    };
    if (isIdeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isIdeMenuOpen]);

  const handleStatusChange = useCallback((status: string) => {
    setServer((prev) => (prev ? { ...prev, status: status as ServerInstanceData['status'] } : prev));
  }, []);

  const handlePlayerEvent = useCallback((event: unknown) => {
    const ev = event as { type: string; username: string };
    if (ev.type === 'join') {
      setPlayers((prev) => [...prev.filter((p) => p.username !== ev.username), { username: ev.username, joinedAt: new Date().toISOString() }]);
    } else if (ev.type === 'leave') {
      setPlayers((prev) => prev.filter((p) => p.username !== ev.username));
    }
  }, []);

  const handleOpenInIde = async (preferred?: string) => {
    if (!server) return;
    const desktopApi = (window as any).singularityDesktop;
    const ideToUse = preferred || localStorage.getItem('singularity_preferred_ide') || 'antigravity';
    setIsIdeMenuOpen(false);

    try {
      if (desktopApi?.openInIde) {
        try {
          const res = await desktopApi.openInIde(server.id, ideToUse);
          if (res.success) {
            localStorage.setItem('singularity_preferred_ide', ideToUse);
            setIdeFeedbackMsg(`Abierto en ${res.ideUsed}`);
            setTimeout(() => setIdeFeedbackMsg(null), 3000);
            return;
          } else {
            setActionErrorMsg(res.error || 'No se pudo abrir el editor seleccionado.');
            return;
          }
        } catch {
          // Fall through to REST API if desktop IPC has issues
        }
      }

      const res = await api.post<{ success: boolean; ideUsed: string; error?: string }>(`/servers/${server.id}/open-ide`, { ide: ideToUse });
      if (res.success) {
        localStorage.setItem('singularity_preferred_ide', ideToUse);
        setIdeFeedbackMsg(`Abierto en ${res.ideUsed}`);
        setTimeout(() => setIdeFeedbackMsg(null), 3000);
      } else {
        setActionErrorMsg(res.error || 'No se pudo abrir el editor seleccionado.');
      }
    } catch (err: unknown) {
      setActionErrorMsg(err instanceof Error ? err.message : 'Error al invocar IDE');
    }
  };

  const copySftp = () => {
    const sftpHost = window.location.hostname || 'localhost';
    navigator.clipboard.writeText(`sftp://admin@${sftpHost}:2022`);
    setCopiedSftp(true);
    setTimeout(() => setCopiedSftp(false), 2000);
  };

  const handleDownloadJar = async () => {
    if (!server) return;
    setIsDownloadingJar(true);
    setJarDownloadMsg(null);
    setActionErrorMsg(null);
    try {
      const res = await api.post<{ message: string }>(`/servers/${server.id}/download-jar`);
      setJarDownloadMsg(res.message || 'server.jar descargado exitosamente');
      setTimeout(() => setJarDownloadMsg(null), 6000);
    } catch (err: unknown) {
      setActionErrorMsg(err instanceof Error ? err.message : 'Error al descargar server.jar');
    } finally {
      setIsDownloadingJar(false);
    }
  };

  const fetchServerDetails = useCallback(async () => {
    try {
      const data = await api.get<
        ServerInstanceData & {
          players?: PlayerData[];
          metrics?: { cpuPercent: number; memoryBytes: number; uptimeSeconds: number } | null;
        }
      >(`/servers/${serverId}`);
      setServer(data);
      if (Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      setMetrics(data.metrics ?? null);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchServerDetails();
    const interval = setInterval(fetchServerDetails, 3000);
    return () => clearInterval(interval);
  }, [fetchServerDetails]);

  if (isLoading || !server) {
    return (
      <div className="py-20 text-center text-xs font-mono text-slate-500">
        Cargando detalles de la instancia {serverId}...
      </div>
    );
  }

  const isOnline = server.status === 'online';

  const handleStart = async () => {
    setIsActing(true);
    setActionErrorMsg(null);
    try {
      await api.post(`/servers/${server.id}/start`);
      fetchServerDetails();
    } catch (err: unknown) {
      setActionErrorMsg(err instanceof Error ? err.message : 'Error al iniciar servidor');
    } finally {
      setIsActing(false);
    }
  };

  const handleStop = async () => {
    setIsActing(true);
    setActionErrorMsg(null);
    try {
      await api.post(`/servers/${server.id}/stop`);
      fetchServerDetails();
    } catch (err: unknown) {
      setActionErrorMsg(err instanceof Error ? err.message : 'Error al detener servidor');
    } finally {
      setIsActing(false);
    }
  };

  const handleRestart = async () => {
    setIsActing(true);
    setActionErrorMsg(null);
    try {
      await api.post(`/servers/${server.id}/restart`);
      fetchServerDetails();
    } catch (err: unknown) {
      setActionErrorMsg(err instanceof Error ? err.message : 'Error al reiniciar servidor');
    } finally {
      setIsActing(false);
    }
  };

  const statusConfig = {
    online: { label: 'ONLINE', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    starting: { label: 'INICIANDO', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    stopping: { label: 'DETENIENDO', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
    crashed: { label: 'CRASHED', bg: 'bg-red-500/10 text-red-400 border-red-500/30' },
    offline: { label: 'OFFLINE', bg: 'bg-slate-800 text-slate-400 border-slate-700' }
  }[server.status] ?? { label: server.status.toUpperCase(), bg: 'bg-slate-800 text-slate-400 border-slate-700' };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-nebula-900 border border-nebula-800 text-slate-400 hover:text-slate-100 hover:bg-nebula-850 transition-colors"
            title="Volver a Mission Control"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-100">{server.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusConfig.bg}`}>
                {statusConfig.label}
              </span>
              {isOnline && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  {metrics
                    ? `CPU ${metrics.cpuPercent.toFixed(1)}% • RAM ${Math.round(metrics.memoryBytes / (1024 * 1024))} / ${server.memoryMb} MB`
                    : '20.0 TPS'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-slate-400">
              <span className="text-nebula-cyber font-semibold">{server.loader.toUpperCase()} {server.gameVersion}</span>
              <span>&bull;</span>
              <span>Puerto: {server.port}</span>
              <span>&bull;</span>
              <span>RAM: {server.memoryMb} MB</span>
              {server.pid && <span>&bull; PID: {server.pid}</span>}
            </div>
          </div>
        </div>

        {/* Server Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Direct Jar Downloader for offline servers */}
          {!isOnline && (
            <button
              type="button"
              disabled={isDownloadingJar}
              onClick={handleDownloadJar}
              className="px-3 py-2 rounded-lg bg-nebula-900 hover:bg-nebula-850 text-slate-300 border border-nebula-800 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Descargar o verificar server.jar desde el repositorio oficial"
            >
              {isDownloadingJar ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-nebula-accent border-t-transparent rounded-full animate-spin" />
                  <span>Descargando Jar...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-nebula-accent" />
                  <span>Instalar Jar</span>
                </>
              )}
            </button>
          )}

          {/* Desktop IDE Selector Button & Dropdown */}
          {isDesktop && (
            <div className="relative inline-flex items-center" ref={ideMenuRef}>
              <button
                type="button"
                onClick={() => handleOpenInIde()}
                className="px-3 py-2 rounded-l-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-r-0 border-nebula-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                title="Abrir directorio de la instancia en tu editor preferido"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{ideFeedbackMsg || 'Abrir en IDE'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsIdeMenuOpen((prev) => !prev)}
                className="px-1.5 py-2 rounded-r-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-nebula-700 font-semibold text-xs flex items-center transition-colors"
                title="Seleccionar editor o explorador"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isIdeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isIdeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-nebula-900 border border-nebula-750 shadow-2xl z-50 py-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider border-b border-nebula-800 mb-1">
                    Abrir instancia en:
                  </div>
                  {availableIdes.length > 0 ? (
                    availableIdes.map((ide) => (
                      <button
                        key={ide.id}
                        type="button"
                        onClick={() => handleOpenInIde(ide.id)}
                        className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-slate-200 hover:bg-nebula-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {ide.id === 'explorer' ? (
                            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Code2 className="w-3.5 h-3.5 text-nebula-cyber" />
                          )}
                          <span className="font-medium">{ide.name}</span>
                        </div>
                        {ide.isAvailable ? (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Listo
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            No detectado
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenInIde('antigravity')}
                        className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-200 hover:bg-nebula-800/80"
                      >
                        <Code2 className="w-3.5 h-3.5 text-nebula-cyber" />
                        <span>Antigravity IDE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInIde('vscode')}
                        className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-200 hover:bg-nebula-800/80"
                      >
                        <Code2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Visual Studio Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInIde('explorer')}
                        className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-200 hover:bg-nebula-800/80"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>Explorador de Archivos</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isOnline ? (
            <>
              <button
                disabled={isActing}
                onClick={handleStop}
                className="px-3.5 py-2 rounded-lg bg-orange-950/40 hover:bg-orange-900/60 text-orange-400 border border-orange-500/30 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Detener (/stop)</span>
              </button>
              <button
                disabled={isActing}
                onClick={handleRestart}
                className="px-3.5 py-2 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-200 border border-nebula-700 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            </>
          ) : (
            <button
              disabled={isActing}
              onClick={handleStart}
              className="px-4 py-2 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-nebula-accent/20 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Servidor</span>
            </button>
          )}
        </div>
      </div>

      {jarDownloadMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{jarDownloadMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">No se pudo completar la operación:</p>
              <p className="mt-0.5 text-rose-100">{actionErrorMsg}</p>
              {actionErrorMsg.includes('SFTP') && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copySftp}
                    className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                  >
                    {copiedSftp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar URL de SFTP (:2022)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionErrorMsg(null)}
            className="p-1 hover:bg-rose-900/50 rounded text-rose-300 shrink-0"
            title="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Crash Alert Banner */}
      {activeCrash && (
        <CrashAlertBanner
          diagnostic={activeCrash}
          onDismiss={() => setActiveCrash(null)}
          onAction={(code) => {
            if (code === 'OUT_OF_MEMORY') {
              setActiveTab('properties');
            }
          }}
        />
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-nebula-800 shrink-0 text-xs">
        {[
          { id: 'console' as const, label: 'Consola y Jugadores', icon: TerminalIcon },
          { id: 'files' as const, label: 'Archivos', icon: FolderOpen },
          { id: 'properties' as const, label: 'server.properties', icon: Sliders },
          { id: 'content' as const, label: 'Mods y Plugins', icon: Package },
          { id: 'backups' as const, label: 'Copias de Seguridad', icon: Archive },
          { id: 'scheduler' as const, label: 'Tareas Programadas', icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-nebula-accent text-nebula-accent font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'console' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 h-full min-h-0">
            {/* Main Interactive Terminal View (3 Cols) */}
            <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
              <ConsoleTerminal
                serverId={server.id}
                isOnline={isOnline}
                onCrashDetected={(diag) => setActiveCrash(diag)}
                onStatusChange={handleStatusChange}
                onPlayerEvent={handlePlayerEvent}
              />
            </div>

            {/* Right Side Player Manager & Stats (1 Col) */}
            <div className="h-full min-h-0 flex flex-col gap-3 overflow-hidden">
              <div className="flex-1 min-h-0">
                <PlayerManager
                  serverId={server.id}
                  isOnline={isOnline}
                  players={players}
                  onPlayerActionSent={() => fetchServerDetails()}
                />
              </div>

              {/* Quick Info Box */}
              <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-3 text-xs text-slate-400 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-nebula-cyber" />
                    <span>Almacenamiento Local</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">EULA OK</span>
                </div>

                <div className="flex justify-between font-mono text-[11px]">
                  <span>Instancia:</span>
                  <span className="text-slate-300 truncate max-w-[150px]">{server.id}</span>
                </div>

                <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-nebula-850">
                  <span className="text-slate-400">Acceso SFTP:</span>
                  <button
                    type="button"
                    onClick={copySftp}
                    className="flex items-center gap-1 text-nebula-cyber hover:text-white transition-colors"
                    title="Copiar comando SFTP"
                  >
                    <span>:2022</span>
                    {copiedSftp ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="h-full overflow-y-auto pr-1">
            <PropertiesEditor
              serverId={server.id}
              serverName={server.name}
              onSaved={() => fetchServerDetails()}
            />
          </div>
        )}

        {activeTab === 'content' && (
          <div className="h-full overflow-y-auto">
            <InstalledContentList
              serverId={server.id}
              loader={server.loader}
              onExploreCatalog={() => onNavigateToCatalog?.()}
            />
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full overflow-hidden">
            <FileManager serverId={server.id} />
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="h-full overflow-hidden">
            <BackupManager serverId={server.id} isOnline={isOnline} />
          </div>
        )}

        {activeTab === 'scheduler' && (
          <div className="h-full overflow-hidden">
            <TaskScheduler serverId={server.id} />
          </div>
        )}
      </div>
    </div>
  );
};
