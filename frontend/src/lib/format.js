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

export function percent(used, total) {
  const u = Number(used || 0);
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.min(100, Math.max(0, (u / t) * 100));
}

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value) {
  if (!value) return '-';
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '-';
  return dateTimeFmt.format(new Date(value));
}

export function timeAgo(value) {
  if (!value) return '-';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} hari lalu`;
  return formatDate(value);
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

export const ROLE_LABEL = { ADMIN: 'Admin', SECRETARY: 'Sekretaris', MEMBER: 'Anggota' };
