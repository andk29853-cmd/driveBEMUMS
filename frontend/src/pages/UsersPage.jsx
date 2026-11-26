import { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Pencil, Trash2, Search } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatDateTime, initials, ROLE_LABEL } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Modal from '../components/Modal';
import { ListSkeleton } from '../components/Skeleton';

const ROLE_BADGE = {
  ADMIN: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  SECRETARY: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  MEMBER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'MEMBER',
  isActive: true,
  folderIds: [],
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [uRes, fRes] = await Promise.all([api.get('/users'), api.get('/folders/roots')]);
      setUsers(uRes.users);
      setRoots(fRes.folders);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive,
      folderIds: u.folders?.map((f) => f.id) || [],
    });
    setModalOpen(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleFolder = (id) => {
    setField(
      'folderIds',
      form.folderIds.includes(id) ? form.folderIds.filter((x) => x !== id) : [...form.folderIds, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return toast.warning('Nama dan email wajib diisi.');
    if (!editing && form.password.length < 6) return toast.warning('Password minimal 6 karakter.');
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), email: form.email.trim() };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload);
        toast.success(`Pengguna "${form.name}" berhasil diperbarui.`);
      } else {
        await api.post('/users', payload);
        toast.success(`Pengguna "${form.name}" berhasil ditambahkan.`);
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    const ok = await confirm({
      title: `Hapus pengguna "${u.name}"?`,
      message: `Akun ${u.email} akan dihapus permanen. File yang pernah diunggahnya tetap tersimpan di folder.`,
      confirmText: 'Hapus Pengguna',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/users/${u.id}`);
      toast.success(`Pengguna "${u.name}" berhasil dihapus.`);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
            Manajemen Pengguna & Akses Folder
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Kelola akun Admin, Sekretaris, dan Anggota beserta izin akses ke masing-masing Folder Utama.
          </p>
        </div>

        <button type="button" onClick={openCreate} className="btn-primary">
          <UserPlus className="h-4 w-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau email pengguna..."
            className="input pl-10"
          />
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="hidden px-4 py-3 md:table-cell">Akses Folder Utama</th>
                  <th className="hidden px-4 py-3 sm:table-cell">File Diunggah</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Login Terakhir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const canEdit = !(u.role === 'ADMIN' && currentUser?.role !== 'ADMIN');
                  return (
                    <tr key={u.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                            {initials(u.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                              {!u.isActive && (
                                <span className="badge bg-red-50 text-red-600 dark:bg-red-500/15">Nonaktif</span>
                              )}
                            </div>
                            <p className="truncate text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('badge', ROLE_BADGE[u.role])}>{ROLE_LABEL[u.role]}</span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {u.role === 'ADMIN' || u.role === 'SECRETARY' ? (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Semua Folder Utama
                          </span>
                        ) : u.folders?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {u.folders.map((f) => (
                              <span
                                key={f.id}
                                className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {f.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada folder</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-600 dark:text-slate-300 sm:table-cell">
                        {u._count?.files ?? 0} file
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                        {formatDateTime(u.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="icon-btn h-8 w-8"
                              title="Edit pengguna"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDelete(u)}
                                className="icon-btn h-8 w-8 text-red-500 hover:text-red-600"
                                title="Hapus pengguna"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Pengguna */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        icon={<Users className="h-5 w-5" />}
        title={editing ? `Edit Pengguna "${editing.name}"` : 'Tambah Pengguna Baru'}
        description="Atur role dan akses Folder Utama untuk pengguna ini."
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Batal
            </button>
            <button type="submit" form="user-form" disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Pengguna'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nama Lengkap</label>
            <input
              className="input"
              placeholder="Nama pengguna"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Alamat Email</label>
            <input
              type="email"
              className="input"
              placeholder="nama@drive.local"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">
                Password {editing && <span className="text-xs font-normal text-slate-400">(opsional)</span>}
              </label>
              <input
                type="password"
                className="input"
                placeholder={editing ? 'Kosongkan jika tetap' : 'Min. 6 karakter'}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                required={!editing}
              />
            </div>

            <div>
              <label className="label">Role Akses</label>
              <select
                className="input"
                value={form.role}
                disabled={editing?.id === currentUser?.id}
                onChange={(e) => setField('role', e.target.value)}
              >
                <option value="MEMBER">Anggota (Member)</option>
                <option value="SECRETARY">Sekretaris</option>
                {currentUser?.role === 'ADMIN' && <option value="ADMIN">Admin</option>}
              </select>
            </div>
          </div>

          {form.role === 'MEMBER' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label !mb-0">Folder Utama yang Diizinkan</label>
                <span className="text-xs text-slate-500">{form.folderIds.length} dipilih</span>
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                {roots.length === 0 ? (
                  <p className="p-2 text-center text-xs text-slate-500">Belum ada Folder Utama.</p>
                ) : (
                  roots.map((f) => {
                    const checked = form.folderIds.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={clsx(
                          'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition',
                          checked ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600"
                          checked={checked}
                          onChange={() => toggleFolder(f.id)}
                        />
                        <span className="truncate font-medium">{f.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {editing && editing.id !== currentUser?.id && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
              />
              <span>Akun Aktif (izinkan pengguna login)</span>
            </label>
          )}
        </form>
      </Modal>
    </div>
  );
}
