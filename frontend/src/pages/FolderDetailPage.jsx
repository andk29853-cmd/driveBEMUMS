import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Home,
  UploadCloud,
  FolderPlus,
  Settings2,
  Folder,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { onDriveChange, emitDriveChange } from '../lib/events';
import { folderColor } from '../lib/fileTypes';
import { formatBytes, percent } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import ProgressBar from '../components/ProgressBar';
import FileExplorer from '../components/FileExplorer';
import PreviewModal from '../components/PreviewModal';
import PromptModal from '../components/PromptModal';
import RootFolderModal from '../components/RootFolderModal';

export default function FolderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { addFiles, openFilePicker, setCurrentFolder } = useUpload();
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);

  // Modals
  const [newSubfolderOpen, setNewSubfolderOpen] = useState(false);
  const [editRootOpen, setEditRootOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState(null);
  const [renameFileTarget, setRenameFileTarget] = useState(null);
  const [previewState, setPreviewState] = useState({ files: [], index: null });

  const loadFolder = useCallback(async () => {
    try {
      const res = await api.get(`/folders/${id}`);
      setData(res);
      setCurrentFolder({ id: res.folder.id, name: res.folder.name, rootId: res.folder.rootId });
    } catch (err) {
      toast.error(err.message);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, setCurrentFolder, toast]);

  useEffect(() => {
    setLoading(true);
    loadFolder();
    return onDriveChange(loadFolder);
  }, [loadFolder]);

  useEffect(() => {
    return () => setCurrentFolder(null);
  }, [setCurrentFolder]);

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer?.files?.length && data?.folder) {
      addFiles(e.dataTransfer.files, data.folder.id);
    }
  };

  // Subfolder actions
  const handleCreateSubfolder = async (name) => {
    try {
      await api.post('/folders', { name, parentId: id });
      toast.success(`Subfolder "${name}" berhasil dibuat.`);
      setNewSubfolderOpen(false);
      emitDriveChange({ type: 'folder', folderId: id });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRenameFolder = async (name) => {
    if (!renameFolderTarget) return;
    try {
      await api.patch(`/folders/${renameFolderTarget.id}`, { name });
      toast.success('Nama folder berhasil diperbarui.');
      setRenameFolderTarget(null);
      loadFolder();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteFolder = async (subfolder) => {
    const ok = await confirm({
      title: `Hapus subfolder "${subfolder.name}"?`,
      message: 'Seluruh file dan subfolder di dalamnya akan ikut dihapus secara permanen dan kuota akan dikembalikan.',
      confirmText: 'Ya, Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/folders/${subfolder.id}`);
      toast.success(`Subfolder "${subfolder.name}" berhasil dihapus.`);
      emitDriveChange({ type: 'folder', folderId: id });
    } catch (err) {
      toast.error(err.message);
    }
  };

  // File actions
  const handleRenameFile = async (name) => {
    if (!renameFileTarget) return;
    try {
      await api.patch(`/files/${renameFileTarget.id}`, { name });
      toast.success('Nama file berhasil diperbarui.');
      setRenameFileTarget(null);
      loadFolder();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteFile = async (file) => {
    const ok = await confirm({
      title: `Hapus file "${file.name}"?`,
      message: `File berukuran ${formatBytes(file.sizeBytes)} akan dihapus permanen dan kuota folder otomatis berkurang.`,
      confirmText: 'Hapus File',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/files/${file.id}`);
      toast.success(`File "${file.name}" berhasil dihapus.`);
      emitDriveChange({ type: 'file', folderId: id });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const root = data?.root;
  const folder = data?.folder;
  const c = folderColor(root?.color || 'blue');
  const pct = root ? percent(root.usedBytes, root.quotaLimitBytes) : 0;
  const remaining = root ? Math.max(0, (root.quotaLimitBytes || 0) - root.usedBytes) : 0;
  const isQuotaFull = root?.quotaLimitBytes && root.usedBytes >= root.quotaLimitBytes;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-[calc(100vh-8rem)] space-y-6"
    >
      {/* Overlay Drag & Drop */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-900/40 p-6 backdrop-blur-xs">
          <div className="flex max-w-md flex-col items-center rounded-3xl border-2 border-dashed border-brand-400 bg-white p-10 text-center shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
              <UploadCloud className="h-8 w-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Lepaskan file untuk mengunggah ke &ldquo;{folder?.name}&rdquo;
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Kuota akan divalidasi dan file langsung diunggah ke storage bucket aktif.
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigasi Folder */}
      <nav aria-label="Breadcrumb" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1 text-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Home className="h-4 w-4" />
          <span>Semua Folder</span>
        </Link>
        {data?.breadcrumb?.map((crumb, idx) => {
          const isLast = idx === data.breadcrumb.length - 1;
          return (
            <div key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4 text-slate-400" />
              {isLast ? (
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  to={`/folders/${crumb.id}`}
                  className="rounded-lg px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {crumb.name}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Header Folder & Kartu Ringkasan Kuota Induk */}
      {root && (
        <div className="card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <div className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', c.bg)}>
                <Folder className={clsx('h-6 w-6', c.text)} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{folder?.name}</h1>
                  {!folder?.isRoot && (
                    <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Induk: {root.name}
                    </span>
                  )}
                </div>
                {root.description && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{root.description}</p>
                )}
              </div>
            </div>

            {/* Tombol Aksi Utama */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              {isManager && (
                <button type="button" onClick={() => setEditRootOpen(true)} className="btn-secondary col-span-2 sm:col-span-1">
                  <Settings2 className="h-4 w-4" />
                  <span>Atur Kuota</span>
                </button>
              )}
              <button type="button" onClick={() => setNewSubfolderOpen(true)} className="btn-secondary">
                <FolderPlus className="h-4 w-4" />
                <span>Subfolder Baru</span>
              </button>
              <button
                type="button"
                disabled={isQuotaFull}
                onClick={() => openFilePicker(id)}
                className="btn-primary"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Upload File</span>
              </button>
            </div>
          </div>

          {/* Bar Kuota Folder Utama */}
          <div className="mt-4 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Kuota Folder Utama ({root.name}):{' '}
                <b>
                  {formatBytes(root.usedBytes)} dari {formatBytes(root.quotaLimitBytes)}
                </b>{' '}
                terpakai
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Sisa {formatBytes(remaining)} ({pct.toFixed(1)}%)
              </span>
            </div>
            <ProgressBar value={pct} size="md" />
            {isQuotaFull && (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Kuota folder ini sudah penuh. Hapus beberapa file atau hubungi Admin/Sekretaris untuk menambah kuota.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zona Drag & Drop Ringkas */}
      <div
        onClick={() => !isQuotaFull && openFilePicker(id)}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition',
          isQuotaFull
            ? 'cursor-not-allowed border-red-200 bg-red-50/40 opacity-60 dark:border-red-900/40 dark:bg-red-950/20'
            : 'border-slate-200 bg-white/60 hover:border-brand-400 hover:bg-brand-50/30 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-brand-500/50'
        )}
      >
        <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-3">
          <UploadCloud className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-brand-600 dark:text-brand-400">Klik untuk memilih file</span> atau
            tarik &amp; lepas (drag-and-drop) file ke halaman ini untuk langsung mengunggah.
          </p>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Batas ukuran upload: maksimal{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {formatBytes(data?.limits?.maxFileSizeBytes || 5120 * 1024 * 1024)}
          </span>{' '}
          per file.
        </p>
      </div>

      {/* Daftar Subfolder & File */}
      <FileExplorer
        folders={data?.children || []}
        files={data?.files || []}
        loading={loading}
        onOpenFolder={(sub) => navigate(`/folders/${sub.id}`)}
        onRenameFolder={(sub) => setRenameFolderTarget(sub)}
        onDeleteFolder={handleDeleteFolder}
        onPreviewFile={(files, index) => setPreviewState({ files, index })}
        onRenameFile={(file) => setRenameFileTarget(file)}
        onDeleteFile={handleDeleteFile}
        onUploadClick={() => openFilePicker(id)}
      />

      {/* Modal Buat Subfolder */}
      <PromptModal
        open={newSubfolderOpen}
        onClose={() => setNewSubfolderOpen(false)}
        onSubmit={handleCreateSubfolder}
        title="Buat Subfolder Baru"
        label="Nama Subfolder"
        confirmText="Buat Subfolder"
        icon={<FolderPlus className="h-5 w-5" />}
      />

      {/* Modal Ganti Nama Subfolder */}
      <PromptModal
        open={Boolean(renameFolderTarget)}
        onClose={() => setRenameFolderTarget(null)}
        onSubmit={handleRenameFolder}
        title="Ganti Nama Subfolder"
        label="Nama Subfolder Baru"
        initialValue={renameFolderTarget?.name || ''}
      />

      {/* Modal Ganti Nama File */}
      <PromptModal
        open={Boolean(renameFileTarget)}
        onClose={() => setRenameFileTarget(null)}
        onSubmit={handleRenameFile}
        title="Ganti Nama File"
        label="Nama File Baru"
        initialValue={renameFileTarget?.name || ''}
        selectBaseName
      />

      {/* Modal Atur Kuota & Anggota Folder Utama */}
      <RootFolderModal
        open={editRootOpen}
        folder={root}
        onClose={() => setEditRootOpen(false)}
        onSaved={loadFolder}
      />

      {/* Modal Pratinjau File */}
      <PreviewModal
        files={previewState.files}
        index={previewState.index}
        onClose={() => setPreviewState({ files: [], index: null })}
        onIndexChange={(index) => setPreviewState((s) => ({ ...s, index }))}
      />
    </div>
  );
}
