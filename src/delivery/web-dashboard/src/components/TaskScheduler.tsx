import React, { useState, useEffect, useCallback } from 'react';
import { useDialog } from '../context/DialogContext.js';
import {
  Clock,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  Archive,
  RotateCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Calendar,
  X
} from 'lucide-react';

interface ScheduledTask {
  id: string;
  serverId: string;
  name: string;
  action: 'backup' | 'restart' | 'command';
  scheduleType: 'interval' | 'daily' | 'cron';
  intervalMinutes?: number;
  timeOfDay?: string;
  cronExpression?: string;
  payload?: {
    command?: string;
    advanceWarningsMinutes?: number[];
    backupComment?: string;
  };
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastStatus?: 'idle' | 'running' | 'success' | 'failed';
  lastError?: string;
}

interface TaskSchedulerProps {
  serverId: string;
}

export const TaskScheduler: React.FC<TaskSchedulerProps> = ({ serverId }) => {
  const { confirm } = useDialog();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [action, setAction] = useState<'backup' | 'restart' | 'command'>('backup');
  const [scheduleType, setScheduleType] = useState<'interval' | 'daily' | 'cron'>('interval');
  const [intervalMinutes, setIntervalMinutes] = useState(360); // default 6h
  const [timeOfDay, setTimeOfDay] = useState('04:00');
  const [cronExpression, setCronExpression] = useState('0 4 * * *');
  const [command, setCommand] = useState('save-all');
  const [backupComment, setBackupComment] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('singularity_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/tasks?serverId=${encodeURIComponent(serverId)}`, {
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('No se pudieron obtener las tareas programadas');
      const data = await res.json();
      setTasks(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar tareas');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggle = async (task: ScheduledTask) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ enabled: !task.enabled })
      });
      if (!res.ok) throw new Error('Error al cambiar estado de la tarea');
      fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRunNow = async (taskId: string) => {
    try {
      setExecutingTaskId(taskId);
      setErrorMsg(null);
      const res = await fetch(`/api/tasks/${taskId}/run`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar la tarea');
      setSuccessMsg(data.message || 'Tarea ejecutada con éxito');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setExecutingTaskId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    const ok = await confirm({
      title: 'Eliminar Tarea Programada',
      message: '¿Estás seguro de que deseas eliminar esta tarea automatizada del cronograma?',
      confirmLabel: 'Eliminar Tarea',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Error al eliminar la tarea');
      fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const payload: any = {};
      if (action === 'command') payload.command = command;
      if (action === 'backup' && backupComment.trim()) payload.backupComment = backupComment.trim();

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          serverId: applyToAll ? '*' : serverId,
          name: taskName.trim(),
          action,
          scheduleType,
          intervalMinutes: scheduleType === 'interval' ? Number(intervalMinutes) : undefined,
          timeOfDay: scheduleType === 'daily' ? timeOfDay : undefined,
          cronExpression: scheduleType === 'cron' ? cronExpression : undefined,
          payload,
          enabled: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la tarea programada');

      setIsModalOpen(false);
      setTaskName('');
      setBackupComment('');
      setCommand('save-all');
      fetchTasks();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatScheduleText = (task: ScheduledTask) => {
    if (task.scheduleType === 'interval') {
      const mins = task.intervalMinutes || 60;
      if (mins >= 60) {
        const hours = mins / 60;
        return `Cada ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      }
      return `Cada ${mins} minutos`;
    }
    if (task.scheduleType === 'daily') {
      return `Diario a las ${task.timeOfDay || '04:00'}`;
    }
    if (task.scheduleType === 'cron') {
      return `Cron: ${task.cronExpression || '0 4 * * *'}`;
    }
    return 'Programación personalizada';
  };

  return (
    <div className="h-full flex flex-col bg-nebula-950/40 rounded-xl border border-nebula-800 p-5 overflow-y-auto">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-nebula-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-nebula-800/80 border border-nebula-700/60 text-nebula-cyber">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Programador de Tareas (Cron & Scheduler)</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-nebula-800 text-nebula-accent border border-nebula-700 font-normal">
                {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatiza copias de seguridad periódicas, reinicios nocturnos y comandos de consola en segundo plano.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTasks}
            disabled={isLoading}
            className="p-2 rounded-lg bg-nebula-900 hover:bg-nebula-850 text-slate-300 border border-nebula-800 transition-colors disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-nebula-accent/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Tarea Programada</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="my-3 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-900/50 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="my-3 p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tasks Grid / List */}
      <div className="flex-1 min-h-0 pt-4">
        {isLoading && tasks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-6 h-6 border-2 border-nebula-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Cargando tareas programadas...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-nebula-800/80 rounded-xl p-8 text-center">
            <div className="p-4 rounded-full bg-nebula-900/80 text-slate-500 mb-3 border border-nebula-800">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No hay tareas programadas</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Configura auto-backups cada 6 horas o reinicios diarios programados para mantener tu servidor Minecraft optimizado y libre de fugas de memoria.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-3.5 py-2 rounded-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-nebula-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Programar Primera Tarea</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {tasks.map((task) => {
              const isExecuting = executingTaskId === task.id || task.lastStatus === 'running';

              return (
                <div
                  key={task.id}
                  className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                    task.enabled
                      ? 'bg-nebula-900/90 border-nebula-800 hover:border-nebula-700'
                      : 'bg-nebula-950/60 border-nebula-850 opacity-60'
                  }`}
                >
                  <div>
                    {/* Top Row: Action Badge & Toggle */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        {task.action === 'backup' && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-500/30 text-blue-300 font-semibold text-[10px] flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            <span>Copia de Seguridad</span>
                          </span>
                        )}
                        {task.action === 'restart' && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/30 text-amber-300 font-semibold text-[10px] flex items-center gap-1">
                            <RotateCw className="w-3 h-3" />
                            <span>Reinicio Automático</span>
                          </span>
                        )}
                        {task.action === 'command' && (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-semibold text-[10px] flex items-center gap-1 font-mono">
                            <Terminal className="w-3 h-3" />
                            <span>Comando</span>
                          </span>
                        )}

                        {task.serverId === '*' && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[9px] font-mono">
                            GLOBAL
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggle(task)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        title={task.enabled ? 'Desactivar tarea' : 'Activar tarea'}
                      >
                        {task.enabled ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-500" />
                        )}
                      </button>
                    </div>

                    {/* Task Title */}
                    <h4 className="text-sm font-semibold text-slate-200 line-clamp-1">{task.name}</h4>

                    {/* Schedule Information */}
                    <div className="mt-2 text-xs font-mono text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-nebula-cyber shrink-0" />
                      <span className="text-slate-300">{formatScheduleText(task)}</span>
                    </div>

                    {/* Command preview if action is command */}
                    {task.action === 'command' && task.payload?.command && (
                      <div className="mt-2 px-2.5 py-1 rounded bg-black/40 border border-nebula-800 text-[11px] font-mono text-slate-300 truncate">
                        /{task.payload.command}
                      </div>
                    )}

                    {/* Next run time */}
                    <div className="mt-2.5 pt-2.5 border-t border-nebula-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Próxima ejecución:</span>
                      <span className="font-mono text-slate-300">
                        {task.nextRunAt ? new Date(task.nextRunAt).toLocaleString() : 'No calculada'}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Último estado:</span>
                      {task.lastStatus === 'success' && (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Exitoso
                        </span>
                      )}
                      {task.lastStatus === 'failed' && (
                        <span className="text-rose-400 font-medium flex items-center gap-1" title={task.lastError}>
                          <AlertCircle className="w-3 h-3" /> Fallido
                        </span>
                      )}
                      {task.lastStatus === 'running' && (
                        <span className="text-nebula-accent font-medium flex items-center gap-1">
                          <div className="w-2.5 h-2.5 border-2 border-nebula-accent border-t-transparent rounded-full animate-spin" />
                          En ejecución
                        </span>
                      )}
                      {(!task.lastStatus || task.lastStatus === 'idle') && (
                        <span className="text-slate-400">En espera</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-nebula-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isExecuting}
                      onClick={() => handleRunNow(task.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-nebula-800 hover:bg-nebula-750 text-slate-200 border border-nebula-700 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Ejecutar ahora inmediatamente"
                    >
                      {isExecuting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-nebula-accent border-t-transparent rounded-full animate-spin" />
                          <span>Ejecutando...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-nebula-accent fill-current" />
                          <span>Ejecutar Ahora</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(task.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-colors"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create Scheduled Task */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-nebula-900 border border-nebula-750 rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-nebula-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-nebula-800 text-nebula-cyber">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100">Nueva Tarea Programada</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-nebula-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Descriptivo</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Auto-Backup Nocturno o Reinicio Diario"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-nebula-950 border border-nebula-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Acción</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction('backup')}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-colors ${
                      action === 'backup'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                        : 'bg-nebula-950 border-nebula-800 text-slate-400 hover:border-nebula-700'
                    }`}
                  >
                    <Archive className="w-4 h-4" />
                    <span>Auto-Backup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction('restart')}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-colors ${
                      action === 'restart'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                        : 'bg-nebula-950 border-nebula-800 text-slate-400 hover:border-nebula-700'
                    }`}
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Reinicio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction('command')}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-colors ${
                      action === 'command'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-nebula-950 border-nebula-800 text-slate-400 hover:border-nebula-700'
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Comando</span>
                  </button>
                </div>
              </div>

              {action === 'backup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nota o Comentario del Backup (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej. Respaldo previo a mantenimiento semanal"
                    value={backupComment}
                    onChange={(e) => setBackupComment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-nebula-950 border border-nebula-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent"
                  />
                </div>
              )}

              {action === 'command' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Comando de Minecraft a Ejecutar</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. save-all, say Servidor operativo, weather clear"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-nebula-950 border border-nebula-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Frecuencia / Programación</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setScheduleType('interval')}
                    className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                      scheduleType === 'interval'
                        ? 'bg-nebula-accent/10 border-nebula-accent text-nebula-accent'
                        : 'bg-nebula-950 border-nebula-800 text-slate-400'
                    }`}
                  >
                    Por Intervalo
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('daily')}
                    className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                      scheduleType === 'daily'
                        ? 'bg-nebula-accent/10 border-nebula-accent text-nebula-accent'
                        : 'bg-nebula-950 border-nebula-800 text-slate-400'
                    }`}
                  >
                    Diario
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('cron')}
                    className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                      scheduleType === 'cron'
                        ? 'bg-nebula-accent/10 border-nebula-accent text-nebula-accent'
                        : 'bg-nebula-950 border-nebula-800 text-slate-400'
                    }`}
                  >
                    Expresión Cron
                  </button>
                </div>

                {scheduleType === 'interval' && (
                  <div>
                    <select
                      value={intervalMinutes}
                      onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-nebula-950 border border-nebula-800 text-xs text-slate-200 focus:outline-none focus:border-nebula-accent"
                    >
                      <option value={30}>Cada 30 minutos</option>
                      <option value={60}>Cada 1 hora</option>
                      <option value={120}>Cada 2 horas</option>
                      <option value={360}>Cada 6 horas (Recomendado para Backups)</option>
                      <option value={720}>Cada 12 horas</option>
                      <option value={1440}>Cada 24 horas</option>
                    </select>
                  </div>
                )}

                {scheduleType === 'daily' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Ejecutar todos los días a las:</span>
                    <input
                      type="time"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-nebula-accent"
                    />
                  </div>
                )}

                {scheduleType === 'cron' && (
                  <div>
                    <input
                      type="text"
                      placeholder="0 4 * * * (minuto hora día mes día-semana)"
                      value={cronExpression}
                      onChange={(e) => setCronExpression(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-nebula-950 border border-nebula-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Formato estándar de 5 campos cron.</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-nebula-800">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="w-4 h-4 rounded bg-nebula-950 border-nebula-800 text-nebula-accent focus:ring-0"
                  />
                  <span>Aplicar esta tarea como regla GLOBAL para todos los servidores actuales y futuros</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-nebula-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Crear Tarea Programada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
