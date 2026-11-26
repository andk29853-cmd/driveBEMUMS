import { useEffect, useState } from 'react';
import { Folder, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import ProgressBar from './ProgressBar';
import { api } from '../lib/api';
import { folderColor } from '../lib/fileTypes';
import { formatBytes, percent } from '../lib/format';

export default function FolderPickerModal({ open, onClose, onSelect, title = 'Pilih folder' }) {
  const [folders, setFolders] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFolders(null);
    api
      .get('/folders/roots')
      .then((r) => setFolders(r.folders))
      .catch(() => setFolders([]));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title} description="Pilih Folder Utama tujuan unggahan.">
      {!folders ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Anda belum memiliki akses ke folder mana pun.</p>
      ) : (
        <div className="space-y-2">
          {folders.map((f) => {
            const c = folderColor(f.color);
            const pct = percent(f.usedBytes, f.quotaLimitBytes);
            const full = f.quotaLimitBytes && f.usedBytes >= f.quotaLimitBytes;
            return (
              <button
                key={f.id}
                disabled={full}
                onClick={() => onSelect(f)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg}`}>
                  <Folder className={`h-5 w-5 ${c.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <ProgressBar value={pct} size="sm" className="mt-1.5" />
                  <p className="mt-1 text-xs text-slate-500">
                    {full ? 'Kuota penuh' : `Sisa ${formatBytes(Math.max(0, f.quotaLimitBytes - f.usedBytes))}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
