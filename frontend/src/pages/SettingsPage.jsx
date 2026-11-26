import { useEffect, useState } from 'react';
import { Lock, Sun, Moon, Activity, Building2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const ACTION_LABEL = {
  LOGIN: 'Login ke sistem',
  PASSWORD_CHANGE: 'Mengubah kata kunci Admin',
  FILE_UPLOAD: 'Mengunggah file',
  FILE_DOWNLOAD: 'Mengunduh file',
  FILE_RENAME: 'Mengganti nama file',
  FILE_DELETE: 'Menghapus file',
  FOLDER_CREATE: 'Membuat folder',
  FOLDER_RENAME: 'Mengganti nama folder',
  FOLDER_DELETE: 'Menghapus folder',
  QUOTA_UPDATE: 'Mengubah kuota folder',
  BUCKET_CREATE: 'Menambah storage bucket',
  BUCKET_UPDATE: 'Memperbarui storage bucket',
  BUCKET_DELETE: 'Menghapus storage bucket',
  USER_CREATE: 'Menambah pengguna',
  USER_UPDATE: 'Memperbarui pengguna',
  USER_DELETE: 'Menghapus pengguna',
  SETTINGS_UPDATE: 'Memperbarui nama kabinet',
};

export default function SettingsPage() {
  const { appSettings, setAppSettings, isManager } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [cabinetName, setCabinetName] = useState(appSettings?.cabinetName || '');
  const [savingCabinet, setSavingCabinet] = useState(false);

  const [keys, setKeys] = useState({ currentKey: '', newKey: '' });
  const [savingKey, setSavingKey] = useState(false);

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    setCabinetName(appSettings?.cabinetName || '');
  }, [appSettings]);

  useEffect(() => {
    api
      .get('/activity', { limit: 40 })
      .then((r) => setLogs(r.logs))
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  }, []);

  const handleSaveCabinet = async (e) => {
    e.preventDefault();
    if (!cabinetName.trim()) return;
    setSavingCabinet(true);
    try {
      const res = await api.patch('/settings', { cabinetName: cabinetName.trim() });
      setAppSettings(res.settings);
      toast.success('Nama kabinet berhasil diperbarui.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCabinet(false);
    }
  };

  const handleChangeKey = async (e) => {
    e.preventDefault();
    if (keys.newKey.trim().length < 4) return toast.warning('Kata kunci baru minimal 4 karakter.');
    setSavingKey(true);
    try {
      await api.post('/settings/admin-key', { currentKey: keys.currentKey, newKey: keys.newKey.trim() });
      setKeys({ currentKey: '', newKey: '' });
      toast.success('Kata kunci Admin berhasil diperbarui.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Pengaturan & Log Aktivitas</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Sesuaikan profil, tampilan tema aplikasi, keamanan akun, dan pantau riwayat aktivitas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profil, Identitas Kabinet & Tema */}
        <div className="space-y-6">
          {isManager && (
            <form onSubmit={handleSaveCabinet} className="card space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-brand-600" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Identitas Kabinet (Masa Transisi)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ubah nama kabinet saat pergantian periode BEM UMS tanpa mengubah struktur file.
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Nama Kabinet / Periode Aktif</label>
                <input
                  className="input"
                  placeholder="contoh: Kabinet Kolektiva BEM UMS 2026"
                  value={cabinetName}
                  onChange={(e) => setCabinetName(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={savingCabinet} className="btn-primary">
                  {savingCabinet ? 'Menyimpan...' : 'Simpan Nama Kabinet'}
                </button>
              </div>
            </form>
          )}

          {/* Preferensi Tampilan */}
          <div className="card space-y-4 p-5">
            <div className="flex items-center gap-2.5">
              <Sun className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tampilan Tema</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={clsx(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                  theme === 'light'
                    ? 'border-brand-500 bg-brand-50/60 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
                )}
              >
                <Sun className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">Light Mode</p>
                  <p className="text-xs text-slate-500">Terang & bersih (Default)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={clsx(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                  theme === 'dark'
                    ? 'border-brand-500 bg-brand-50/60 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
                )}
              >
                <Moon className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-sm font-semibold">Dark Mode</p>
                  <p className="text-xs text-slate-500">Nyaman di malam hari</p>
                </div>
              </button>
            </div>
          </div>

          {/* Ubah Kata Kunci Admin */}
          <form onSubmit={handleChangeKey} className="card space-y-4 p-5">
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ubah Kata Kunci Admin</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Kata Kunci Lama</label>
                <input
                  type="password"
                  className="input"
                  value={keys.currentKey}
                  onChange={(e) => setKeys((p) => ({ ...p, currentKey: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">Kata Kunci Baru</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Minimal 4 karakter"
                  value={keys.newKey}
                  onChange={(e) => setKeys((p) => ({ ...p, newKey: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={savingKey} className="btn-secondary">
                {savingKey ? 'Memproses...' : 'Perbarui Kata Kunci'}
              </button>
            </div>
          </form>
        </div>

        {/* Log Aktivitas */}
        <div className="card flex flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isManager ? 'Log Aktivitas Sistem' : 'Riwayat Aktivitas Anda'}
                </h2>
                <p className="text-xs text-slate-500">40 aktivitas terakhir tercatat secara otomatis</p>
              </div>
            </div>
          </div>

          {loadingLogs ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Belum ada aktivitas tercatat.</p>
          ) : (
            <ul className="max-h-[540px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
              {logs.map((log) => (
                <li key={log.id} className="py-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {ACTION_LABEL[log.action] || log.action}
                    </span>
                    <span className="shrink-0 text-slate-400">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-slate-500 dark:text-slate-400">
                    {log.user && <span>Oleh: {log.user.name}</span>}
                    {log.details && typeof log.details === 'object' && (
                      <span className="truncate text-slate-400">
                        ·{' '}
                        {Object.entries(log.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
