import clsx from 'clsx';

export function quotaTone(pct) {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-amber-500';
  return 'bg-brand-500';
}

export default function ProgressBar({ value = 0, color, className, size = 'md' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={clsx(
        'w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800',
        size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2',
        className
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', color || quotaTone(pct))}
        style={{ width: `${pct > 0 && pct < 1.5 ? 1.5 : pct}%` }}
      />
    </div>
  );
}
