import React, { useState, useEffect, useCallback } from 'react';
import type { ServerConnectionProfile } from '../types/desktop.js';
import { useDialog } from '../context/DialogContext.js';
import {
  Cloud,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  ExternalLink,
  X,
  Server,
  Zap,
  Radio,
  Terminal,
  Clock
} from 'lucide-react';

interface ConnectionSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitched?: (profile: ServerConnectionProfile) => void;
}

interface LatencyState {
  [profileId: string]: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
    checking: boolean;
  };
}

export const ConnectionSwitcherModal: React.FC<ConnectionSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSwitched
}) => {
  const { confirm } = useDialog();
  const [profiles, setProfiles] = useState<ServerConnectionProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<ServerConnectionProfile | null>(null);
  const [latencies, setLatencies] = useState<LatencyState>({});
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSftpHost, setFormSftpHost] = useState('');
  const [formSftpPort, setFormSftpPort] = useState('2022');
  const [isSaving, setIsSaving] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!window.singularityDesktop?.isElectron;

  const testProfileLatency = useCallback(async (p: ServerConnectionProfile) => {
    setLatencies((prev) => ({
      ...prev,
      [p.id]: { ok: false, checking: true }
    }));

    try {
      if (window.singularityDesktop?.testConnection) {
        const res = await window.singularityDesktop.testConnection(p.url);
        setLatencies((prev) => ({
          ...prev,
          [p.id]: { ok: res.ok, latencyMs: res.latencyMs, error: res.error, checking: false }
        }));
      } else {
        const start = performance.now();
        const res = await fetch(`${p.url.replace(/\/+$/, '')}/api/health`, {
          signal: AbortSignal.timeout(4000)
        });
        const latencyMs = Math.round(performance.now() - start);
        setLatencies((prev) => ({
          ...prev,
          [p.id]: { ok: res.ok, latencyMs, checking: false }
        }));
      }
    } catch (err: unknown) {
      setLatencies((prev) => ({
        ...prev,
        [p.id]: {
          ok: false,
          error: err instanceof Error ? err.message : 'Sin conexión',
          checking: false
        }
      }));
    }
  }, []);

  const pingAll = useCallback((list: ServerConnectionProfile[]) => {
    list.forEach((p) => {
      testProfileLatency(p);
    });
  }, [testProfileLatency]);

  const loadConnections = useCallback(async () => {
    if (!isElectron || !window.singularityDesktop) {
      // Browser fallback demo profiles
      const demoProfiles: ServerConnectionProfile[] = [
        {
          id: 'browser-current',
          name: 'Entorno Web Actual',
          type: window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 'local' : 'remote',
          url: window.location.origin,
          sftpHost: window.location.hostname,
          sftpPort: 2022,
          isDefault: true
        }
      ];
      setProfiles(demoProfiles);
      setActiveProfile(demoProfiles[0] || null);
      return;
    }

    try {
      const list = await window.singularityDesktop.getConnections();
      const current = await window.singularityDesktop.getActiveConnection();
      setProfiles(list);
      setActiveProfile(current);
      pingAll(list);
    } catch (err: unknown) {
      console.error('[ConnectionSwitcherModal] Error cargando conexiones:', err);
    }
  }, [isElectron, pingAll]);

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      setError(null);
    }
  }, [isOpen, loadConnections]);

  const handleSwitch = async (profile: ServerConnectionProfile) => {
    if (profile.id === activeProfile?.id) return;

    if (!isElectron || !window.singularityDesktop) {
      window.location.href = profile.url;
      return;
    }

    setIsSwitching(profile.id);
    setError(null);

    try {
      const res = await window.singularityDesktop.switchConnection(profile.id);
      if (res.success) {
        setActiveProfile(res.profile);
        if (onSwitched) onSwitched(res.profile);
        onClose();
      } else {
        setError(res.error || 'No se pudo conectar al servidor seleccionado');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fallo en la comunicación IPC');
    } finally {
      setIsSwitching(null);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormSftpHost('');
    setFormSftpPort('2022');
    setIsFormOpen(true);
    setError(null);
  };

  const handleOpenEdit = (p: ServerConnectionProfile) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormUrl(p.url);
    setFormSftpHost(p.sftpHost || '');
    setFormSftpPort(p.sftpPort ? String(p.sftpPort) : '2022');
    setIsFormOpen(true);
    setError(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) {
      setError('Por favor indica un nombre y la URL del servidor');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const isLocal = formUrl.includes('127.0.0.1') || formUrl.includes('localhost');
      const payload: Omit<ServerConnectionProfile, 'id'> & { id?: string } = {
        id: editingId || undefined,
        name: formName.trim(),
        type: isLocal ? 'local' : 'remote',
        url: formUrl.trim(),
        sftpHost: formSftpHost.trim() || undefined,
        sftpPort: formSftpPort.trim() ? parseInt(formSftpPort.trim(), 10) : undefined
      };

      if (isElectron && window.singularityDesktop?.saveConnection) {
        await window.singularityDesktop.saveConnection(payload);
        await loadConnections();
      } else {
        // Fallback in-memory
        const updated = [...profiles];
        const existingIdx = updated.findIndex((x) => x.id === editingId);
        const item: ServerConnectionProfile = {
          ...payload,
          id: editingId || `custom_${Date.now()}`
        };
        if (existingIdx >= 0) {
          updated[existingIdx] = item;
        } else {
          updated.push(item);
        }
        setProfiles(updated);
      }

      setIsFormOpen(false);
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar la conexión');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (profiles.length <= 1) {
      setError('No puedes eliminar la única conexión disponible');
      return;
    }

    const ok = await confirm({
      title: 'Eliminar Perfil de Conexión',
      message: '¿Estás seguro de eliminar este perfil de conexión remota?',
      confirmLabel: 'Eliminar Perfil',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      if (isElectron && window.singularityDesktop?.deleteConnection) {
        await window.singularityDesktop.deleteConnection(id);
        await loadConnections();
      } else {
        setProfiles(profiles.filter((p) => p.id !== id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-xl bg-nebula-900 border border-nebula-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-nebula-800 flex items-center justify-between bg-nebula-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-nebula-cyber/15 border border-nebula-cyber/30 text-nebula-cyber">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Conexiones & Servidores Singularity
                {isElectron && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-nebula-accent/20 border border-nebula-accent/40 text-nebula-accent">
                    Desktop Native
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Cambia entre tu VPS Cloud en producción y el servidor local en 1 clic
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-nebula-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Warning notice if not running in desktop */}
        {!isElectron && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Estás en el navegador. Al cambiar de servidor serás redirigido a la nueva URL en esta pestaña.
            </span>
          </div>
        )}

        {/* Global Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Controls bar */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Perfiles Guardados ({profiles.length})</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => pingAll(profiles)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 hover:text-slate-100 border border-nebula-750 transition-colors"
                title="Volver a medir latencias en tiempo real"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Medir Ping</span>
              </button>
              {!isFormOpen && (
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-nebula-accent/20 hover:bg-nebula-accent/30 text-nebula-accent border border-nebula-accent/40 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Servidor</span>
                </button>
              )}
            </div>
          </div>

          {/* Form for Add/Edit */}
          {isFormOpen && (
            <form
              onSubmit={handleSaveForm}
              className="p-4 rounded-xl bg-nebula-950 border border-nebula-cyber/30 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-nebula-cyber" />
                {editingId ? 'Editar Conexión' : 'Registrar Nuevo Servidor Remoto'}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nombre Descriptivo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. NebulaX Cloud VPS 2"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-cyber"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">URL Endpoint Web</label>
                  <input
                    type="text"
                    required
                    placeholder="https://singularity.tudominio.top"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-cyber font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Host SFTP (Opcional)</label>
                  <input
                    type="text"
                    placeholder="157.137.223.54 o dominio"
                    value={formSftpHost}
                    onChange={(e) => setFormSftpHost(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-cyber font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Puerto SFTP (Opcional)</label>
                  <input
                    type="number"
                    placeholder="2022"
                    value={formSftpPort}
                    onChange={(e) => setFormSftpPort(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-nebula-900 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-cyber font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-nebula-850">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-nebula-cyber hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{editingId ? 'Actualizar Perfil' : 'Guardar Servidor'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Profiles Cards */}
          <div className="space-y-3">
            {profiles.map((p) => {
              const isActive = p.id === activeProfile?.id;
              const latInfo = latencies[p.id];
              const isCheckingLatency = latInfo?.checking;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-nebula-950 border-nebula-accent/60 shadow-lg shadow-nebula-accent/5 ring-1 ring-nebula-accent/20'
                      : 'bg-nebula-950/70 border-nebula-800 hover:border-nebula-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Icon & Info */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 ${
                          p.type === 'remote'
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {p.type === 'remote' ? <Cloud className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100">{p.name}</h4>
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-nebula-accent/20 text-nebula-accent border border-nebula-accent/40 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-nebula-accent animate-ping" />
                              ACTIVO
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            [{p.type === 'remote' ? 'Cloud VPS' : 'PC Local'}]
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                          <span className="flex items-center gap-1 text-slate-300">
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                            {p.url}
                          </span>
                          {p.sftpPort && (
                            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                              <Terminal className="w-3 h-3 text-nebula-cyber" />
                              SFTP :{p.sftpPort}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Ping & Action Button */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Latency badge */}
                      <div className="text-[11px] font-mono">
                        {isCheckingLatency ? (
                          <span className="flex items-center gap-1 text-slate-400">
                            <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                            <span>Midiendo...</span>
                          </span>
                        ) : latInfo?.ok ? (
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${
                              (latInfo.latencyMs || 0) < 60
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : (latInfo.latencyMs || 0) < 180
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <Zap className="w-3 h-3" />
                            <span>{latInfo.latencyMs} ms</span>
                          </span>
                        ) : latInfo?.error ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3" />
                            <span>Offline</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Sin medir</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-nebula-800 rounded-lg transition-colors"
                          title="Editar conexión"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {profiles.length > 1 && !p.isDefault && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-nebula-800 rounded-lg transition-colors"
                            title="Eliminar conexión"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isActive ? (
                          <button
                            onClick={() => handleSwitch(p)}
                            disabled={isSwitching === p.id}
                            className="flex items-center gap-1 px-3 py-1 bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-all shadow"
                          >
                            {isSwitching === p.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            <span>Conectar</span>
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 text-xs text-slate-400 font-mono italic">
                            Conectado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-nebula-800 bg-nebula-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Los cambios persisten en tu configuración local.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-200 transition-colors text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
