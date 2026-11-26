const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(input, decimals = 1) {
  let n = Number(input || 0);
  if (n <= 0) return '0 B';
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : decimals).replace(/\.0+$/, '')} ${UNITS[i]}`;
}

const DOC_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'txt', 'csv', 'rtf', 'md'];
const ARCHIVE_EXT = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'avif'];

export function extOf(name = '') {
  const i = name.lastIndexOf('.');
  return i > -1 ? name.slice(i + 1).toLowerCase() : '';
}

export function categorize(mime = '', name = '') {
  const ext = extOf(name);
  mime = (mime || '').toLowerCase();
  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF';
  if (mime.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (ARCHIVE_EXT.includes(ext) || /zip|rar|7z|tar|gzip/.test(mime)) return 'ARCHIVE';
  if (
    DOC_EXT.includes(ext) ||
    mime.startsWith('text/') ||
    /msword|officedocument|opendocument|rtf|csv/.test(mime)
  )
    return 'DOCUMENT';
  return 'OTHER';
}

/** Membersihkan nama file/folder dari karakter berbahaya. */
export function cleanName(name = '') {
  return String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
}

/** Nama aman untuk object key di storage. */
export function slugifyKey(name = '') {
  return (
    String(name)
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'file'
  );
}
