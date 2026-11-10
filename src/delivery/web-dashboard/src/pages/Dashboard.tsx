import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Server,
  Plus,
  HardDrive,
  Activity,
  RotateCw,
  Search,
  Copy,
  Check,
  Play,
  Square
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';
import { ServerCard, type ServerInstanceData } from '../components/ServerCard.js';
import { CreateServerWizard } from './CreateServerWizard.js';

interface DashboardProps {
  onSelectServer: (server: ServerInstanceData) => void;
  onOpenWizard: () => void;
  isWizardOpen: boolean;
  onCloseWizard: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectServer,
  onOpenWizard,
  isWizardOpen,
  onCloseWizard
}) => {
  const { confirm, toast } = useDialog();
  const [servers, setServers] = useState<ServerInstanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [copiedSftp, setCopiedSftp] = useState(false);

  const handleCopySftp = () => {
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
    navigator.clipboard.writeText(`sftp://admin@${host}:2022`);
    setCopiedSftp(true);
    toast('URI SFTP (:2022) copiada al portapapeles', 'success');
    setTimeout(() => setCopiedSftp(false), 2000);
  };

  const fetchServers = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const data = await api.get<ServerInstanceData[]>('/servers');
      setServers(data);
    } catch {
      // ignore transient polling errors
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();

    // Live status polling every 3 seconds
    const interval = setInterval(() => {
      fetchServers(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchServers]);

  const handleStartAll = async () => {
    const offlineServers = servers.filter((s) => s.status === 'offline' || s.status === 'crashed');
    if (offlineServers.length === 0) {
      toast('Todos los servidores ya están en línea o iniciando', 'info');
      return;
    }

    const ok = await confirm({
      title: 'Iniciar Flota de Servidores',
      message: `¿Deseas arrancar simultáneamente ${offlineServers.length} instancia(s) detenida(s)?`,
      confirmLabel: `Iniciar (${offlineServers.length})`,
      variant: 'info'
    });
    if (!ok) return;

    setIsBatchRunning(true);
    try {
      await Promise.allSettled(offlineServers.map((s) => api.post(`/servers/${s.id}/start`)));
      toast(`Secuencia de arranque enviada a ${offlineServers.length} servidor(es)`, 'success');
      fetchServers(true);
    } finally {
      setIsBatchRunning(false);
    }
  };

  const handleStopAll = async () => {
    const activeServers = servers.filter((s) => s.status === 'online' || s.status === 'starting');
    if (activeServers.length === 0) return;

    const ok = await confirm({
      title: 'Detener Todos los Servidores',
      message: `¿Confirmas el apagado ordenado (/stop) de las ${activeServers.length} instancia(s) actualmente en línea?`,
      confirmLabel: `Detener Todos (${activeServers.length})`,
      variant: 'warning'
    });
    if (!ok) return;

    setIsBatchRunning(true);
    try {
      await Promise.allSettled(activeServers.map((s) => api.post(`/servers/${s.id}/stop`)));
      toast(`Orden de parada enviada a ${activeServers.length} servidor(es)`, 'info');
      fetchServers(true);
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Filtered servers list
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      if (statusFilter === 'online' && s.status !== 'online') return false;
      if (statusFilter === 'offline' && s.status === 'online') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesLoader = s.loader.toLowerCase().includes(q);
        const matchesVersion = s.gameVersion.toLowerCase().includes(q);
        const matchesPort = s.port.toString().includes(q);
        return matchesName || matchesLoader || matchesVersion || matchesPort;
      }
      return true;
    });
  }, [servers, statusFilter, searchQuery]);

  // Aggregate Metrics
  const onlineCount = servers.filter((s) => s.status === 'online').length;
  const startingCount = servers.filter((s) => s.status === 'starting').length;
  const totalMemoryAllocatedMb = servers.reduce((acc, s) => acc + s.memoryMb, 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Server className="w-6 h-6 text-nebula-accent" />
            <span>Mission Control</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums bg-nebula-900 border border-nebula-800 text-nebula-cyber uppercase">
              FLOTA: {servers.length} NODOS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Panel de control central, orquestación multi-instancia y telemetría en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {servers.length > 1 && (
            <div className="flex items-center gap-1.5 mr-1">
              <button
                type="button"
                disabled={isBatchRunning || onlineCount === servers.length}
                onClick={handleStartAll}
                className="px-2.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                title="Iniciar todas las instancias detenidas"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Iniciar Todos</span>
              </button>
              {onlineCount > 0 && (
                <button
                  type="button"
                  disabled={isBatchRunning}
                  onClick={handleStopAll}
                  className="px-2.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Detener ordenadamente todas las instancias activas"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Detener Todos</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => fetchServers()}
            className="p-2 rounded-xl bg-nebula-900 border border-nebula-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refrescar telemetría de flota"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-nebula-cyber' : ''}`} />
          </button>

          <button
            onClick={onOpenWizard}
            className="flex items-center gap-2 px-4 py-2 bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-nebula-accent/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Servidor</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Servers */}
        <div className="bg-nebula-900/90 border border-nebula-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400">Servidores Activos</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1 flex items-baseline gap-2">
              <span className="text-nebula-accent">{onlineCount}</span>
              <span className="text-xs text-slate-500">/ {servers.length} total</span>
            </div>
            {startingCount > 0 && (
              <span className="text-[10px] text-amber-400 font-mono mt-0.5 block">
                {startingCount} iniciando...
              </span>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-nebula-accent/10 border border-nebula-accent/20 flex items-center justify-center text-nebula-accent">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Total RAM Assigned */}
        <div className="bg-nebula-900/90 border border-nebula-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400">Memoria RAM Reservada</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
              {(totalMemoryAllocatedMb / 1024).toFixed(1)} <span className="text-xs text-slate-500 font-sans font-normal">GB</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5 block">
              {totalMemoryAllocatedMb} MB en instancias
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-nebula-cyber/10 border border-nebula-cyber/20 flex items-center justify-center text-nebula-cyber">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        {/* SFTP Status */}
        <div className="bg-nebula-900/90 border border-nebula-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400">Servicio SFTP Embebido</span>
            <div className="text-base font-bold font-mono tabular-nums text-emerald-400 mt-1 flex items-center gap-2">
              <span>Activo :2022</span>
              <button
                type="button"
                onClick={handleCopySftp}
                className="px-2 py-0.5 rounded bg-nebula-950 hover:bg-nebula-800 border border-nebula-800 text-[10px] font-mono text-nebula-cyber flex items-center gap-1 transition-colors"
                title="Copiar URI SFTP para Antigravity IDE o VS Code"
              >
                {copiedSftp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSftp ? 'Copiado' : 'Copiar URI'}</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Listo para Antigravity IDE / VS Code
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-nebula-purple/10 border border-nebula-purple/20 flex items-center justify-center text-nebula-purple font-mono font-bold text-xs">
            SFTP
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {servers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, loader, versión o puerto..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-nebula-900 border border-nebula-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nebula-accent font-mono transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-nebula-900 border border-nebula-800 text-xs font-mono tabular-nums self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-nebula-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({servers.length})
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === 'online'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              En Línea ({onlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === 'offline'
                  ? 'bg-slate-800 text-slate-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Detenidos ({servers.length - onlineCount})
            </button>
          </div>
        </div>
      )}

      {/* Servers Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-500 font-mono">
          Cargando instancias de servidor...
        </div>
      ) : servers.length === 0 ? (
        <div className="border border-dashed border-nebula-800 rounded-2xl p-12 text-center bg-nebula-900/40">
          <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">
            No tienes servidores desplegados
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Crea tu primera instancia de Minecraft (PaperMC, Purpur, Spigot, Fabric, Forge, NeoForge, Quilt o Vanilla Oficial) con nuestro asistente guiado.
          </p>
          <button
            onClick={onOpenWizard}
            className="px-4 py-2 bg-nebula-accent text-slate-950 text-xs font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-nebula-accent/20"
          >
            Abrir Asistente de Creación
          </button>
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-nebula-800 rounded-xl bg-nebula-900/30">
          <p className="text-xs font-mono text-slate-400">
            No hay servidores que coincidan con los filtros aplicados.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-2 text-xs text-nebula-accent hover:underline font-mono"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map((srv) => (
            <ServerCard
              key={srv.id}
              server={srv}
              onRefresh={() => fetchServers(true)}
              onSelect={onSelectServer}
            />
          ))}
        </div>
      )}

      {/* Creation Wizard Modal */}
      <CreateServerWizard
        isOpen={isWizardOpen}
        onClose={onCloseWizard}
        onSuccess={() => {
          fetchServers();
        }}
      />
    </div>
  );
};
