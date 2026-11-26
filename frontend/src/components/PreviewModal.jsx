import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X, Loader2, FileQuestion, AlertCircle } from 'lucide-react';
import { api, resolveUrl } from '../lib/api';
import { previewKind } from '../lib/fileTypes';
import { formatBytes, formatDateTime } from '../lib/format';
import { useToast } from '../context/ToastContext';
import FileIcon from './FileIcon';

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export async function downloadFile(file, toast) {
  try {
    const { url } = await api.get(`/files/${file.id}/url`, { disposition: 'attachment' });
    const a = document.createElement('a');
    a.href = resolveUrl(url);
    a.download = file.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast?.info(`Mengunduh "${file.name}"...`);
  } catch (err) {
    toast?.error(err.message, { title: 'Gagal mengunduh' });
  }
}

/** In-App File Preview Modal: PDF, gambar, teks, video & audio. */
export default function PreviewModal({ files, index, onClose, onIndexChange }) {
  const toast = useToast();
  const file = index !== null && index !== undefined ? files[index] : null;
  const [url, setUrl] = useState(null);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const kind = file ? previewKind(file) : null;

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setUrl(null);
    setText(null);
    setError(null);
    if (!kind) return;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/files/${file.id}/url`, { disposition: 'inline' });
        const resolved = resolveUrl(res.url);
        if (kind === 'text') {
          if (file.sizeBytes > MAX_TEXT_BYTES) throw new Error('File teks terlalu besar untuk dipratinjau (maks 2 MB).');
          const r = await fetch(resolved);
          if (!r.ok) throw new Error('Gagal memuat isi file.');
          const body = await r.text();
          if (!cancelled) setText(body);
        }
        if (!cancelled) setUrl(resolved);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Gagal memuat pratinjau.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, kind]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < files.length - 1) onIndexChange(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file, index, files.length, onClose, onIndexChange]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 text-white sm:px-6">
        <FileIcon file={file} size="sm" className="!bg-white/10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-white/60">
            {formatBytes(file.sizeBytes)} · {formatDateTime(file.createdAt)}
            {file.uploadedBy?.name ? ` · ${file.uploadedBy.name}` : ''}
          </p>
        </div>
        <button
          className="btn btn-sm bg-white/10 text-white hover:bg-white/20"
          onClick={() => downloadFile(file, toast)}
        >
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Unduh</span>
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10" onClick={onClose} aria-label="Tutup">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16" onClick={onClose}>
        <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {loading && <Loader2 className="h-10 w-10 animate-spin text-white/70" />}

          {!loading && error && (
            <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
              <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
            </div>
          )}

          {!loading && !error && !kind && (
            <div className="max-w-sm rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
              <FileQuestion className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <h3 className="font-semibold">Pratinjau tidak tersedia</h3>
              <p className="mt-1 text-sm text-slate-500">Tipe file ini belum bisa dipratinjau. Silakan unduh untuk membukanya.</p>
              <button className="btn-primary mt-5" onClick={() => downloadFile(file, toast)}>
                <Download className="h-4 w-4" /> Unduh File
              </button>
            </div>
          )}

          {!loading && !error && url && kind === 'image' && (
            <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          )}
          {!loading && !error && url && kind === 'pdf' && (
            <iframe src={url} title={file.name} className="h-full w-full max-w-5xl rounded-lg bg-white shadow-2xl" />
          )}
          {!loading && !error && url && kind === 'video' && (
            <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-2xl" />
          )}
          {!loading && !error && url && kind === 'audio' && (
            <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900">
              <FileIcon file={file} size="lg" className="mx-auto mb-4" />
              <audio src={url} controls autoPlay className="w-full" />
            </div>
          )}
          {!loading && !error && text !== null && kind === 'text' && (
            <pre className="h-full w-full max-w-5xl overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-6 font-mono text-[13px] leading-relaxed text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-200">
              {text || '(file kosong)'}
            </pre>
          )}
        </div>

        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index - 1);
            }}
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < files.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index + 1);
            }}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      <p className="pb-3 text-center text-xs text-white/50">
        {index + 1} dari {files.length} · gunakan tombol ← → untuk berpindah
      </p>
    </div>
  );
}
