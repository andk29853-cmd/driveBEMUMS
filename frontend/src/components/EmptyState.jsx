export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-14 text-center dark:border-slate-800">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <Icon className="h-8 w-8" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
