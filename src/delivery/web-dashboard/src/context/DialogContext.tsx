import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttonLabel?: string;
  variant?: 'error' | 'warning' | 'success' | 'info';
}

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'warning' | 'info';
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  toast: (message: string, variant?: ToastItem['variant']) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface ActiveDialogState {
  mode: 'confirm' | 'alert';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'warning' | 'info' | 'error' | 'success';
  resolve: (result: boolean) => void;
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<ActiveDialogState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastItem['variant'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    const isDeleteMsg = /eliminar|borrar|desinstalar/i.test(opts.message);
    return new Promise<boolean>((resolve) => {
      setActiveDialog({
        mode: 'confirm',
        title: opts.title || (isDeleteMsg ? 'Confirmar Eliminación' : 'Confirmación Requerida'),
        message: opts.message,
        confirmLabel: opts.confirmLabel || (isDeleteMsg ? 'Eliminar Definitivamente' : 'Confirmar'),
        cancelLabel: opts.cancelLabel || 'Cancelar',
        variant: opts.variant || (isDeleteMsg ? 'danger' : 'warning'),
        resolve
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>((resolve) => {
      setActiveDialog({
        mode: 'alert',
        title: opts.title || 'Aviso del Sistema',
        message: opts.message,
        confirmLabel: opts.buttonLabel || 'Entendido',
        cancelLabel: '',
        variant: opts.variant || 'error',
        resolve: () => resolve()
      });
    });
  }, []);

  const handleClose = useCallback(
    (result: boolean) => {
      if (!activeDialog) return;
      const resolver = activeDialog.resolve;
      setActiveDialog(null);
      resolver(result);
    },
    [activeDialog]
  );

  // Keyboard support: Escape to cancel, Enter to confirm
  useEffect(() => {
    if (!activeDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleClose(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDialog, handleClose]);

  const getVariantConfig = (variant: ActiveDialogState['variant']) => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-5 h-5 text-rose-400" />,
          badgeBg: 'bg-rose-500/15 border-rose-500/30',
          borderAccent: 'border-rose-500/40',
          tag: 'OPERACIÓN DESTRUCTIVA',
          tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
        };
      case 'error':
        return {
          icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
          badgeBg: 'bg-rose-500/15 border-rose-500/30',
          borderAccent: 'border-rose-500/40',
          tag: 'ERROR DE OPERACIÓN',
          tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          badgeBg: 'bg-amber-500/15 border-amber-500/30',
          borderAccent: 'border-amber-500/40',
          tag: 'VERIFICACIÓN TÁCTICA',
          tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          confirmBtn: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
          borderAccent: 'border-emerald-500/40',
          tag: 'COMPLETADO',
          tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          confirmBtn: 'bg-nebula-accent hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-nebula-accent/20'
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-nebula-cyber" />,
          badgeBg: 'bg-nebula-cyber/15 border-nebula-cyber/30',
          borderAccent: 'border-nebula-cyber/40',
          tag: 'SISTEMA SINGULARITY',
          tagColor: 'text-nebula-cyber bg-nebula-cyber/10 border-nebula-cyber/30',
          confirmBtn: 'bg-nebula-accent hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-nebula-accent/20'
        };
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert, toast }}>
      {children}

      {/* Tactical Modal Overlay */}
      {activeDialog && (() => {
        const cfg = getVariantConfig(activeDialog.variant);
        return (
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
            onClick={() => handleClose(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-md bg-nebula-900 border ${cfg.borderAccent} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150`}
            >
              {/* Tactical Top Accent Bar */}
              <div className="px-5 py-3.5 border-b border-nebula-800 bg-nebula-950/90 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl border ${cfg.badgeBg} flex items-center justify-center shrink-0`}>
                    {cfg.icon}
                  </div>
                  <div>
                    <span className={`inline-block text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.2 rounded border ${cfg.tagColor}`}>
                      {cfg.tag}
                    </span>
                    <h3 className="text-sm font-bold text-slate-100 mt-0.5">{activeDialog.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-nebula-850 transition-colors"
                  title="Cerrar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                {activeDialog.message}
              </div>

              {/* Footer Actions */}
              <div className="px-5 py-3.5 border-t border-nebula-800 bg-nebula-950/60 flex items-center justify-end gap-2.5">
                {activeDialog.mode === 'confirm' && (
                  <button
                    type="button"
                    onClick={() => handleClose(false)}
                    className="px-3.5 py-2 rounded-xl bg-nebula-850 hover:bg-nebula-800 text-slate-300 hover:text-white border border-nebula-750 text-xs font-medium transition-all active:scale-[0.98]"
                  >
                    {activeDialog.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleClose(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${cfg.confirmBtn}`}
                >
                  {activeDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Non-Blocking Tactical Toasts Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto p-3 rounded-xl border shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5 text-xs font-mono animate-in slide-in-from-bottom-2 duration-150 ${
                t.variant === 'error'
                  ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                  : t.variant === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                  : t.variant === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                  : 'bg-nebula-900/95 border-nebula-750 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {t.variant === 'error' ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                ) : t.variant === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className="truncate">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog debe usarse dentro de un DialogProvider');
  }
  return ctx;
}
