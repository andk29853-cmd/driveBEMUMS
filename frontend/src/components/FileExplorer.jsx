import { useState } from 'react';
import {
  Folder,
  MoreVertical,
  Eye,
  Download,
  Pencil,
  Trash2,
  UploadCloud,
  LayoutGrid,
  List as ListIcon,
  Search,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import FileIcon from './FileIcon';
import Dropdown from './Dropdown';
import EmptyState from './EmptyState';
import { GridSkeleton, ListSkeleton } from './Skeleton';
import { downloadFile } from './PreviewModal';
import { TYPE_FILTERS, fileVisual, folderColor, matchesType, previewKind } from '../lib/fileTypes';
import { formatBytes, formatDate, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

/**
 * Komponen FileExplorer reusable untuk menampilkan daftar subfolder & file
 * lengkap dengan pencarian cepat, filter tipe dokumen, toggle Grid/List view,
 * serta aksi Preview, Download, Rename, dan Delete.
 */
export default function FileExplorer({
  folders = [],
  files = [],
  loading = false,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onPreviewFile,
  onRenameFile,
  onDeleteFile,
  onUploadClick,
  showFolderLocation = false,
  emptyTitle = 'Folder ini masih kosong',
  emptyDescription = 'Tarik & lepas file ke area ini atau klik tombol Upload File untuk mulai mengunggah arsip.',
  searchPlaceholder = 'Cari nama file atau subfolder...',
}) {
  const toast = useToast();
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('drive_view_mode') || 'grid');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const changeView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('drive_view_mode', mode);
  };

  const q = query.trim().toLowerCase();

  const filteredFolders = folders.filter((f) => {
    if (typeFilter) return false; // bila filter tipe dokumen aktif, fokus ke file
    if (!q) return true;
    return f.name.toLowerCase().includes(q);
  });

  const filteredFiles = files.filter((file) => {
    if (!matchesType(file, typeFilter)) return false;
    if (!q) return true;
    return file.name.toLowerCase().includes(q);
  });

  const openPreview = (file) => {
    const idx = filteredFiles.findIndex((f) => f.id === file.id);
    onPreviewFile?.(filteredFiles, idx >= 0 ? idx : 0);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar Filter, Instant Search & View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tipe Dokumen */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap">
          {TYPE_FILTERS.map((t) => {
            const active = typeFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={clsx(
                  'shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition',
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Pencarian Cepat + Toggle Grid/List */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="input py-2 pl-9 pr-8 text-xs sm:text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Bersihkan pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => changeView('grid')}
              className={clsx(
                'rounded-lg p-1.5 transition',
                viewMode === 'grid'
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              )}
              title="Tampilan Grid"
              aria-label="Tampilan Grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView('list')}
              className={clsx(
                'rounded-lg p-1.5 transition',
                viewMode === 'list'
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              )}
              title="Tampilan Daftar"
              aria-label="Tampilan Daftar"
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        viewMode === 'grid' ? (
          <GridSkeleton count={8} />
        ) : (
          <ListSkeleton rows={6} />
        )
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title={q || typeFilter ? 'Tidak ada file yang cocok' : emptyTitle}
          description={
            q || typeFilter
              ? 'Coba ubah kata kunci pencarian atau pilih filter tipe dokumen lainnya.'
              : emptyDescription
          }
          action={
            !q && !typeFilter && onUploadClick ? (
              <button type="button" onClick={onUploadClick} className="btn-primary">
                <UploadCloud className="h-4 w-4" /> Upload File Pertama
              </button>
            ) : null
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="space-y-6">
          {/* Subfolders Grid */}
          {filteredFolders.length > 0 && (
            <div>
              <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Subfolder ({filteredFolders.length})
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredFolders.map((folder) => {
                  const c = folderColor(folder.color || 'slate');
                  return (
                    <div
                      key={folder.id}
                      onClick={() => onOpenFolder?.(folder)}
                      className="card group flex cursor-pointer items-center gap-3 p-3.5 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-500/40"
                    >
                      <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', c.bg)}>
                        <Folder className={clsx('h-5 w-5', c.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                          {folder.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {folder._count?.files ?? 0} file
                          {folder._count?.children ? ` · ${folder._count.children} folder` : ''}
                        </p>
                      </div>
                      {(onRenameFolder || onDeleteFolder) && (
                        <Dropdown
                          trigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              className="icon-btn h-8 w-8 opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                              aria-label="Menu folder"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          items={[
                            {
                              label: 'Ganti Nama',
                              icon: Pencil,
                              hidden: !onRenameFolder,
                              onClick: () => onRenameFolder(folder),
                            },
                            {
                              label: 'Hapus Folder',
                              icon: Trash2,
                              danger: true,
                              hidden: !onDeleteFolder,
                              onClick: () => onDeleteFolder(folder),
                            },
                          ]}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Grid */}
          {filteredFiles.length > 0 && (
            <div>
              {filteredFolders.length > 0 && (
                <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  File ({filteredFiles.length})
                </h4>
              )}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredFiles.map((file) => {
                  const visual = fileVisual(file);
                  const canPreview = Boolean(previewKind(file));
                  return (
                    <div
                      key={file.id}
                      onClick={() => openPreview(file)}
                      className="card group flex cursor-pointer flex-col justify-between p-3.5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-500/40"
                    >
                      <div>
                        <div className="relative mb-3 flex h-28 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/70">
                          <FileIcon file={file} size="lg" />
                          <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                            {visual.label}
                          </span>
                          <div className="absolute right-2 top-2">
                            <Dropdown
                              trigger={({ toggle }) => (
                                <button
                                  type="button"
                                  onClick={toggle}
                                  className="icon-btn h-8 w-8 bg-white/90 shadow-sm hover:bg-white dark:bg-slate-900/90"
                                  aria-label="Aksi file"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              )}
                              items={[
                                {
                                  label: canPreview ? 'Pratinjau' : 'Detail File',
                                  icon: Eye,
                                  onClick: () => openPreview(file),
                                },
                                {
                                  label: 'Unduh',
                                  icon: Download,
                                  onClick: () => downloadFile(file, toast),
                                },
                                {
                                  label: 'Ganti Nama',
                                  icon: Pencil,
                                  hidden: !onRenameFile,
                                  onClick: () => onRenameFile(file),
                                },
                                { divider: true, hidden: !onDeleteFile },
                                {
                                  label: 'Hapus',
                                  icon: Trash2,
                                  danger: true,
                                  hidden: !onDeleteFile,
                                  onClick: () => onDeleteFile(file),
                                },
                              ]}
                            />
                          </div>
                        </div>

                        <p
                          className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatBytes(file.sizeBytes)}</span>
                          <span>{timeAgo(file.createdAt)}</span>
                        </div>
                        {showFolderLocation && file.rootFolder && (
                          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                            📁 {file.rootFolder.name}
                            {file.folder && file.folder.id !== file.rootFolder.id ? ` / ${file.folder.name}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  {showFolderLocation && <th className="hidden px-4 py-3 md:table-cell">Folder</th>}
                  <th className="hidden px-4 py-3 sm:table-cell">Ukuran</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Diunggah Oleh</th>
                  <th className="hidden px-4 py-3 md:table-cell">Tanggal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFolders.map((folder) => {
                  const c = folderColor(folder.color || 'slate');
                  return (
                    <tr
                      key={`folder-${folder.id}`}
                      onClick={() => onOpenFolder?.(folder)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', c.bg)}>
                            <Folder className={clsx('h-4 w-4', c.text)} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-100">{folder.name}</p>
                            <p className="text-xs text-slate-400">Subfolder · {folder._count?.files ?? 0} file</p>
                          </div>
                        </div>
                      </td>
                      {showFolderLocation && <td className="hidden px-4 py-3 text-xs text-slate-400 md:table-cell">—</td>}
                      <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">—</td>
                      <td className="hidden px-4 py-3 text-xs text-slate-400 lg:table-cell">—</td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                        {formatDate(folder.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {onRenameFolder && (
                            <button
                              type="button"
                              onClick={() => onRenameFolder(folder)}
                              className="icon-btn h-8 w-8"
                              title="Ganti nama"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {onDeleteFolder && (
                            <button
                              type="button"
                              onClick={() => onDeleteFolder(folder)}
                              className="icon-btn h-8 w-8 text-red-500 hover:text-red-600"
                              title="Hapus folder"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => openPreview(file)}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileIcon file={file} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-400 sm:hidden">
                            {formatBytes(file.sizeBytes)} · {timeAgo(file.createdAt)}
                          </p>
                          {file.bucket && (
                            <p className="hidden text-[11px] text-slate-400 sm:block">Bucket: {file.bucket.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {showFolderLocation && (
                      <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                        {file.rootFolder?.name || '—'}
                      </td>
                    )}
                    <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300 sm:table-cell">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                      {file.uploadedBy?.name || '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 md:table-cell">
                      {formatDate(file.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openPreview(file)}
                          className="icon-btn h-8 w-8"
                          title="Pratinjau"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadFile(file, toast)}
                          className="icon-btn h-8 w-8"
                          title="Unduh"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {onRenameFile && (
                          <button
                            type="button"
                            onClick={() => onRenameFile(file)}
                            className="icon-btn h-8 w-8"
                            title="Ganti nama"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {onDeleteFile && (
                          <button
                            type="button"
                            onClick={() => onDeleteFile(file)}
                            className="icon-btn h-8 w-8 text-red-500 hover:text-red-600"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
