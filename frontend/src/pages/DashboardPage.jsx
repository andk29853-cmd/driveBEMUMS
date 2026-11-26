import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  HardDrive,
  FileText,
  Users,
  Search,
  X,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { onDriveChange, emitDriveChange } from '../lib/events';
import { folderColor, TYPE_FILTERS } from '../lib/fileTypes';
import { formatBytes, percent } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import ProgressBar from '../components/ProgressBar';
import Dropdown from '../components/Dropdown';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, GridSkeleton } from '../components/Skeleton';
import RootFolderModal from '../components/RootFolderModal';
import PreviewModal from '../components/PreviewModal';
import PromptModal from '../components/PromptModal';
import FileExplorer from '../components/FileExplorer';

export default function DashboardPage() {
  const { user, appSettings, isManager } = useAuth();
  const { setCurrentFolder, openFilePicker } = useUpload();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [roots, setRoots] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Modals
  const [folderModal, setFolderModal] = useState({ open: false, folder: null });
  const [previewState, setPreviewState] = useState({ files: [], index: null });
  const [renameFileTarget, setRenameFileTarget] = useState(null);

  useEffect(() => {
    setCurrentFolder(null);
  }, [setCurrentFolder]);

  const loadData = useCallback(async () => {
    try {
      const [rootsRes, statsRes] = await Promise.all([
        api.get('/folders/roots'),
        user ? api.get('/stats/overview') : Promise.resolve(null),
      ]);
      setRoots(rootsRes.folders);
      setOverview(statsRes);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    loadData();
    return onDriveChange(loadData);
  }, [loadData]);

  // Instant search across all accessible files & folders
  const isSearchActive = Boolean(searchQuery.trim() || typeFilter);

  const runSearch = useCallback(async () => {
    if (!user || (!searchQuery.trim() && !typeFilter)) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get('/files/search', { q: searchQuery.trim(), type: typeFilter });
      setSearchResults(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, typeFilter, toast]);

  useEffect(() => {
    const t = setTimeout(runSearch, 200);
    return () => clearTimeout(t);
  }, [runSearch]);

  const handleOpenRootFolder = (folder) => {
    navigate(`/folders/${folder.id}`);
  };

  const handleDeleteRootFolder = async (folder) => {
    const ok = await confirm({
      title: `Hapus Folder Utama "${folder.name}"?`,
      message: `Seluruh subfolder dan ${folder._count?.rootFiles ?? 0} file (${formatBytes(
        folder.usedBytes
      )}) di dalamnya akan dihapus permanen serta kuota bucket akan dikembalikan.`,
      confirmText: 'Ya, Hapus Permanen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/folders/${folder.id}`);
      toast.success(`Folder "${folder.name}" berhasil dihapus.`);
      emitDriveChange({ type: 'folder' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRenameFile = async (newName) => {
    if (!renameFileTarget) return;
    try {
      await api.patch(`/files/${renameFileTarget.id}`, { name: newName });
      toast.success('Nama file berhasil diperbarui.');
      setRenameFileTarget(null);
      runSearch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteFile = async (file) => {
    const ok = await confirm({
      title: `Hapus file "${file.name}"?`,
      message: `File berukuran ${formatBytes(file.sizeBytes)} akan dihapus dari storage dan kuota folder akan berkurang otomatis.`,
      confirmText: 'Hapus File',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/files/${file.id}`);
      toast.success(`File "${file.name}" berhasil dihapus.`);
      emitDriveChange({ type: 'file' });
      runSearch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const usedBytes = overview?.usedBytes ?? 0;
  const capacityBytes = overview?.capacityBytes ?? 0;
  const totalPct = percent(usedBytes, capacityBytes);

  return (
    <div className="space-y-6">
      {/* Header & Global Instant Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Semua Folder Utama</h1>
            {appSettings?.cabinetName && (
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {appSettings.cabinetName}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Pilih folder kabinet atau kementerian untuk menyimpan, mencari, dan mengelola arsip dokumen.
          </p>
        </div>

        {user && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => openFilePicker()} className="btn-secondary">
              <UploadCloud className="h-4 w-4" />
              <span>Upload File</span>
            </button>
            {isManager && (
              <button
                type="button"
                onClick={() => setFolderModal({ open: true, folder: null })}
                className="btn-primary"
              >
                <FolderPlus className="h-4 w-4" />
                <span>Folder Utama Baru</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stat Cards Ringkasan (2x2 di mobile, 4 kolom di desktop) */}
      {overview && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="card p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:text-xs">
                Kapasitas drive
              </span>
              <HardDrive className="h-4 w-4 shrink-0 text-brand-600" />
            </div>
            <p className="mt-1.5 text-base font-bold text-slate-900 dark:text-white sm:mt-2 sm:text-lg">
              {formatBytes(usedBytes)}{' '}
              <span className="text-[11px] font-normal text-slate-500 sm:text-xs">/ {formatBytes(capacityBytes)}</span>
            </p>
            <ProgressBar value={totalPct} size="sm" className="mt-2" />
          </div>

          <div className="card p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:text-xs">
                Folder Utama
              </span>
              <Folder className="h-4 w-4 shrink-0 text-violet-600" />
            </div>
            <p className="mt-1.5 text-base font-bold text-slate-900 dark:text-white sm:mt-2 sm:text-lg">
              {overview.counts?.folders ?? roots.length} Folder
            </p>
            <p className="mt-1 line-clamp-1 text-[11px] text-slate-500 sm:text-xs">
              {isManager && overview.allocatedQuotaBytes !== undefined
                ? `Alokasi: ${formatBytes(overview.allocatedQuotaBytes)}`
                : 'Workspace divisi'}
            </p>
          </div>

          <div className="card p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:text-xs">
                Total Arsip
              </span>
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
            <p className="mt-1.5 text-base font-bold text-slate-900 dark:text-white sm:mt-2 sm:text-lg">
              {overview.counts?.files ?? 0} File
            </p>
            <p className="mt-1 line-clamp-1 text-[11px] text-slate-500 sm:text-xs">PDF, dokumen &amp; gambar</p>
          </div>

          {isManager ? (
            <div
              onClick={() => navigate('/buckets')}
              className="card cursor-pointer p-4 transition hover:border-brand-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Multi-Bucket Router</span>
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {overview.counts?.activeBuckets ?? 0} Bucket Aktif
              </p>
              <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                {overview.counts?.users ?? 0} pengguna terdaftar · Kelola bucket →
              </p>
            </div>
          ) : (
            <div
              onClick={() => navigate('/recent')}
              className="card cursor-pointer p-4 transition hover:border-brand-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Akses Cepat</span>
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">Arsip Terbaru</p>
              <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">Lihat file yang baru diunggah →</p>
            </div>
          )}
        </div>
      )}

      {/* Bar Pencarian Cepat & Filter Tipe Dokumen Lintas Folder (khusus user login) */}
      {user && (
        <div className="card min-w-0 overflow-hidden p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari cepat file atau folder di seluruh workspace..."
              className="input pl-10 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={clsx(
                  'shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition',
                  typeFilter === t.value
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Jika Pencarian / Filter Aktif, tampilkan hasil pencarian */}
      {isSearchActive ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Hasil Pencarian {searchQuery ? `"${searchQuery}"` : ''}
            </h2>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('');
              }}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Reset Pencarian
            </button>
          </div>

          {searching ? (
            <GridSkeleton count={6} />
          ) : (
            <FileExplorer
              folders={searchResults?.folders || []}
              files={searchResults?.files || []}
              showFolderLocation
              onOpenFolder={(f) => navigate(`/folders/${f.id}`)}
              onPreviewFile={(files, index) => setPreviewState({ files, index })}
              onRenameFile={(file) => setRenameFileTarget(file)}
              onDeleteFile={handleDeleteFile}
              emptyTitle="Tidak ditemukan file atau folder"
              emptyDescription="Coba gunakan kata kunci lain atau ubah filter tipe dokumen."
            />
          )}
        </div>
      ) : (
        /* Daftar Kartu Folder Utama dengan Progress Bar Kuota Dinamis */
        <div>
          {loading ? (
            <CardSkeleton count={3} />
          ) : roots.length === 0 ? (
            <EmptyState
              icon={Folder}
              title="Belum ada Folder Utama"
              description={
                isManager
                  ? 'Buat Folder Utama pertama untuk divisi atau kementerian beserta batas kuota penyimpanannya.'
                  : 'Anda belum ditambahkan ke Folder Utama mana pun. Hubungi Admin atau Sekretaris.'
              }
              action={
                isManager ? (
                  <button
                    type="button"
                    onClick={() => setFolderModal({ open: true, folder: null })}
                    className="btn-primary"
                  >
                    <FolderPlus className="h-4 w-4" /> Buat Folder Utama
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {roots.map((folder) => {
                const c = folderColor(folder.color);
                const pct = percent(folder.usedBytes, folder.quotaLimitBytes);
                const remaining = Math.max(0, (folder.quotaLimitBytes || 0) - folder.usedBytes);
                return (
                  <div
                    key={folder.id}
                    onClick={() => handleOpenRootFolder(folder)}
                    className="card group flex cursor-pointer flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-500/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', c.bg)}>
                            <Folder className={clsx('h-6 w-6', c.text)} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                              {folder.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {folder._count?.rootFiles ?? 0} file · {folder._count?.descendants ?? 0} subfolder
                            </p>
                          </div>
                        </div>

                        {isManager && (
                          <Dropdown
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                className="icon-btn h-8 w-8"
                                aria-label="Pengaturan folder"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                            items={[
                              {
                                label: 'Atur Kuota & Anggota',
                                icon: Pencil,
                                onClick: () => setFolderModal({ open: true, folder }),
                              },
                              {
                                label: 'Hitung Ulang Kuota',
                                icon: RefreshCw,
                                onClick: async () => {
                                  try {
                                    await api.post(`/folders/${folder.id}/recalculate`);
                                    toast.success('Pemakaian kuota berhasil disinkronkan.');
                                    loadData();
                                  } catch (err) {
                                    toast.error(err.message);
                                  }
                                },
                              },
                              { divider: true },
                              {
                                label: 'Hapus Folder Utama',
                                icon: Trash2,
                                danger: true,
                                onClick: () => handleDeleteRootFolder(folder),
                              },
                            ]}
                          />
                        )}
                      </div>

                      {folder.description && (
                        <p className="mt-3 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {folder.description}
                        </p>
                      )}
                    </div>

                    {/* Indikator Kuota Folder Dinamis */}
                    <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {formatBytes(folder.usedBytes)} / {formatBytes(folder.quotaLimitBytes)}
                        </span>
                        <span
                          className={clsx(
                            'font-semibold',
                            pct >= 90
                              ? 'text-red-600 dark:text-red-400'
                              : pct >= 75
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-brand-600 dark:text-brand-400'
                          )}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <ProgressBar value={pct} size="sm" />
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Sisa kuota: {formatBytes(remaining)}</span>
                        {isManager && <span>{folder._count?.members ?? 0} anggota</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Buat / Edit Folder Utama */}
      <RootFolderModal
        open={folderModal.open}
        folder={folderModal.folder}
        onClose={() => setFolderModal({ open: false, folder: null })}
        onSaved={loadData}
      />

      {/* Modal Pratinjau File */}
      <PreviewModal
        files={previewState.files}
        index={previewState.index}
        onClose={() => setPreviewState({ files: [], index: null })}
        onIndexChange={(index) => setPreviewState((s) => ({ ...s, index }))}
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
    </div>
  );
}
