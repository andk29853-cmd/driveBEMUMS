import { useEffect, useState } from 'react';
import { FolderPlus, Check, Search } from 'lucide-react';
import clsx from 'clsx';
import Modal from './Modal';
import SizeInput, { QUOTA_PRESETS } from './SizeInput';
import { api } from '../lib/api';
import { FOLDER_COLORS } from '../lib/fileTypes';
import { formatBytes, ROLE_LABEL } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { emitDriveChange } from '../lib/events';

/** Modal buat / edit Folder Utama: nama, warna, kuota dinamis, dan anggota. */
export default function RootFolderModal({ open, onClose, folder, onSaved }) {
  const toast = useToast();
  const editing = Boolean(folder);
  const [form, setForm] = useState({ name: '', description: '', color: 'blue', quotaLimitBytes: 500 * 1024 ** 3, memberIds: [] });
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setForm(
      folder
        ? {
            name: folder.name,
            description: folder.description || '',
            color: folder.color || 'blue',
            quotaLimitBytes: folder.quotaLimitBytes,
            memberIds: folder.members?.map((m) => m.id) || [],
          }
        : { name: '', description: '', color: 'blue', quotaLimitBytes: 500 * 1024 ** 3, memberIds: [] }
    );
    api
      .get('/users')
      .then((r) => setUsers(r.users.filter((u) => u.role === 'MEMBER')))
      .catch(() => setUsers([]));
  }, [open, folder]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleMember = (id) =>
    set('memberIds', form.memberIds.includes(id) ? form.memberIds.filter((x) => x !== id) : [...form.memberIds, id]);

  const tooSmall = editing && form.quotaLimitBytes < folder.usedBytes;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Nama folder wajib diisi.');
    if (!form.quotaLimitBytes) return toast.warning('Kuota folder wajib diisi.');
    setBusy(true);
    try {
      const body = { ...form, name: form.name.trim() };
      const res = editing ? await api.patch(`/folders/${folder.id}`, body) : await api.post('/folders', body);
      toast.success(editing ? 'Folder utama berhasil diperbarui.' : `Folder "${res.folder.name}" berhasil dibuat.`);
      emitDriveChange({ type: 'folder' });
      onSaved?.(res.folder);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const filteredUsers = users.filter(
    (u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<FolderPlus className="h-5 w-5" />}
      title={editing ? 'Edit Folder Utama' : 'Folder Utama Baru'}
      description="Folder utama mewakili workspace divisi / kementerian dengan kuota penyimpanan sendiri."
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" form="root-folder-form" disabled={busy || tooSmall}>
            {busy ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Folder'}
          </button>
        </>
      }
    >
      <form id="root-folder-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nama Folder / Divisi</label>
            <input
              className="input"
              placeholder="contoh: Kementerian Komunikasi & Informasi"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Deskripsi (opsional)</label>
            <input
              className="input"
              placeholder="Keterangan singkat isi folder"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Warna Label</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FOLDER_COLORS).map(([name, c]) => (
              <button
                type="button"
                key={name}
                onClick={() => set('color', name)}
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-white transition',
                  c.bar,
                  form.color === name && 'ring-2 ring-offset-2 dark:ring-offset-slate-900',
                  form.color === name && c.ring
                )}
                aria-label={name}
              >
                {form.color === name && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Batas Kuota Penyimpanan</label>
          <SizeInput value={form.quotaLimitBytes} onChange={(v) => set('quotaLimitBytes', v)} presets={QUOTA_PRESETS} />
          {editing && (
            <p className={clsx('mt-2 text-xs', tooSmall ? 'text-red-500' : 'text-slate-500')}>
              Terpakai saat ini: <b>{formatBytes(folder.usedBytes)}</b>
              {tooSmall && ' — kuota tidak boleh lebih kecil dari penggunaan saat ini.'}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
