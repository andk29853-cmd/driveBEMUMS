import { useCallback, useEffect, useState } from 'react';
import {
  HardDrive,
  Plus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Pencil,
  Trash2,
  PlugZap,
  Power,
  ShieldCheck,
  Loader2,
  Server,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { emitDriveChange, onDriveChange } from '../lib/events';
import { formatBytes, percent } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import ProgressBar from '../components/ProgressBar';
import Modal from '../components/Modal';
import SizeInput, { CAPACITY_PRESETS } from '../components/SizeInput';
import { CardSkeleton } from '../components/Skeleton';

const PROVIDERS = [
  {
    value: 'CLOUDFLARE_R2',
    label: 'Cloudflare R2',
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    regionPlaceholder: 'auto',
    endpointPlaceholder: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
    forcePathStyle: true,
  },
  {
    value: 'BACKBLAZE_B2',
    label: 'Backblaze B2',
    badge: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    regionPlaceholder: 'us-west-004',
    endpointPlaceholder: 'https://s3.us-west-004.backblazeb2.com',
    forcePathStyle: true,
  },
  {
    value: 'STORJ',
    label: 'Storj DCS',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    regionPlaceholder: 'global',
    endpointPlaceholder: 'https://gateway.storjshare.io',
    forcePathStyle: true,
  },
  {
    value: 'MINIO',
    label: 'MinIO Self-Hosted',
    badge: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
    regionPlaceholder: 'us-east-1',
    endpointPlaceholder: 'http://localhost:9000',
    forcePathStyle: true,
  },
  {
    value: 'AWS_S3',
    label: 'Amazon S3',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    regionPlaceholder: 'ap-southeast-1',
    endpointPlaceholder: 'https://s3.ap-southeast-1.amazonaws.com',
    forcePathStyle: false,
  },
  {
    value: 'OTHER',
    label: 'S3-Compatible Lainnya',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    regionPlaceholder: 'auto',
    endpointPlaceholder: 'https://s3.example.com',
    forcePathStyle: true,
  },
];

const PROVIDER_META = Object.fromEntries([
  ...PROVIDERS.map((p) => [p.value, p]),
  [
    'LOCAL',
    {
      value: 'LOCAL',
      label: 'Local Disk (Fallback)',
      badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
  ],
]);

const DEFAULT_FORM = {
  name: '',
  provider: 'CLOUDFLARE_R2',
  endpoint: '',
  region: 'auto',
  bucketName: '',
  accessKey: '',
  secretKey: '',
  forcePathStyle: true,
  maxCapacityBytes: 10 * 1024 ** 3,
  priority: 10,
  isActive: true,
};

export default function BucketsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [buckets, setBuckets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [testingForm, setTestingForm] = useState(false);

  const loadBuckets = useCallback(async () => {
    try {
      const res = await api.get('/buckets');
      setBuckets(res.buckets);
      setSummary(res.summary);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBuckets();
    return onDriveChange(loadBuckets);
  }, [loadBuckets]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  };

  const openEdit = (bucket) => {
    setEditing(bucket);
    setForm({
      name: bucket.name,
      provider: bucket.provider === 'LOCAL' ? 'LOCAL' : bucket.provider,
      endpoint: bucket.endpoint || '',
      region: bucket.region || 'auto',
      bucketName: bucket.bucketName || '',
      accessKey: '',
      secretKey: '',
      forcePathStyle: bucket.forcePathStyle ?? true,
      maxCapacityBytes: bucket.maxCapacityBytes,
      priority: bucket.priority ?? 0,
      isActive: bucket.isActive,
    });
    setModalOpen(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleProviderChange = (provider) => {
    const meta = PROVIDER_META[provider];
    setForm((f) => ({
      ...f,
      provider,
      region: meta?.regionPlaceholder || f.region,
      forcePathStyle: meta?.forcePathStyle ?? true,
    }));
  };

  const handleTestBucket = async (bucket) => {
    setTestingId(bucket.id);
    try {
      const res = await api.post(`/buckets/${bucket.id}/test`);
      setTestResults((r) => ({ ...r, [bucket.id]: res }));
      if (res.ok) toast.success(`Bucket "${bucket.name}" terhubung (${res.latencyMs} ms).`);
      else toast.error(res.message, { title: `Koneksi "${bucket.name}" gagal` });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleTestForm = async () => {
    setTestingForm(true);
    try {
      const res = await api.post('/buckets/test', { ...form, id: editing?.id });
      if (res.ok) toast.success(`Koneksi berhasil (${res.latencyMs} ms)!`);
      else toast.error(res.message, { title: 'Gagal terhubung ke bucket' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTestingForm(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Nama bucket wajib diisi.');
    if (!form.maxCapacityBytes) return toast.warning('Kapasitas maksimum wajib diisi.');
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/buckets/${editing.id}`, form);
        toast.success(`Bucket "${form.name}" berhasil diperbarui.`);
      } else {
        await api.post('/buckets', form);
        toast.success(`Bucket "${form.name}" berhasil ditambahkan.`);
      }
      setModalOpen(false);
      emitDriveChange({ type: 'bucket' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bucket) => {
    try {
      await api.patch(`/buckets/${bucket.id}`, { isActive: !bucket.isActive });
      toast.success(`Bucket "${bucket.name}" ${!bucket.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      emitDriveChange({ type: 'bucket' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRecalculate = async (bucket) => {
    try {
      await api.post(`/buckets/${bucket.id}/recalculate`);
      toast.success(`Kapasitas terpakai "${bucket.name}" berhasil disinkronkan.`);
      loadBuckets();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (bucket) => {
    const ok = await confirm({
      title: `Hapus bucket "${bucket.name}"?`,
      message: 'Bucket hanya dapat dihapus bila tidak ada file yang tersimpan di dalamnya.',
      confirmText: 'Hapus Bucket',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/buckets/${bucket.id}`);
      toast.success(`Bucket "${bucket.name}" berhasil dihapus.`);
      emitDriveChange({ type: 'bucket' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const totalCap = summary?.totalCapacityBytes ?? 0;
  const totalUsed = summary?.totalUsedBytes ?? 0;
  const totalPct = percent(totalUsed, totalCap);
  const currentProviderMeta = PROVIDER_META[form.provider] || PROVIDERS[0];
  const isLocalEdit = editing?.provider === 'LOCAL';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
            Manajemen Multi-Bucket Storage
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            StorageRouterService otomatis memilih bucket aktif yang memiliki sisa kapasitas cukup saat user mengunggah
            file.
          </p>
        </div>

        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          <span>Tambah Storage Bucket</span>
        </button>
      </div>

      {/* Ringkasan Gabungan Seluruh Bucket */}
      {summary && (
        <div className="card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Penyimpanan Gabungan (Pool)
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatBytes(totalUsed)}{' '}
                  <span className="text-sm font-normal text-slate-500">dari {formatBytes(totalCap)} terpakai</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="rounded-xl bg-slate-50 px-3.5 py-2 dark:bg-slate-800">
                <span className="text-slate-400">Bucket Aktif:</span>{' '}
                <b className="text-slate-800 dark:text-white">
                  {summary.activeBuckets} / {summary.totalBuckets}
                </b>
              </div>
              <div className="rounded-xl bg-slate-50 px-3.5 py-2 dark:bg-slate-800">
                <span className="text-slate-400">Sisa Kapasitas Pool:</span>{' '}
                <b className="text-emerald-600 dark:text-emerald-400">
                  {formatBytes(Math.max(0, totalCap - totalUsed))}
                </b>
              </div>
            </div>
          </div>

          <ProgressBar value={totalPct} size="lg" className="mt-4" />
        </div>
      )}

      {/* Daftar Bucket */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buckets.map((bucket) => {
            const meta = PROVIDER_META[bucket.provider] || PROVIDER_META.OTHER;
            const pct = percent(bucket.usedCapacityBytes, bucket.maxCapacityBytes);
            const free = Math.max(0, bucket.maxCapacityBytes - bucket.usedCapacityBytes);
            const test = testResults[bucket.id];

            return (
              <div
                key={bucket.id}
                className={clsx(
                  'card flex flex-col justify-between p-5 transition',
                  !bucket.isActive && 'opacity-70'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <HardDrive className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-900 dark:text-white">{bucket.name}</h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={clsx('badge', meta.badge)}>{meta.label}</span>
                          <span
                            className={clsx(
                              'badge',
                              bucket.isActive
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            )}
                          >
                            {bucket.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Prioritas: {bucket.priority}
                    </span>
                  </div>

                  {/* Detail Teknis Bucket */}
                  <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Bucket:</span>
                      <span className="truncate font-mono font-medium">{bucket.bucketName}</span>
                    </div>
                    {bucket.endpoint && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Endpoint:</span>
                        <span className="truncate font-mono" title={bucket.endpoint}>
                          {bucket.endpoint.replace(/^https?:\/\//, '')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Region:</span>
                      <span className="font-mono">{bucket.region}</span>
                    </div>
                    {bucket.accessKeyMasked && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Access Key:</span>
                        <span className="font-mono">{bucket.accessKeyMasked}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">File Tersimpan:</span>
                      <span className="font-semibold">{bucket.fileCount ?? 0} file</span>
                    </div>
                  </div>

                  {/* Kapasitas Bucket */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {formatBytes(bucket.usedCapacityBytes)} / {formatBytes(bucket.maxCapacityBytes)}
                      </span>
                      <span className="font-semibold text-brand-600 dark:text-brand-400">{pct.toFixed(1)}%</span>
                    </div>
                    <ProgressBar value={pct} size="sm" />
                    <p className="mt-1 text-[11px] text-slate-400">Sisa ruang: {formatBytes(free)}</p>
                  </div>

                  {test && (
                    <div
                      className={clsx(
                        'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
                        test.ok
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                      )}
                    >
                      {test.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">
                        {test.message} ({test.latencyMs} ms)
                      </span>
                    </div>
                  )}
                </div>

                {/* Tombol Aksi */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleTestBucket(bucket)}
                    disabled={testingId === bucket.id}
                    className="btn-secondary btn-sm"
                  >
                    {testingId === bucket.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="h-3.5 w-3.5" />
                    )}
                    <span>Tes Koneksi</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(bucket)}
                      className="icon-btn h-8 w-8"
                      title={bucket.isActive ? 'Nonaktifkan bucket' : 'Aktifkan bucket'}
                    >
                      <Power className={clsx('h-4 w-4', bucket.isActive ? 'text-emerald-600' : 'text-slate-400')} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRecalculate(bucket)}
                      className="icon-btn h-8 w-8"
                      title="Hitung ulang kapasitas terpakai"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(bucket)}
                      className="icon-btn h-8 w-8"
                      title="Edit konfigurasi"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {bucket.provider !== 'LOCAL' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(bucket)}
                        className="icon-btn h-8 w-8 text-red-500 hover:text-red-600"
                        title="Hapus bucket"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah / Edit Storage Bucket */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        icon={<HardDrive className="h-5 w-5" />}
        title={editing ? `Edit Bucket "${editing.name}"` : 'Tambah Storage Bucket Baru'}
        description={
          isLocalEdit
            ? 'Atur batas kapasitas dan status untuk penyimpanan Local Disk Fallback.'
            : 'Hubungkan bucket S3-compatible (Cloudflare R2, Backblaze B2, Storj, MinIO, AWS S3). Kredensial disimpan terenkripsi AES-256-GCM.'
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!isLocalEdit ? (
              <button
                type="button"
                onClick={handleTestForm}
                disabled={testingForm}
                className="btn-secondary"
              >
                {testingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                <span>Tes Koneksi</span>
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                Batal
              </button>
              <button type="submit" form="bucket-form" disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambahkan Bucket'}
              </button>
            </div>
          </div>
        }
      >
        <form id="bucket-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nama Label Bucket</label>
              <input
                className="input"
                placeholder="contoh: Cloudflare R2 Utama"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>

            {!isLocalEdit && (
              <div>
                <label className="label">Penyedia Storage (Provider)</label>
                <select
                  className="input"
                  value={form.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!isLocalEdit && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="label">Endpoint URL S3</label>
                  <input
                    className="input font-mono text-xs"
                    placeholder={currentProviderMeta.endpointPlaceholder}
                    value={form.endpoint}
                    onChange={(e) => setField('endpoint', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Region</label>
                  <input
                    className="input font-mono text-xs"
                    placeholder={currentProviderMeta.regionPlaceholder}
                    value={form.region}
                    onChange={(e) => setField('region', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Nama Bucket (bucket_name di provider)</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="contoh: bem-archive-prod"
                  value={form.bucketName}
                  onChange={(e) => setField('bucketName', e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">
                    Access Key ID {editing && <span className="text-xs font-normal text-slate-400">(kosongkan jika tetap)</span>}
                  </label>
                  <input
                    className="input font-mono text-xs"
                    placeholder={editing ? editing.accessKeyMasked || '••••••••' : 'Masukkan Access Key'}
                    value={form.accessKey}
                    onChange={(e) => setField('accessKey', e.target.value)}
                    required={!editing}
                  />
                </div>
                <div>
                  <label className="label">
                    Secret Access Key {editing && <span className="text-xs font-normal text-slate-400">(kosongkan jika tetap)</span>}
                  </label>
                  <input
                    type="password"
                    className="input font-mono text-xs"
                    placeholder={editing ? '••••••••••••••••' : 'Masukkan Secret Key'}
                    value={form.secretKey}
                    onChange={(e) => setField('secretKey', e.target.value)}
                    required={!editing}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="label">Batas Kapasitas Maksimum Bucket</label>
            <SizeInput
              value={form.maxCapacityBytes}
              onChange={(v) => setField('maxCapacityBytes', v)}
              presets={CAPACITY_PRESETS}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Prioritas Routing (makin tinggi makin diutamakan)</label>
              <input
                type="number"
                className="input"
                value={form.priority}
                onChange={(e) => setField('priority', Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span>Bucket Aktif (menerima unggahan baru)</span>
              </label>
              {!isLocalEdit && (
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    checked={form.forcePathStyle}
                    onChange={(e) => setField('forcePathStyle', e.target.checked)}
                  />
                  <span>Gunakan Path-Style URL (disarankan untuk R2, B2, Storj, MinIO)</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/70 p-3 text-xs text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <span>
              Pastikan bucket S3 Anda sudah mengizinkan CORS (method <code>PUT</code> dan <code>GET</code>) dari origin
              aplikasi agar browser dapat mengunggah file langsung via Presigned URL.
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
