import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from '../components/Modal';

const ConfirmContext = createContext(null);

/** const confirm = useConfirm(); if (await confirm({ title, message, danger: true })) {...} */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setState(opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setBusy(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={Boolean(state)} onClose={() => !busy && close(false)} size="sm" hideHeader>
        {state && (
          <div className="text-center">
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                state.danger ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10'
              }`}
            >
              {state.danger ? <AlertTriangle className="h-7 w-7" /> : <HelpCircle className="h-7 w-7" />}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{state.title}</h3>
            {state.message && <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{state.message}</div>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn-secondary" onClick={() => close(false)} disabled={busy}>
                {state.cancelText || 'Batal'}
              </button>
              <button
                className={state.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => close(true)}
                disabled={busy}
                autoFocus
              >
                {state.confirmText || 'Ya, lanjutkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
