import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext(null);

const STYLES = {
  success: { Icon: CheckCircle2, color: 'text-emerald-500', bar: 'bg-emerald-500' },
  error: { Icon: XCircle, color: 'text-red-500', bar: 'bg-red-500' },
  warning: { Icon: AlertTriangle, color: 'text-amber-500', bar: 'bg-amber-500' },
  info: { Icon: Info, color: 'text-brand-500', bar: 'bg-brand-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, opts = {}) => {
      const id = ++idRef.current;
      const duration = opts.duration ?? (type === 'error' ? 6000 : 3500);
      setToasts((t) => [...t.slice(-4), { id, type, message, title: opts.title }]);
      setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      warning: (m, o) => push('warning', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => {
          const { Icon, color, bar } = STYLES[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto relative flex w-full max-w-sm animate-slide-up items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 pr-10 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            >
              <span className={clsx('absolute inset-y-0 left-0 w-1', bar)} />
              <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', color)} />
              <div className="min-w-0 text-sm">
                {t.title && <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>}
                <p className="break-words text-slate-600 dark:text-slate-300">{t.message}</p>
              </div>
              <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 icon-btn h-7 w-7" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
