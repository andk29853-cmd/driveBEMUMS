import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, X, UploadCloud, Ban } from 'lucide-react';
import clsx from 'clsx';
import { useUpload } from '../context/UploadContext';
import { formatBytes } from '../lib/format';
import FileIcon from './FileIcon';
import ProgressBar from './ProgressBar';

export default function UploadPanel() {
  const { items, cancel, clearFinished } = useUpload();
  const [collapsed, setCollapsed] = useState(false);
  if (!items.length) return null;

  const running = items.filter((i) => ['queued', 'uploading', 'finalizing'].includes(i.status));
  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const overall = items.length ? items.reduce((s, i) => s + (i.status === 'done' ? 100 : i.progress || 0), 0) / items.length : 0;

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:bottom-4">
      <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white dark:bg-slate-800">
        <UploadCloud className="h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {running.length ? `Mengunggah ${running.length} file...` : `${done} file selesai diunggah`}
          </p>
          {failed > 0 && <p className="text-xs text-red-300">{failed} gagal</p>}
        </div>
        <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setCollapsed((c) => !c)} aria-label="Ciutkan">
          <ChevronDown className={clsx('h-4 w-4 transition', collapsed && 'rotate-180')} />
        </button>
        {!running.length && (
          <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={clearFinished} aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {running.length > 0 && <ProgressBar value={overall} size="sm" className="rounded-none" color="bg-brand-500" />}
      {!collapsed && (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {items
            .slice()
            .reverse()
            .map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileIcon file={{ name: item.name, category: guessCategory(item.file) }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.status === 'uploading' ? (
                    <div className="mt-1 flex items-center gap-2">
                      <ProgressBar value={item.progress} size="sm" color="bg-brand-500" />
                      <span className="w-9 text-right text-[11px] tabular-nums text-slate-500">{item.progress}%</span>
                    </div>
                  ) : (
                    <p
                      className={clsx(
                        'truncate text-xs',
                        item.status === 'error' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                      )}
                      title={item.error}
                    >
                      {item.status === 'queued' && `Menunggu · ${formatBytes(item.size)}`}
                      {item.status === 'finalizing' && 'Memverifikasi...'}
                      {item.status === 'done' && `${formatBytes(item.size)}${item.bucket ? ` · ${item.bucket}` : ''}`}
                      {(item.status === 'error' || item.status === 'canceled') && item.error}
                    </p>
                  )}
                </div>
                {item.status === 'done' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                {item.status === 'error' && <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
                {item.status === 'canceled' && <Ban className="h-5 w-5 shrink-0 text-slate-400" />}
                {item.status === 'finalizing' && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-500" />}
                {['queued', 'uploading'].includes(item.status) && (
                  <button className="icon-btn h-7 w-7" onClick={() => cancel(item.id)} aria-label="Batalkan">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function guessCategory(file) {
  const t = file?.type || '';
  if (t === 'application/pdf') return 'PDF';
  if (t.startsWith('image/')) return 'IMAGE';
  if (t.startsWith('video/')) return 'VIDEO';
  if (t.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}
