import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  File as FileIcon,
  FileType2,
  Presentation,
  FileCode,
} from 'lucide-react';

export function extOf(name = '') {
  const i = name.lastIndexOf('.');
  return i > -1 ? name.slice(i + 1).toLowerCase() : '';
}

export const TYPE_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'PDF', label: 'PDF' },
  { value: 'DOCUMENT', label: 'Dokumen' },
  { value: 'IMAGE', label: 'Gambar' },
  { value: 'OTHER', label: 'Lainnya' },
];

export function matchesType(file, type) {
  if (!type) return true;
  if (type === 'OTHER') return !['PDF', 'DOCUMENT', 'IMAGE'].includes(file.category);
  return file.category === type;
}

const TEXT_EXT = ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yml', 'yaml', 'ini', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'sql', 'py', 'java', 'php', 'env'];

export function previewKind(file) {
  const mime = (file.mimeType || '').toLowerCase();
  const ext = extOf(file.name);
  if (mime.startsWith('image/') && !['heic', 'tiff', 'tif'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXT.includes(ext)) return 'text';
  return null;
}

/** Ikon & warna berdasarkan tipe file */
export function fileVisual(file) {
  const ext = extOf(file.name);
  const cat = file.category;
  if (cat === 'PDF') return { Icon: FileType2, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', label: 'PDF' };
  if (cat === 'IMAGE') return { Icon: FileImage, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Gambar' };
  if (cat === 'VIDEO') return { Icon: FileVideo, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', label: 'Video' };
  if (cat === 'AUDIO') return { Icon: FileAudio, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-500/10', label: 'Audio' };
  if (cat === 'ARCHIVE') return { Icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'Arsip' };
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext))
    return { Icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-500/10', label: 'Spreadsheet' };
  if (['ppt', 'pptx', 'odp'].includes(ext))
    return { Icon: Presentation, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', label: 'Presentasi' };
  if (['json', 'js', 'ts', 'html', 'css', 'xml', 'sql', 'py'].includes(ext))
    return { Icon: FileCode, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-500/10', label: 'Kode' };
  if (cat === 'DOCUMENT') return { Icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Dokumen' };
  return { Icon: FileIcon, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-500/10', label: ext ? ext.toUpperCase() : 'File' };
}

export const FOLDER_COLORS = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', bar: 'bg-blue-500', ring: 'ring-blue-500' },
  indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', bar: 'bg-indigo-500', ring: 'ring-indigo-500' },
  violet: { text: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10', bar: 'bg-violet-500', ring: 'ring-violet-500' },
  pink: { text: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-500/10', bar: 'bg-pink-500', ring: 'ring-pink-500' },
  red: { text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', bar: 'bg-red-500', ring: 'ring-red-500' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-500/10', bar: 'bg-orange-500', ring: 'ring-orange-500' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', bar: 'bg-amber-500', ring: 'ring-amber-500' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', bar: 'bg-emerald-500', ring: 'ring-emerald-500' },
  teal: { text: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-500/10', bar: 'bg-teal-500', ring: 'ring-teal-500' },
  cyan: { text: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-500/10', bar: 'bg-cyan-500', ring: 'ring-cyan-500' },
  slate: { text: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-500/10', bar: 'bg-slate-500', ring: 'ring-slate-500' },
};

export const folderColor = (c) => FOLDER_COLORS[c] || FOLDER_COLORS.blue;
