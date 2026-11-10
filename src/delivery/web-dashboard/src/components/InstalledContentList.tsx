import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Package,
  Trash2,
  Box,
  Layers,
  Database,
  Plus,
  Upload,
  AlertCircle,
  CheckCircle2,
  Search,
  RotateCw
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';

export interface InstalledItemData {
  id: string;
  projectId: string;
  providerId: string;
  projectType: 'mod' | 'plugin' | 'modpack' | 'datapack';
  versionId: string;
  versionNumber: string;
  fileName: string;
  destinationFolder?: string;
  installedAt: string;
}

interface ManifestResponse {
  instanceId: string;
  installedItems: InstalledItemData[];
}

interface InstalledContentListProps {
  serverId: string;
  loader?: string;
  onExploreCatalog: () => void;
}

export const InstalledContentList: React.FC<InstalledContentListProps> = ({
  serverId,
  loader,
  onExploreCatalog
}) => {
  const { confirm, alert, toast } = useDialog();
  const [items, setItems] = useState<InstalledItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'plugin' | 'mod' | 'datapack' | 'custom'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPluginEngine = Boolean(
    loader && ['paper', 'purpur', 'spigot', 'bukkit'].includes(loader.toLowerCase())
  );
  const isVanillaEngine = Boolean(loader && loader.toLowerCase() === 'vanilla');
  const defaultFolder = isVanillaEngine ? 'datapacks' : isPluginEngine ? 'plugins' : 'mods';
  const uploadButtonLabel = isVanillaEngine
    ? 'Subir Datapack (.zip)'
    : isPluginEngine
    ? 'Subir Plugin (.jar) / Datapack (.zip)'
    : 'Subir Mod (.jar) / Datapack (.zip)';

  const fetchInstalled = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const data = await api.get<ManifestResponse>(`/catalog/installed/${serverId}`);
      setItems(data.installedItems || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const jarFiles: File[] = [];
    const zipFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f) continue;
      if (f.name.toLowerCase().endsWith('.zip')) {
        zipFiles.push(f);
      } else {
        jarFiles.push(f);
      }
    }

    const targetFoldersDesc: string[] = [];
    if (jarFiles.length > 0) targetFoldersDesc.push(`/${defaultFolder}`);
    if (zipFiles.length > 0) targetFoldersDesc.push('/datapacks');

    setUploadStatus(
      `Subiendo ${files.length} archivo(s) a ${targetFoldersDesc.join(' y ')}...`
    );

    try {
      if (jarFiles.length > 0) {
        const jarData = new FormData();
        for (const jf of jarFiles) jarData.append('files', jf);
        await api.upload(`/servers/${serverId}/files/upload?path=${defaultFolder}`, jarData);
      }
      if (zipFiles.length > 0) {
        const zipData = new FormData();
        for (const zf of zipFiles) zipData.append('files', zf);
        await api.upload(`/servers/${serverId}/files/upload?path=datapacks`, zipData);
      }

      const msg = `¡${files.length} archivo(s) instalado(s) en ${targetFoldersDesc.join(' y ')} con éxito!`;
      setUploadStatus(msg);
      toast(msg, 'success');
      await fetchInstalled(true);
      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err: unknown) {
      const errMsg = `Error al subir: ${err instanceof Error ? err.message : String(err)}`;
      setUploadStatus(errMsg);
      toast(errMsg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUninstall = async (projectId: string, fileName: string) => {
    const ok = await confirm({
      title: 'Desinstalar Contenido',
      message: `¿Desinstalar "${fileName}"? Se eliminará el archivo del servidor de forma permanente.`,
      confirmLabel: 'Desinstalar',
      variant: 'danger'
    });
    if (!ok) {
      return;
    }

    setIsDeleting(projectId);
    try {
      await api.delete(`/catalog/installed/${serverId}/${projectId}`);
      toast(`${fileName} desinstalado`, 'info');
      await fetchInstalled(true);
    } catch (err: unknown) {
      await alert({
        title: 'Error al Desinstalar',
        message: err instanceof Error ? err.message : 'Error al desinstalar archivo',
        variant: 'error'
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter === 'plugin' && item.projectType !== 'plugin' && item.destinationFolder !== 'plugins') {
        return false;
      }
      if (typeFilter === 'mod' && item.projectType !== 'mod' && item.destinationFolder !== 'mods') {
        return false;
      }
      if (typeFilter === 'datapack' && item.projectType !== 'datapack' && item.destinationFolder !== 'datapacks') {
        return false;
      }
      if (typeFilter === 'custom' && item.providerId !== 'custom') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.fileName.toLowerCase().includes(q) ||
          item.projectId.toLowerCase().includes(q) ||
          item.providerId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, typeFilter, searchQuery]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'mod':
        return <Box className="w-4 h-4 text-blue-400" />;
      case 'plugin':
        return <Package className="w-4 h-4 text-nebula-cyber" />;
      case 'datapack':
        return <Database className="w-4 h-4 text-amber-400" />;
      default:
        return <Layers className="w-4 h-4 text-purple-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono text-slate-500">
        Cargando elementos instalados...
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
      className={`bg-nebula-900 border rounded-xl p-6 shadow-md flex flex-col space-y-4 transition-all ${
        isDragOver
          ? 'border-nebula-accent bg-nebula-accent/5 ring-2 ring-nebula-accent/30'
          : 'border-nebula-800'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-nebula-800 gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-nebula-purple" />
            <span>Mods, Plugins y Datapacks Instalados</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums bg-nebula-800 text-nebula-accent border border-nebula-700">
              {items.length} archivos
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Arrastra archivos <code className="text-nebula-cyber font-mono">.jar</code> o <code className="text-amber-300 font-mono">.zip</code> aquí o gestiona <code className="text-slate-300 font-mono">/{defaultFolder}</code> y <code className="text-slate-300 font-mono">/datapacks</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Input para subir plugin / mod */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".jar,.zip,.mrpack"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={() => fetchInstalled()}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-nebula-950 hover:bg-nebula-800 text-slate-400 hover:text-white border border-nebula-800 transition-colors"
            title="Re-escanear carpetas /mods y /plugins"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-nebula-cyber' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            title={`Subir archivo .jar o .zip directamente a /${defaultFolder}`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadButtonLabel}</span>
          </button>

          <button
            onClick={onExploreCatalog}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-nebula-purple hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Instalar del Catálogo</span>
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            uploadStatus.startsWith('Error')
              ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
          }`}
        >
          {isUploading ? (
            <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
          ) : uploadStatus.startsWith('Error') ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar archivo instalado (.jar)..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-nebula-950 border border-nebula-850 text-[11px] font-mono">
            {[
              { id: 'all' as const, label: 'Todos' },
              { id: 'plugin' as const, label: 'Plugins' },
              { id: 'mod' as const, label: 'Mods' },
              { id: 'datapack' as const, label: 'Datapacks' },
              { id: 'custom' as const, label: 'Subidos Manual' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  typeFilter === f.id
                    ? 'bg-nebula-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-nebula-850 rounded-xl bg-nebula-950/40">
          <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h4 className="text-xs font-semibold text-slate-300">No hay contenido instalado</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            Arrastra y suelta tus archivos <code className="text-slate-300">.jar</code> aquí para subirlos a <code className="text-slate-300">/{defaultFolder}</code> o explora el Catálogo Singularity.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded-lg border border-emerald-500/40 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadButtonLabel}</span>
            </button>
            <button
              onClick={onExploreCatalog}
              className="px-3.5 py-1.5 bg-nebula-800 hover:bg-nebula-700 text-slate-200 text-xs font-medium rounded-lg border border-nebula-700 transition-colors"
            >
              Abrir Catálogo Singularity
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-nebula-850 rounded-xl">
          No hay archivos que coincidan con el filtro "{searchQuery}".
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-nebula-950 border border-nebula-850 hover:border-nebula-700 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-nebula-900 border border-nebula-800 shrink-0">
                  {getIcon(item.projectType)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 font-mono truncate">
                      {item.fileName}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold border ${
                        item.destinationFolder === 'plugins' || item.projectType === 'plugin'
                          ? 'bg-nebula-cyber/15 text-nebula-cyber border-nebula-cyber/30'
                          : item.destinationFolder === 'datapacks' || item.projectType === 'datapack'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      /{item.destinationFolder || defaultFolder}
                    </span>
                    {item.providerId === 'custom' ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Manual
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-nebula-850 text-slate-400 border border-nebula-800">
                        v{item.versionNumber}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {item.providerId}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500 block mt-0.5">
                    {item.providerId === 'custom'
                      ? `Detectado en disco • ${new Date(item.installedAt).toLocaleString()}`
                      : `Instalado desde catálogo • ${new Date(item.installedAt).toLocaleString()}`}
                  </span>
                </div>
              </div>

              <button
                disabled={isDeleting === item.projectId}
                onClick={() => handleUninstall(item.projectId, item.fileName)}
                title="Desinstalar y eliminar archivo"
                className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors disabled:opacity-40 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
