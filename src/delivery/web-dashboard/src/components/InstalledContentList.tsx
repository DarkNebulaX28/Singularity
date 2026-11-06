import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Trash2, Box, Layers, Database, Plus, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api-client.js';

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
  const [items, setItems] = useState<InstalledItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPluginEngine = Boolean(
    loader && ['paper', 'purpur', 'spigot', 'bukkit'].includes(loader.toLowerCase())
  );
  const defaultFolder = isPluginEngine ? 'plugins' : 'mods';
  const uploadButtonLabel = isPluginEngine ? 'Subir Plugin (.jar)' : 'Subir Mod (.jar)';

  const fetchInstalled = useCallback(async () => {
    try {
      const data = await api.get<ManifestResponse>(`/catalog/installed/${serverId}`);
      setItems(data.installedItems || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadStatus(`Subiendo ${files.length} archivo(s) a /${defaultFolder}...`);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      await api.upload(`/servers/${serverId}/files/upload?path=${defaultFolder}`, formData);
      setUploadStatus(`¡${files.length} archivo(s) subido(s) con éxito!`);
      await fetchInstalled();
      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err: unknown) {
      setUploadStatus(`Error al subir: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUninstall = async (projectId: string, fileName: string) => {
    if (!confirm(`¿Desinstalar ${fileName}? Se eliminará el archivo del servidor.`)) {
      return;
    }

    setIsDeleting(projectId);
    try {
      await api.delete(`/catalog/installed/${serverId}/${projectId}`);
      await fetchInstalled();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al desinstalar archivo');
    } finally {
      setIsDeleting(null);
    }
  };

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
    <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-6 shadow-md flex flex-col space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-nebula-800 gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-nebula-purple" />
            <span>Mods y Plugins Instalados ({items.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Archivos gestionados en <code className="text-slate-300">/mods</code> y <code className="text-slate-300">/plugins</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-nebula-purple hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
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

      {items.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-nebula-850 rounded-xl bg-nebula-950/40">
          <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h4 className="text-xs font-semibold text-slate-300">No hay contenido instalado</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            Sube tus propios archivos .jar/.zip a <code className="text-slate-300">/{defaultFolder}</code> o usa el Catálogo Unificado Singularity con un solo clic.
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
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg bg-nebula-950 border border-nebula-850 hover:border-nebula-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-nebula-900 border border-nebula-800 shrink-0">
                  {getIcon(item.projectType)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 font-mono">
                      {item.fileName}
                    </span>
                    {item.providerId === 'custom' ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Personalizado
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-nebula-850 text-slate-400 border border-nebula-800">
                        v{item.versionNumber}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {item.providerId}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {item.providerId === 'custom'
                      ? `En /${item.destinationFolder || defaultFolder} • Detectado ${new Date(item.installedAt).toLocaleString()}`
                      : `Instalado el ${new Date(item.installedAt).toLocaleString()}`}
                  </span>
                </div>
              </div>

              <button
                disabled={isDeleting === item.projectId}
                onClick={() => handleUninstall(item.projectId, item.fileName)}
                title="Desinstalar y eliminar archivo"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
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
