import { useEffect, useState } from 'react';
import clsx from 'clsx';

const UNITS = [
  { label: 'MB', factor: 1024 ** 2 },
  { label: 'GB', factor: 1024 ** 3 },
  { label: 'TB', factor: 1024 ** 4 },
];

function split(bytes) {
  if (!bytes) return { amount: '', unit: 'GB' };
  for (const u of [...UNITS].reverse()) {
    const v = bytes / u.factor;
    if (v >= 1 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6) return { amount: String(+v.toFixed(2)), unit: u.label };
  }
  return { amount: String(+(bytes / UNITS[0].factor).toFixed(2)), unit: 'MB' };
}

/** Input ukuran (angka + satuan) yang menghasilkan nilai byte. */
export default function SizeInput({ value, onChange, presets = [], id }) {
  const [state, setState] = useState(() => split(value));

  useEffect(() => {
    const current = Math.round(Number(state.amount) * UNITS.find((u) => u.label === state.unit).factor);
    if (value !== current) setState(split(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (amount, unit) => {
    setState({ amount, unit });
    const factor = UNITS.find((u) => u.label === unit).factor;
    const num = Number(amount);
    onChange(amount === '' || Number.isNaN(num) ? 0 : Math.round(num * factor));
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          type="number"
          min="0"
          step="any"
          className="input"
          placeholder="0"
          value={state.amount}
          onChange={(e) => emit(e.target.value, state.unit)}
        />
        <select className="input w-24" value={state.unit} onChange={(e) => emit(state.amount, e.target.value)}>
          {UNITS.map((u) => (
            <option key={u.label}>{u.label}</option>
          ))}
        </select>
      </div>
      {presets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const active = value === p.bytes;
            return (
              <button
                type="button"
                key={p.label}
                onClick={() => onChange(p.bytes)}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MB = 1024 ** 2;
const GB = 1024 ** 3;
export const QUOTA_PRESETS = [
  { label: '500 MB', bytes: 500 * MB },
  { label: '1 GB', bytes: GB },
  { label: '2 GB', bytes: 2 * GB },
  { label: '10 GB', bytes: 10 * GB },
  { label: '50 GB', bytes: 50 * GB },
  { label: '500 GB', bytes: 500 * GB },
];
export const CAPACITY_PRESETS = [
  { label: '10 GB', bytes: 10 * GB },
  { label: '25 GB', bytes: 25 * GB },
  { label: '100 GB', bytes: 100 * GB },
  { label: '1 TB', bytes: 1024 * GB },
];
