import clsx from 'clsx';

export function GridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-3">
          <div className="skeleton mb-3 h-24 w-full rounded-xl" />
          <div className="skeleton mb-2 h-3.5 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="card divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <div className="skeleton mb-2 h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/5" />
          </div>
          <div className="skeleton hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3, className }) {
  return (
    <div className={clsx('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="skeleton h-11 w-11 rounded-xl" />
            <div className="flex-1">
              <div className="skeleton mb-2 h-4 w-2/3" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </div>
          <div className="skeleton mb-2 h-2 w-full" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
