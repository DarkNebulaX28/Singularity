import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Package,
  Orbit,
  RotateCw,
  Sparkles,
  Key,
  CheckCircle2,
  ShieldAlert,
  Save,
  HardDrive,
  X
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';
import { ContentCard, type CatalogItemData } from '../components/ContentCard.js';
import { ContentInstallModal } from '../components/ContentInstallModal.js';
import type { ServerInstanceData } from '../components/ServerCard.js';
import { isClientOnlyMod } from '../utils/client-mod-filter.js';

interface SearchResponse {
  items: CatalogItemData[];
  totalHits: number;
}

const POPULAR_MODS = [
  { name: 'Chunky', type: 'Pre-generador', category: 'plugin' },
  { name: 'Spark', type: 'Profiler / Anti-lag', category: 'plugin' },
  { name: 'LuckPerms', type: 'Permisos', category: 'plugin' },
  { name: 'WorldEdit', type: 'Construcción', category: 'plugin' },
  { name: 'ViaVersion', type: 'Multi-versión', category: 'plugin' },
  { name: 'EssentialsX', type: 'Comandos', category: 'plugin' },
  { name: 'Lithium', type: 'Físicas Servidor', category: 'mod' },
  { name: 'FerriteCore', type: 'Memoria RAM', category: 'mod' },
  { name: 'Voice Chat', type: 'Proximidad', category: 'plugin' },
  { name: 'Geyser', type: 'Crossplay Bedrock', category: 'plugin' }
];

interface CatalogExplorerProps {
  defaultServerId?: string;
  defaultProjectType?: 'all' | 'mod' | 'plugin' | 'modpack' | 'datapack';
}

export const CatalogExplorer: React.FC<CatalogExplorerProps> = ({
  defaultServerId,
  defaultProjectType = 'all'
}) => {
  const { toast } = useDialog();
  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState<'all' | 'mod' | 'plugin' | 'modpack' | 'datapack'>(defaultProjectType);
  const [provider, setProvider] = useState<'modrinth' | 'curseforge' | 'papermc'>('modrinth');
  const [providersStatus, setProvidersStatus] = useState<{ id: string; name: string; isEnabled: boolean }[]>([]);

  // Target server context in Catalog
  const [servers, setServers] = useState<ServerInstanceData[]>([]);
  const [targetServerId, setTargetServerId] = useState<string>(defaultServerId || '');

  useEffect(() => {
    api.get<ServerInstanceData[]>('/servers')
      .then((list) => {
        if (Array.isArray(list)) {
          setServers(list);
          if (defaultServerId && list.some((s) => s.id === defaultServerId)) {
            setTargetServerId(defaultServerId);
          }
        }
      })
      .catch(() => {});
  }, [defaultServerId]);

  useEffect(() => {
    if (defaultProjectType) {
      setProjectType(defaultProjectType);
    }
  }, [defaultProjectType]);

  // When user picks a target server, auto-switch filter to Plugins or Mods
  const handleSelectTargetServer = (srvId: string) => {
    setTargetServerId(srvId);
    const srv = servers.find((s) => s.id === srvId);
    if (srv) {
      const isPlugin = ['paper', 'purpur', 'spigot', 'bukkit'].includes(srv.loader.toLowerCase());
      setProjectType(isPlugin ? 'plugin' : 'mod');
      toast(
        `Catálogo vinculado a "${srv.name}" (${isPlugin ? 'Modo Plugins /plugins' : `Modo Mods (${srv.loader.toUpperCase()})`})`,
        'info'
      );
    }
  };

  const activeTargetServer = servers.find((s) => s.id === targetServerId);
  const isTargetPluginServer = Boolean(
    activeTargetServer &&
      ['paper', 'purpur', 'spigot', 'bukkit'].includes(activeTargetServer.loader.toLowerCase())
  );

  const [items, setItems] = useState<CatalogItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // CurseForge direct key config
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySuccessMsg, setKeySuccessMsg] = useState<string | null>(null);
  const [curseforgeKeyInfo, setCurseforgeKeyInfo] = useState<{ isConfigured: boolean; masked: string | null } | null>(null);

  // Selected item for 1-Click install modal
  const [itemToInstall, setItemToInstall] = useState<CatalogItemData | null>(null);

  const fetchProvidersStatus = useCallback(() => {
    api.get<{ id: string; name: string; isEnabled: boolean }[]>('/catalog/providers')
      .then((data) => setProvidersStatus(data || []))
      .catch(() => {});

    api.get<{ isConfigured: boolean; masked: string | null }>('/catalog/curseforge-key')
      .then((data) => setCurseforgeKeyInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchProvidersStatus();
  }, [fetchProvidersStatus]);

  const curseforgeStatus = providersStatus.find((p) => p.id === 'curseforge');

  const performSearch = useCallback(async (searchQuery: string, type: string, prov: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('query', searchQuery.trim());
      if (type !== 'all') params.set('projectType', type);
      params.set('provider', prov);

      const res = await api.get<SearchResponse>(`/catalog/search?${params.toString()}`);
      setItems(res.items || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al buscar en el catálogo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, projectType, provider);
    }, 350);

    return () => clearTimeout(timer);
  }, [query, projectType, provider, performSearch]);

  const handleSaveCurseForgeKey = async () => {
    if (!keyInput.trim()) return;

    setIsSavingKey(true);
    setKeySuccessMsg(null);

    try {
      await api.post('/catalog/curseforge-key', { apiKey: keyInput.trim() });
      setKeySuccessMsg('¡API Key guardada exitosamente! Conexión con CurseForge activada.');
      toast('CurseForge API Key vinculada con éxito', 'success');
      setKeyInput('');
      fetchProvidersStatus();
      setTimeout(() => {
        setKeySuccessMsg(null);
        setShowKeyConfig(false);
        performSearch(query, projectType, 'curseforge');
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la clave de CurseForge');
    } finally {
      setIsSavingKey(false);
    }
  };

  const isCurseForgeIssue =
    provider === 'curseforge' &&
    (showKeyConfig || (curseforgeStatus && !curseforgeStatus.isEnabled) || (errorMsg && errorMsg.includes('CurseForge')));

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Package className="w-6 h-6 text-nebula-purple" />
            <span>Catálogo Unificado Singularity</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explora e instala plugins Paper/Spigot, proyectos híbridos (Chunky, Spark, WorldEdit) y mods en 1-clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Target Server Selector Pill */}
          {servers.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-nebula-900 border border-nebula-800 text-xs font-mono">
              <HardDrive className="w-3.5 h-3.5 text-nebula-accent shrink-0" />
              <span className="text-slate-400 text-[11px]">Destino:</span>
              <select
                value={targetServerId}
                onChange={(e) => handleSelectTargetServer(e.target.value)}
                className="bg-transparent text-slate-100 font-bold focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-nebula-950 text-slate-300">
                  Elegir al instalar (Todos)
                </option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id} className="bg-nebula-950 text-slate-100">
                    {s.name} ({s.loader.toUpperCase()} {s.gameVersion})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Provider Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-nebula-900 border border-nebula-800 text-xs font-mono">
            <button
              onClick={() => setProvider('modrinth')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                provider === 'modrinth'
                  ? 'bg-nebula-purple text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Modrinth v2
            </button>
            <button
              onClick={() => setProvider('curseforge')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                provider === 'curseforge'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>CurseForge</span>
              {curseforgeStatus && !curseforgeStatus.isEnabled && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300">
                  Sin Key
                </span>
              )}
            </button>
            <button
              onClick={() => setProvider('papermc')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                provider === 'papermc'
                  ? 'bg-nebula-cyber text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PaperMC
            </button>
          </div>

          {provider === 'curseforge' && (
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="p-2 rounded-lg bg-nebula-900 border border-amber-500/40 text-amber-300 hover:bg-amber-950/50 hover:text-white transition-colors"
              title="Configurar CurseForge API Key directamente"
            >
              <Key className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => performSearch(query, projectType, provider)}
            className="p-2 rounded-lg bg-nebula-900 border border-nebula-800 text-slate-400 hover:text-slate-200"
            title="Refrescar catálogo"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Target Server Banner */}
      {activeTargetServer && (
        <div className="px-4 py-2.5 rounded-xl bg-nebula-900/90 border border-nebula-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-nebula-accent animate-pulse" />
            <span className="text-slate-300">
              Instalando para <strong className="text-white">{activeTargetServer.name}</strong> ({activeTargetServer.loader.toUpperCase()} &bull; MC {activeTargetServer.gameVersion})
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              isTargetPluginServer
                ? 'bg-nebula-cyber/15 text-nebula-cyber border-nebula-cyber/30'
                : 'bg-nebula-purple/15 text-purple-300 border-purple-500/30'
            }`}
          >
            {isTargetPluginServer
              ? 'MODO PLUGIN ACTIVO (/plugins)'
              : `MODO MOD ACTIVO (/mods • ${activeTargetServer.loader.toUpperCase()})`}
          </span>
        </div>
      )}

      {/* CurseForge Direct API Key Panel */}
      {isCurseForgeIssue && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Configuración Directa de CurseForge API Key</span>
            </div>
            {curseforgeKeyInfo?.masked && (
              <span className="text-[10px] font-mono text-slate-400">
                Clave actual: <span className="text-slate-200">{curseforgeKeyInfo.masked}</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Pega tu API Key directamente en Singularity. Esto guarda la clave en el almacenamiento persistente sin que Docker Compose o Coolify trunquen los símbolos <code className="text-amber-400 font-mono">$</code> o <code className="text-amber-400 font-mono">#</code>.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Pega aquí tu CurseForge API Key (ej. $2a$10$...)"
              className="flex-1 px-3 py-2 bg-nebula-950 border border-nebula-800 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={handleSaveCurseForgeKey}
              disabled={isSavingKey || !keyInput.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {isSavingKey ? <Orbit className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Guardar y Probar</span>
            </button>
          </div>

          {keyInput && (
            <div className="text-[10px] font-mono flex flex-wrap items-center gap-2">
              <span className={keyInput.length >= 40 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                Longitud detectada: {keyInput.length} caracteres
              </span>
              {keyInput.length < 40 && (
                <span className="text-amber-300/90 font-sans flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    Aviso: Las claves de CurseForge Eternal suelen tener ~60 caracteres y empezar por <code>$2a$10$</code>.
                  </span>
                </span>
              )}
            </div>
          )}

          {keySuccessMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{keySuccessMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Search Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 shrink-0 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-nebula-accent" />
          Esenciales:
        </span>
        {POPULAR_MODS.map((pm) => (
          <button
            key={pm.name}
            onClick={() => setQuery(pm.name)}
            className={`px-2.5 py-1 rounded-lg font-mono text-xs border transition-colors shrink-0 flex items-center gap-1.5 ${
              query.toLowerCase() === pm.name.toLowerCase()
                ? 'bg-nebula-accent text-slate-950 font-bold border-nebula-accent'
                : 'bg-nebula-950 text-slate-300 border-nebula-800 hover:border-nebula-700 hover:text-white'
            }`}
          >
            <span>{pm.name}</span>
            <span className={`text-[9px] ${query.toLowerCase() === pm.name.toLowerCase() ? 'text-slate-900' : 'text-slate-500'}`}>
              ({pm.type})
            </span>
          </button>
        ))}
      </div>

      {/* Search Input Bar & Type Filter Tabs */}
      <div className="space-y-3">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-nebula-purple absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proyecto (ej. Chunky, Spark, LuckPerms, WorldEdit,ViaVersion, Lithium)..."
            className="w-full pl-10 pr-9 py-2.5 bg-nebula-900 border border-nebula-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nebula-purple transition-colors shadow-inner font-mono"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 p-1 rounded text-slate-500 hover:text-slate-200"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Project Type Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          {[
            { id: 'all' as const, label: 'Todos los Recursos' },
            { id: 'plugin' as const, label: '🔌 Plugins (Paper / Spigot / Bukkit)' },
            { id: 'mod' as const, label: '⚙️ Mods (Fabric / NeoForge / Forge)' },
            { id: 'modpack' as const, label: '📦 Modpacks' },
            { id: 'datapack' as const, label: '🗺️ Datapacks' }
          ].map((type) => {
            const isSelected = projectType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setProjectType(type.id)}
                className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-nebula-800 text-nebula-purple font-bold border-nebula-purple/50 shadow-sm'
                    : 'bg-nebula-950/80 text-slate-400 border-nebula-850 hover:text-slate-200 hover:border-nebula-700'
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && !isCurseForgeIssue && (
        <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Results Grid */}
      {(() => {
        const visibleItems = items.filter((it) => !isClientOnlyMod(it.slug) && !isClientOnlyMod(it.title));

        if (isLoading) {
          return (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-mono">
              <Orbit className="w-7 h-7 text-nebula-purple animate-spin" />
              <span>Buscando en {provider === 'modrinth' ? 'Modrinth' : provider === 'curseforge' ? 'CurseForge' : 'PaperMC'}...</span>
            </div>
          );
        }

        if (visibleItems.length === 0) {
          return (
            <div className="py-20 text-center border border-dashed border-nebula-800 rounded-2xl bg-nebula-900/40 p-8">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-300">
                No se encontraron elementos de servidor
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Los mods exclusivos de cliente han sido filtrados para proteger tus servidores. Prueba con otro término.
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item) => {
              const effectiveItem: CatalogItemData =
                projectType === 'plugin' || isTargetPluginServer
                  ? { ...item, projectType: 'plugin' }
                  : item;
              return (
                <ContentCard
                  key={`${item.providerId}-${item.id}`}
                  item={effectiveItem}
                  onInstall={(it) => setItemToInstall(it)}
                />
              );
            })}
          </div>
        );
      })()}

      {/* 1-Click Install Modal */}
      <ContentInstallModal
        item={itemToInstall}
        defaultServerId={targetServerId || defaultServerId}
        onClose={() => setItemToInstall(null)}
        onSuccess={() => {
          toast('Contenido instalado exitosamente en el servidor', 'success');
        }}
      />
    </div>
  );
};
