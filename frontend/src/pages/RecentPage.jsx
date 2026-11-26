import { useCallback, useEffect, useState } from 'react';
import { Clock, UploadCloud } from 'lucide-react';
import { api } from '../lib/api';
import { onDriveChange, emitDriveChange } from '../lib/events';
import { formatBytes } from '../lib/format';
import { useUpload } from '../context/UploadContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import FileExplorer from '../components/FileExplorer';
import PreviewModal from '../components/PreviewModal';
import PromptModal from '../components/PromptModal';

export default function RecentPage() {
  const { setCurrentFolder, openFilePicker } = useUpload();
  const toast = useToast();
  const confirm = useConfirm();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewState, setPreviewState] = useState({ files: [], index: null });
  const [renameTarget, setRenameTarget] = useState(null);

  useEffect(() => {
    setCurrentFolder(null);
  }, [setCurrentFolder]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await api.get('/files/recent', { limit: 60 });
      setFiles(res.files);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRecent();
    return onDriveChange(loadRecent);
  }, [loadRecent]);

  const handleRename = async (name) => {
    if (!renameTarget) return;
    try {
      await api.patch(`/files/${renameTarget.id}`, { name });
      toast.success('Nama file berhasil diperbarui.');
      setRenameTarget(null);
      loadRecent();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (file) => {
    const ok = await confirm({
      title: `Hapus file "${file.name}"?`,
      message: `File berukuran ${formatBytes(file.sizeBytes)} akan dihapus permanen dan kuota folder akan berkurang otomatis.`,
      confirmText: 'Hapus File',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/files/${file.id}`);
      toast.success(`File "${file.name}" berhasil dihapus.`);
      emitDriveChange({ type: 'file' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">File Terbaru</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Daftar dokumen dan arsip yang baru saja diunggah ke folder Anda.
            </p>
          </div>
        </div>

        <button type="button" onClick={() => openFilePicker()} className="btn-primary">
          <UploadCloud className="h-4 w-4" />
          <span>Upload File</span>
        </button>
      </div>

      <FileExplorer
        files={files}
        loading={loading}
        showFolderLocation
        onPreviewFile={(list, index) => setPreviewState({ files: list, index })}
        onRenameFile={(file) => setRenameTarget(file)}
        onDeleteFile={handleDelete}
        onUploadClick={() => openFilePicker()}
        emptyTitle="Belum ada file terbaru"
        emptyDescription="Unggah dokumen pertama Anda ke salah satu Folder Utama."
      />

      <PreviewModal
        files={previewState.files}
        index={previewState.index}
        onClose={() => setPreviewState({ files: [], index: null })}
        onIndexChange={(index) => setPreviewState((s) => ({ ...s, index }))}
      />

      <PromptModal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRename}
        title="Ganti Nama File"
        label="Nama File Baru"
        initialValue={renameTarget?.name || ''}
        selectBaseName
      />
    </div>
  );
}
