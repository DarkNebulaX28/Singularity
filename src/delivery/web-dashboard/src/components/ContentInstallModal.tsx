import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Orbit,
  HardDrive,
  ShieldAlert,
  FolderCheck,
  Sparkles,
  Layers,
  Cpu
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { isClientOnlyMod } from '../utils/client-mod-filter.js';
import type { CatalogItemData } from './ContentCard.js';
import type { ServerInstanceData } from './ServerCard.js';

interface ContentInstallModalProps {
  item: CatalogItemData | null;
  defaultServerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ContentVersionData {
  id: string;
  versionNumber: string;
  fileName: string;
  downloadUrl: string;
  gameVersions: string[];
  loaders: string[];
}

export const ContentInstallModal: React.FC<ContentInstallModalProps> = ({
  item,
  defaultServerId,
  onClose,
  onSuccess
}) => {
  const [servers, setServers] = useState<ServerInstanceData[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string>(defaultServerId || '');
  const [versions, setVersions] = useState<ContentVersionData[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deployment Mode: 'new_server' or 'existing_server'
  const isModpack = item?.projectType === 'modpack';
  const [installMode, setInstallMode] = useState<'new_server' | 'existing_server'>('existing_server');

  // New Server Form States
  const [newServerName, setNewServerName] = useState('');
  const [newServerLoader, setNewServerLoader] = useState<
    'fabric' | 'forge' | 'neoforge' | 'paper' | 'purpur' | 'spigot' | 'vanilla'
  >('paper');
  const [newServerGameVersion, setNewServerGameVersion] = useState('1.21.4');
  const [newServerMemoryMb, setNewServerMemoryMb] = useState(6144);
  const [newServerPort, setNewServerPort] = useState(25565);
  const [deployStep, setDeployStep] = useState<string | null>(null);

  // Load servers and set defaults before fetching versions
  useEffect(() => {
    let active = true;
    setIsLoadingServers(true);
    api
      .get<ServerInstanceData[]>('/servers')
      .then((data) => {
        if (!active) return;
        const list = data || [];
        setServers(list);
        if (defaultServerId) {
          setSelectedServerId(defaultServerId);
        } else if (list.length > 0 && !selectedServerId && list[0]) {
          setSelectedServerId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingServers(false);
      });
    return () => {
      active = false;
    };
  }, [defaultServerId]);

  // Set default mode, preferred target server & loader when item is opened
  useEffect(() => {
    if (!item) return;
    setNewServerName(item.title);

    if (defaultServerId && servers.some((s) => s.id === defaultServerId)) {
      setSelectedServerId(defaultServerId);
    } else if (servers.length > 0) {
      if (item.projectType === 'plugin') {
        // Prefer the most recently created plugin server (Paper/Purpur/Spigot)
        const pluginServers = servers.filter((s) =>
          ['paper', 'purpur', 'spigot', 'bukkit'].includes(s.loader.toLowerCase())
        );
        const preferred = pluginServers[pluginServers.length - 1] || servers[servers.length - 1];
        if (preferred) setSelectedServerId(preferred.id);
      } else if (item.projectType === 'mod') {
        const modServers = servers.filter((s) =>
          ['fabric', 'neoforge', 'forge', 'quilt'].includes(s.loader.toLowerCase())
        );
        const preferred = modServers[modServers.length - 1] || servers[servers.length - 1];
        if (preferred) setSelectedServerId(preferred.id);
      } else {
        const latest = servers[servers.length - 1];
        if (latest) setSelectedServerId(latest.id);
      }
    }

    if (item.projectType === 'modpack') {
      setInstallMode('new_server');
      setNewServerLoader('fabric');
    } else if (item.projectType === 'plugin') {
      setInstallMode(servers.length > 0 ? 'existing_server' : 'new_server');
      setNewServerLoader('paper');
    } else {
      setInstallMode(servers.length > 0 ? 'existing_server' : 'new_server');
      setNewServerLoader('fabric');
    }
  }, [item, servers, defaultServerId]);

  const targetServer = servers.find((s) => s.id === selectedServerId);
  const effectiveLoader =
    installMode === 'existing_server' ? targetServer?.loader : newServerLoader;
  const effectiveGameVersion =
    installMode === 'existing_server' ? targetServer?.gameVersion : newServerGameVersion;

  const isPluginServer = Boolean(
    effectiveLoader && ['paper', 'purpur', 'spigot', 'bukkit'].includes(effectiveLoader.toLowerCase())
  );

  // Fetch real available versions from backend filtered strictly by target loader & gameVersion
  useEffect(() => {
    if (!item) return;
    // Wait until servers list is loaded in existing_server mode so we don't fire an unfiltered query
    if (installMode === 'existing_server' && isLoadingServers) return;
    if (installMode === 'existing_server' && servers.length > 0 && !targetServer) return;

    let cancelled = false;
    setIsLoadingVersions(true);
    setErrorMsg(null);

    const queryParams = new URLSearchParams();
    if (installMode === 'existing_server' && targetServer) {
      queryParams.set('gameVersion', targetServer.gameVersion);
      queryParams.set('loader', targetServer.loader);
    } else if (installMode === 'new_server' && !isModpack) {
      if (newServerGameVersion.trim()) {
        queryParams.set('gameVersion', newServerGameVersion.trim());
      }
      queryParams.set('loader', newServerLoader);
    }

    api
      .get<ContentVersionData[]>(
        `/catalog/versions/${item.providerId}/${encodeURIComponent(item.id)}?${queryParams.toString()}`
      )
      .then((data) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          setVersions(data);
          setSelectedVersionId(data[0]!.id);
        } else {
          setVersions([]);
          setSelectedVersionId('');
          setErrorMsg('No se encontraron versiones compatibles con este motor/versión.');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error al obtener versiones de contenido';
        setErrorMsg(msg);
        setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVersions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    item,
    installMode,
    isLoadingServers,
    servers.length,
    selectedServerId,
    targetServer?.gameVersion,
    targetServer?.loader,
    newServerLoader,
    newServerGameVersion,
    isModpack
  ]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || versions[0];

  // Auto-detect Loader & GameVersion ONLY when deploying a Modpack
  useEffect(() => {
    if (isModpack && selectedVersion) {
      if (selectedVersion.loaders && selectedVersion.loaders.length > 0) {
        const found = selectedVersion.loaders.find((l) =>
          ['fabric', 'forge', 'neoforge', 'paper', 'purpur', 'spigot', 'quilt', 'vanilla'].includes(
            l.toLowerCase()
          )
        );
        if (found) {
          const l = found.toLowerCase();
          setNewServerLoader(l === 'quilt' ? 'fabric' : (l as any));
        }
      }

      if (selectedVersion.gameVersions && selectedVersion.gameVersions.length > 0) {
        const foundMc = selectedVersion.gameVersions.find((v) => /^\d+\.\d+(\.\d+)?$/.test(v));
        if (foundMc) {
          setNewServerGameVersion(foundMc);
        }
      }
    }
  }, [isModpack, selectedVersion]);

  if (!item) return null;

  // Client-only mod check
  const isClientMod =
    !isPluginServer &&
    (item.projectType === 'mod' || !item.projectType) &&
    (isClientOnlyMod(item.slug) ||
      isClientOnlyMod(item.title) ||
      (selectedVersion ? isClientOnlyMod(selectedVersion.fileName) : false));

  // Determine smart target subfolder
  const targetSubfolder =
    isPluginServer || item.projectType === 'plugin'
      ? 'plugins'
      : item.projectType === 'datapack'
      ? 'datapacks'
      : item.projectType === 'modpack'
      ? ''
      : 'mods';

  const handleInstall = async () => {
    if (!selectedVersion) return;

    setIsInstalling(true);
    setErrorMsg(null);

    try {
      if (installMode === 'new_server') {
        setDeployStep('Creando instancia del servidor...');
        const newServer = await api.post<ServerInstanceData>('/servers', {
          name: newServerName.trim() || item.title,
          loader: newServerLoader,
          gameVersion: newServerGameVersion,
          memoryMb: newServerMemoryMb,
          port: newServerPort
        });

        const resolvedType = isModpack
          ? 'modpack'
          : ['paper', 'purpur', 'spigot'].includes(newServerLoader)
          ? 'plugin'
          : item.projectType;

        setDeployStep(
          resolvedType === 'modpack'
            ? 'Descargando y extrayendo modpack (omitiendo mods de cliente)...'
            : `Instalando ${resolvedType === 'plugin' ? 'plugin en /plugins' : 'mod en /mods'}...`
        );

        await api.post('/catalog/install', {
          instanceId: newServer.id,
          providerId: item.providerId,
          projectId: item.id,
          projectType: resolvedType,
          versionId: selectedVersion.id,
          versionNumber: selectedVersion.versionNumber,
          fileName: selectedVersion.fileName,
          downloadUrl: selectedVersion.downloadUrl
        });

        setSuccessMsg(`¡Servidor "${newServer.name}" creado y ${item.title} instalado exitosamente!`);
      } else {
        if (!selectedServerId) {
          setErrorMsg('Selecciona un servidor de destino');
          setIsInstalling(false);
          return;
        }

        await api.post('/catalog/install', {
          instanceId: selectedServerId,
          providerId: item.providerId,
          projectId: item.id,
          projectType: isPluginServer ? 'plugin' : item.projectType,
          versionId: selectedVersion.id,
          versionNumber: selectedVersion.versionNumber,
          fileName: selectedVersion.fileName,
          downloadUrl: selectedVersion.downloadUrl
        });

        setSuccessMsg(
          `¡${item.title} (${selectedVersion.fileName}) instalado exitosamente en /${targetSubfolder || 'raíz'}!`
        );
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar la instalación');
    } finally {
      setIsInstalling(false);
      setDeployStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-nebula-900 border border-nebula-750 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-nebula-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{isModpack ? 'Desplegar Modpack' : `Instalar ${isPluginServer ? 'Plugin' : 'Contenido'}`}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                  isPluginServer
                    ? 'bg-nebula-cyber/15 text-nebula-cyber border-nebula-cyber/30'
                    : 'bg-nebula-purple/15 text-purple-300 border-purple-500/30'
                }`}
              >
                {isPluginServer ? 'Modo Plugin (Paper/Bukkit)' : `Modo ${effectiveLoader?.toUpperCase() || 'Mod'}`}
              </span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {item.title} &bull; {item.providerId.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-nebula-850"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Install Mode Switcher Tabs */}
        <div className="flex p-1 rounded-xl bg-nebula-950 border border-nebula-800 mb-4 text-xs font-mono">
          <button
            type="button"
            onClick={() => setInstallMode('existing_server')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              installMode === 'existing_server'
                ? 'bg-nebula-800 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-nebula-accent" />
            <span>Instalar en Servidor Existente</span>
          </button>
          <button
            type="button"
            onClick={() => setInstallMode('new_server')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              installMode === 'new_server'
                ? 'bg-nebula-purple text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-nebula-accent" />
            <span>Crear Nuevo Servidor</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Client-Only Mod Warning */}
        {isClientMod && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-300">Mod exclusivo de cliente:</span> Este mod es solo para el cliente de Minecraft. En un servidor dedicado provocará un fallo (crash) crítico.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* MODE: EXISTING SERVER (Shown ABOVE version selector so user picks target server first!) */}
          {installMode === 'existing_server' && (
            <div className="space-y-3 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-nebula-accent" />
                  <span>1. Servidor de Destino</span>
                </label>
                {servers.length === 0 ? (
                  <div className="p-3 rounded-lg bg-nebula-950 border border-nebula-800 text-xs text-slate-400">
                    No hay servidores creados. Usa la pestaña "Crear Nuevo Servidor".
                  </div>
                ) : (
                  <select
                    value={selectedServerId}
                    onChange={(e) => setSelectedServerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.loader.toUpperCase()} &bull; MC {s.gameVersion})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* MODE: NEW SERVER DEPLOYMENT */}
          {installMode === 'new_server' && (
            <div className="p-4 rounded-xl bg-nebula-950 border border-nebula-800 space-y-3.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-nebula-accent">
                <Layers className="w-4 h-4" />
                <span>1. Parámetros del Nuevo Servidor</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Nombre del Servidor
                </label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="Ej. Mi Servidor Survival"
                  className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Motor (Loader)
                  </label>
                  <select
                    value={newServerLoader}
                    onChange={(e) => setNewServerLoader(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
                  >
                    <option value="paper">Paper (Plugins)</option>
                    <option value="purpur">Purpur (Plugins)</option>
                    <option value="spigot">Spigot (Plugins)</option>
                    <option value="fabric">Fabric (Mods)</option>
                    <option value="neoforge">NeoForge (Mods)</option>
                    <option value="forge">Forge (Mods)</option>
                    <option value="vanilla">Vanilla</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Versión de Minecraft
                  </label>
                  <input
                    type="text"
                    value={newServerGameVersion}
                    onChange={(e) => setNewServerGameVersion(e.target.value)}
                    placeholder="1.21.4"
                    className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-nebula-accent" />
                  <span>Memoria RAM Asignada ({newServerMemoryMb} MB)</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '4 GB', val: 4096 },
                    { label: '6 GB', val: 6144 },
                    { label: '8 GB', val: 8192 },
                    { label: '12 GB', val: 12288 }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setNewServerMemoryMb(preset.val)}
                      className={`py-1.5 px-2 text-xs font-mono rounded-lg border transition-all ${
                        newServerMemoryMb === preset.val
                          ? 'bg-nebula-purple text-white font-bold border-purple-400 shadow-sm'
                          : 'bg-nebula-900 text-slate-400 border-nebula-800 hover:border-nebula-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Puerto del Servidor (TCP &amp; UDP)
                </label>
                <input
                  type="number"
                  value={newServerPort}
                  onChange={(e) => setNewServerPort(parseInt(e.target.value, 10) || 25565)}
                  className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
                />
              </div>
            </div>
          )}

          {/* 2. Version Selector (Filtered by Target Server Loader) */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>2. Archivo Compatible ({versions.length})</span>
              {effectiveLoader && (
                <span className="text-[10px] font-mono text-nebula-cyber">
                  Filtrado para {effectiveLoader.toUpperCase()} ({effectiveGameVersion})
                </span>
              )}
            </label>
            {isLoadingVersions || isLoadingServers ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-nebula-950 border border-nebula-800 text-xs text-slate-400 font-mono">
                <Orbit className="w-4 h-4 animate-spin text-nebula-accent" />
                <span>Filtrando archivos para {effectiveLoader?.toUpperCase() || 'servidor'}...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-nebula-950 border border-nebula-800 text-xs text-slate-500 font-mono">
                Sin archivos compatibles disponibles para este motor.
              </div>
            ) : (
              <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
              >
                {versions.map((v) => {
                  const loaderTag =
                    v.loaders && v.loaders.length > 0
                      ? `[${v.loaders.slice(0, 3).join('/').toUpperCase()}] `
                      : '';
                  return (
                    <option key={v.id} value={v.id}>
                      {loaderTag}v{v.versionNumber} &mdash; {v.fileName}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Folder Target Hint */}
          <div className="p-2.5 rounded-lg bg-nebula-950/80 border border-nebula-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5">
              <FolderCheck className="w-3.5 h-3.5 text-nebula-cyber shrink-0" />
              <span>
                Destino:{' '}
                <span className="text-nebula-cyber">
                  /data/servers/{installMode === 'existing_server' ? selectedServerId || '...' : 'nuevo_servidor'}
                  {targetSubfolder ? `/${targetSubfolder}/` : '/'}
                  {selectedVersion?.fileName || ''}
                </span>
              </span>
            </div>
            {isPluginServer && (
              <p className="text-[10px] text-emerald-400/90 font-sans leading-tight">
                ✓ Motor de Plugins detectado ({effectiveLoader?.toUpperCase()}): se descargará la edición de Plugin (Bukkit/Paper/Spigot) en <code>/plugins</code>.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-3 border-t border-nebula-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              isInstalling ||
              versions.length === 0 ||
              isClientMod ||
              (installMode === 'existing_server' && (!selectedServerId || servers.length === 0))
            }
            onClick={handleInstall}
            className="px-4 py-2 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-40 text-slate-950 bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98]"
          >
            {isInstalling ? (
              <>
                <Orbit className="w-4 h-4 animate-spin" />
                <span>{deployStep || 'Instalando...'}</span>
              </>
            ) : isClientMod ? (
              <span>Mod de Cliente Incompatible</span>
            ) : installMode === 'new_server' ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Crear Servidor e Instalar</span>
              </>
            ) : (
              <span>Confirmar e Instalar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
