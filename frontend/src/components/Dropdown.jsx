import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * Dropdown menu sederhana. `trigger` adalah render-prop yang menerima { open, toggle }.
 * items: [{ label, icon: Icon, onClick, danger, hidden, divider }]
 */
export default function Dropdown({ trigger, items, align = 'right', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative', className)} onClick={(e) => e.stopPropagation()}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={clsx('menu', align === 'right' ? 'right-0' : 'left-0')}>
          {items
            .filter((i) => !i.hidden)
            .map((item, idx) =>
              item.divider ? (
                <div key={idx} className="my-1 border-t border-slate-100 dark:border-slate-700" />
              ) : (
                <button
                  key={idx}
                  className={clsx('menu-item', item.danger && 'text-red-600 dark:text-red-400')}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {item.icon && <item.icon className="h-4 w-4 opacity-80" />}
                  {item.label}
                </button>
              )
            )}
        </div>
      )}
    </div>
  );
}
