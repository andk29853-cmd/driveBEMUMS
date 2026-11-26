import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Cloud, Lock, Mail, Eye, EyeOff, ShieldCheck, HardDrive, FolderKanban, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user?.id) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.warning('Email dan password wajib diisi.');
    setBusy(true);
    try {
      const loggedIn = await login(email.trim(), password);
      toast.success(`Selamat datang, ${loggedIn.name}!`);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.message, { title: 'Gagal Masuk' });
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
                <p className="text-xs text-brand-100">Cloud Drive &amp; Manajemen Arsip</p>
              </div>
            </div>

            <h2 className="mt-8 text-2xl font-bold leading-snug">
              Penyimpanan Arsip Terpusat dengan Kuota Folder Dinamis
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Kelola dokumen seluruh kementerian & divisi dalam satu workspace modern yang terhubung ke berbagai
              penyedia S3-compatible object storage.
            </p>
          </div>

          <div className="space-y-3.5 text-xs text-brand-50">
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-xs">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
              <div>
                <p className="font-semibold text-white">Multi-Bucket Storage Router</p>
                <p className="text-brand-100">R2, Backblaze B2, Storj, MinIO, AWS S3 & Local Disk Fallback otomatis.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-xs">
              <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
              <div>
                <p className="font-semibold text-white">Kuota Dinamis per Divisi</p>
                <p className="text-brand-100">Atur batas kuota tiap folder utama secara real-time & akurat.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
              <div>
                <p className="font-semibold text-white">Presigned Direct Upload</p>
                <p className="text-brand-100">Unggah file cepat langsung dari browser dengan progress bar real-time.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="p-6 sm:p-10 lg:col-span-7">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Drive BEM UMS</h1>
              <p className="text-xs text-slate-500">Cloud Drive &amp; Manajemen Arsip</p>
            </div>
          </div>

          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Daftar Drive Kementerian
          </Link>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Login Admin Drive BEM UMS</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Masuk dengan akun Admin untuk menambah folder kementerian, mengatur kuota, dan mengelola storage bucket.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  className="input pl-10"
                  placeholder="nama@drive.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Tampilkan password"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Memproses...' : 'Masuk Sekarang'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
