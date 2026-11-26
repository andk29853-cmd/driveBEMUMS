import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Cloud,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  HardDrive,
  FolderKanban,
  ArrowLeft,
  SlidersHorizontal,
  Database,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { user, loginWithKey } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [accessKey, setAccessKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user?.id) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accessKey.trim()) return toast.warning('Masukkan kata kunci Admin terlebih dahulu.');
    setBusy(true);
    try {
      const loggedIn = await loginWithKey(accessKey.trim());
      toast.success(`Selamat datang, ${loggedIn.name}!`);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.message, { title: 'Kata Kunci Salah' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-slate-50 via-brand-50/40 to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-6">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-12">
        {/* Left Feature Banner */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white lg:col-span-5 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Cloud className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Drive BEM UMS</h1>
                <p className="text-xs text-brand-100">Kabinet Kolektiva · Arsip Terpusat</p>
              </div>
            </div>

            <h2 className="mt-8 text-2xl font-bold leading-snug">
              Penyimpanan Cloud Terpadu untuk Seluruh Kementerian BEM UMS
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Seluruh arsip tersimpan aman di multi-bucket cloud berkapasitas 535 GB yang digabungkan dari layanan
              object storage terdistribusi.
            </p>
          </div>

          <div className="mt-8 space-y-3 text-xs text-brand-50">
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-xs">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
              <div>
                <p className="font-semibold text-white">Sumber Penyimpanan 535 GB</p>
                <p className="text-brand-100">
                  Gabungan Backblaze B2 (10 GB), Storj DCS (25 GB), dan Telegram S3 via Cloudflare Workers (500 GB).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-xs">
              <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
              <div>
                <p className="font-semibold text-white">Kuota Dinamis Kabinet Kolektiva</p>
                <p className="text-brand-100">
                  Jatah 25 GB per unit/kementerian yang dapat ditambah atau disesuaikan kapan saja oleh Admin.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
              <div>
                <p className="font-semibold text-white">Presigned Direct Upload</p>
                <p className="text-brand-100">
                  File diunggah langsung dari browser ke cloud bucket dengan progress bar real-time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-7">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Drive BEM UMS</h1>
              <p className="text-xs text-slate-500">Kabinet Kolektiva · Arsip Terpusat</p>
            </div>
          </div>

          <Link
            to="/"
            className="mb-5 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Daftar Drive Kementerian
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Login Admin Drive BEM UMS</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Masukkan kata kunci Admin untuk membuka kontrol penuh workspace.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="admin-key">
                Kata Kunci Admin
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="admin-key"
                  type={showKey ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="Masukkan kata kunci..."
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Tampilkan kata kunci"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Memverifikasi...' : 'Masuk ke Panel Admin'}
            </button>
          </form>

          {/* Info Panel Mengisi Space Bawah */}
          <div className="mt-7 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kendali Khusus Admin
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl bg-white p-3 shadow-xs dark:bg-slate-900">
                <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Atur Kuota Kementerian</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Tambah folder kementerian atau ubah jatah penyimpanan per unit.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-white p-3 shadow-xs dark:bg-slate-900">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Manajemen Multi-Bucket</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Pantau &amp; tambah bucket Backblaze B2, Storj, dan Telegram S3.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
