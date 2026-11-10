import React, { useState, useEffect, useCallback } from 'react';
import {
  Archive,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  X,
  FileArchive
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';

export interface BackupData {
  id: string;
  serverId: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  comment?: string;
  format: 'tar.gz' | 'zip';
}

interface BackupManagerProps {
  serverId: string;
  isOnline: boolean;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ serverId, isOnline }) => {
  const { confirm, alert } = useDialog();
  const [backups, setBackups] = useState<BackupData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isNewBackupModalOpen, setIsNewBackupModalOpen] = useState(false);
  const [backupComment, setBackupComment] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Restore Confirmation Modal
  const [restoringBackup, setRestoringBackup] = useState<BackupData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<BackupData[]>(`/servers/${serverId}/backups`);
      setBackups(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setFeedbackMessage(null);
    try {
      await api.post(`/servers/${serverId}/backups`, {
        comment: backupComment.trim() || undefined
      });
      setIsNewBackupModalOpen(false);
      setBackupComment('');
      setFeedbackMessage({ type: 'success', text: '¡Copia de seguridad creada exitosamente!' });
      setTimeout(() => setFeedbackMessage(null), 4000);
      await fetchBackups();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al crear copia de seguridad'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoringBackup) return;
    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      await api.post(`/servers/${serverId}/backups/${restoringBackup.id}/restore`);
      setRestoringBackup(null);
      setFeedbackMessage({ type: 'success', text: '¡Copia de seguridad restaurada correctamente!' });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al restaurar copia de seguridad'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (backup: BackupData) => {
    const ok = await confirm({
      title: 'Eliminar Copia de Seguridad',
      message: `¿Eliminar la copia de seguridad "${backup.filename}"? Esta acción liberará espacio en disco pero no se puede deshacer.`,
      confirmLabel: 'Eliminar Copia',
      variant: 'danger'
    });
    if (!ok) {
      return;
    }

    try {
      await api.delete(`/servers/${serverId}/backups/${backup.id}`);
      await fetchBackups();
    } catch (err: unknown) {
      await alert({
        title: 'Error al Eliminar Copia',
        message: err instanceof Error ? err.message : 'Error al eliminar copia',
        variant: 'error'
      });
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="bg-nebula-900 border border-nebula-800 rounded-2xl flex flex-col h-full shadow-md overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-nebula-800 flex flex-wrap items-center justify-between gap-3 bg-nebula-950/40">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-nebula-accent" />
            <span>Copias de Seguridad & Puntos de Restauración</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Empaquetado comprimido de mundos, plugins, configuraciones y mods de la instancia.
          </p>
        </div>

        <button
          type="button"
          disabled={isCreating}
          onClick={() => setIsNewBackupModalOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-nebula-accent/20 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Respaldo</span>
        </button>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3 border-b text-xs flex items-center gap-2 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Backups List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="py-20 text-center text-xs font-mono text-slate-500">
            Cargando copias de seguridad...
          </div>
        ) : backups.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <FileArchive className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs font-mono text-slate-400">
              No hay copias de seguridad creadas para este servidor.
            </p>
            <p className="text-[11px] text-slate-500">
              Haz clic en "Crear Respaldo" para generar un punto de restauración antes de hacer cambios.
            </p>
          </div>
        ) : (
          backups.map((b) => (
            <div
              key={b.id}
              className="p-3.5 rounded-xl bg-nebula-950/60 border border-nebula-850 hover:border-nebula-750 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-nebula-900 border border-nebula-800 text-nebula-accent shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-100">{b.filename}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-nebula-850 text-slate-300 border border-nebula-700">
                      {b.format}
                    </span>
                  </div>

                  {b.comment && (
                    <p className="text-xs text-slate-300 font-medium">{b.comment}</p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-slate-500" />
                      {formatSize(b.sizeBytes)}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(b.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    api.download(`/servers/${serverId}/backups/${b.id}/download`, b.filename).catch((err: unknown) => {
                      setFeedbackMessage({
                        type: 'error',
                        text: err instanceof Error ? err.message : 'Error al descargar copia de seguridad'
                      });
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 hover:text-white border border-nebula-750 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Descargar archivo comprimido"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoringBackup(b)}
                  className="px-3 py-1.5 rounded-lg bg-nebula-850 hover:bg-amber-950/40 text-slate-300 hover:text-amber-400 border border-nebula-750 hover:border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Restaurar este punto en el servidor"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteBackup(b)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 transition-colors"
                  title="Eliminar copia de seguridad"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Backup Modal */}
      {isNewBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBackup}
            className="bg-nebula-900 border border-nebula-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-nebula-accent" />
                <h3 className="text-sm font-bold text-white">Crear Punto de Restauración</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewBackupModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Se creará un archivo comprimido <code className="text-nebula-cyber font-mono font-bold">.tar.gz</code> que incluye el mundo, plugins, mods y archivos de configuración actuales.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">Nota o Comentario (Opcional)</label>
              <input
                type="text"
                autoFocus
                placeholder="ej. Antes de instalar nuevo modpack / Versión 1.2"
                value={backupComment}
                onChange={(e) => setBackupComment(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-white font-mono focus:outline-none focus:border-nebula-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewBackupModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-nebula-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Empaquetando...</span>
                  </>
                ) : (
                  <span>Generar Backup</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoringBackup && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-nebula-900 border border-amber-500/40 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-white">Confirmar Restauración de Servidor</h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoringBackup(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {isOnline ? (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200">
                  <p className="font-bold text-rose-300">¡El servidor está actualmente en línea!</p>
                  <p className="mt-1">
                    Para restaurar un respaldo sin corromper el mapa o bases de datos SQLite, debes <strong>detener el servidor (/stop)</strong> antes de proceder.
                  </p>
                </div>
              ) : (
                <p>
                  Estás a punto de restaurar la copia de seguridad <strong>{restoringBackup.filename}</strong> creada el <strong>{new Date(restoringBackup.createdAt).toLocaleString()}</strong>.
                </p>
              )}

              <p className="text-slate-400">
                Esta operación reemplazará los archivos actuales del mundo, plugins y configuraciones con los datos del respaldo.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-nebula-800">
              <button
                type="button"
                onClick={() => setRestoringBackup(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-nebula-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isOnline || isRestoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <span>Sí, Restaurar Respaldo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
