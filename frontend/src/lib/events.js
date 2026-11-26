/** Event bus sederhana agar sidebar/halaman ikut refresh setelah aksi file/folder. */
const EVENT = 'drive:changed';

export function emitDriveChange(detail = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function onDriveChange(cb) {
  const handler = (e) => cb(e.detail || {});
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
