import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, onClose, title, description, size = 'md', footer, hideHeader, children, icon }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative flex max-h-[92vh] w-full animate-scale-in flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl',
          SIZES[size]
        )}
      >
        {!hideHeader && (
          <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            {icon && (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            <button className="icon-btn -mr-2" onClick={onClose} aria-label="Tutup">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
