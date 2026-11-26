import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/httpError.js';
import { encrypt, mask } from '../lib/crypto.js';
import { formatBytes } from '../lib/files.js';
import { storageRouter } from '../services/storageRouter.service.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

const PROVIDERS = ['CLOUDFLARE_R2', 'BACKBLAZE_B2', 'STORJ', 'MINIO', 'AWS_S3', 'OTHER'];

function serialize(b) {
  return {
    id: b.id,
    name: b.name,
    provider: b.provider,
    endpoint: b.endpoint,
    region: b.region,
    bucketName: b.bucketName,
    forcePathStyle: b.forcePathStyle,
    accessKeyMasked: mask(b.accessKey),
    hasSecretKey: Boolean(b.secretKey),
    maxCapacityBytes: b.maxCapacityBytes,
    usedCapacityBytes: b.usedCapacityBytes,
    isActive: b.isActive,
    priority: b.priority,
    fileCount: b._count?.files ?? undefined,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Nama bucket wajib diisi').max(100),
  provider: z.enum(PROVIDERS),
  endpoint: z.string().trim().url('Endpoint harus berupa URL lengkap (https://...)').optional().nullable().or(z.literal('')),
  region: z.string().trim().max(60).optional().default('auto'),
  accessKey: z.string().trim().optional().nullable(),
  secretKey: z.string().trim().optional().nullable(),
  bucketName: z.string().trim().min(1, 'Nama bucket (bucket_name) wajib diisi').max(100),
  forcePathStyle: z.boolean().optional().default(true),
  maxCapacityBytes: z.number().int().positive('Kapasitas harus lebih dari 0'),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(-1000).max(1000).optional().default(0),
});

router.get('/', async (_req, res) => {
  await storageRouter.ensureLocalBucket();
  const buckets = await prisma.storageBucket.findMany({
    include: { _count: { select: { files: { where: { status: 'READY' } } } } },
    orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
  });
  const active = buckets.filter((b) => b.isActive);
  res.json({
    buckets: buckets.map(serialize),
    summary: {
      totalBuckets: buckets.length,
      activeBuckets: active.length,
      totalCapacityBytes: active.reduce((s, b) => s + b.maxCapacityBytes, 0n),
      totalUsedBytes: buckets.reduce((s, b) => s + b.usedCapacityBytes, 0n),
    },
  });
});

router.post('/', async (req, res) => {
  const data = baseSchema.parse(req.body);
  if (!data.accessKey || !data.secretKey) throw badRequest('Access Key dan Secret Key wajib diisi.');
  const bucket = await prisma.storageBucket.create({
    data: {
      ...data,
      endpoint: data.endpoint || null,
      accessKey: encrypt(data.accessKey),
      secretKey: encrypt(data.secretKey),
      maxCapacityBytes: BigInt(data.maxCapacityBytes),
    },
  });
  logActivity(req.user.id, 'BUCKET_CREATE', 'BUCKET', bucket.id, {
    name: bucket.name,
    provider: bucket.provider,
    capacity: formatBytes(bucket.maxCapacityBytes),
  });
  res.status(201).json({ bucket: serialize(bucket) });
});

// Test koneksi konfigurasi yang belum disimpan (atau gabungan dengan bucket yang ada)
router.post('/test', async (req, res) => {
  const data = baseSchema.partial({ maxCapacityBytes: true, name: true }).parse(req.body);
  let accessKey = data.accessKey;
  let secretKey = data.secretKey;
  if (req.body.id && (!accessKey || !secretKey)) {
    const existing = await prisma.storageBucket.findUnique({ where: { id: req.body.id } });
    if (existing) {
      accessKey = accessKey || existing.accessKey;
      secretKey = secretKey || existing.secretKey;
    }
  }
  const result = await storageRouter.testConnection({
    provider: data.provider,
    endpoint: data.endpoint || null,
    region: data.region || 'auto',
    bucketName: data.bucketName,
    forcePathStyle: data.forcePathStyle,
    accessKey,
    secretKey,
  });
  res.json(result);
});

router.post('/:id/test', async (req, res) => {
  const bucket = await prisma.storageBucket.findUnique({ where: { id: req.params.id } });
  if (!bucket) throw notFound('Bucket tidak ditemukan.');
  const result = await storageRouter.testConnection(bucket);
  res.json(result);
});

router.patch('/:id', async (req, res) => {
  const existing = await prisma.storageBucket.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Bucket tidak ditemukan.');

  const isLocal = existing.provider === 'LOCAL';
  const schema = isLocal
    ? baseSchema.pick({ name: true, maxCapacityBytes: true, isActive: true, priority: true }).partial()
    : baseSchema.partial();
  const data = schema.parse(req.body);

  const update = { ...data };
  if (!isLocal) {
    if ('endpoint' in data) update.endpoint = data.endpoint || null;
    if (data.accessKey) update.accessKey = encrypt(data.accessKey);
    else delete update.accessKey;
    if (data.secretKey) update.secretKey = encrypt(data.secretKey);
    else delete update.secretKey;
  }
  if (data.maxCapacityBytes !== undefined) {
    const cap = BigInt(data.maxCapacityBytes);
    if (cap < existing.usedCapacityBytes) {
      throw badRequest(
        `Kapasitas baru (${formatBytes(cap)}) lebih kecil dari kapasitas terpakai (${formatBytes(existing.usedCapacityBytes)}).`
      );
    }
    update.maxCapacityBytes = cap;
  }

  const bucket = await prisma.storageBucket.update({ where: { id: existing.id }, data: update });
  logActivity(req.user.id, 'BUCKET_UPDATE', 'BUCKET', bucket.id, { name: bucket.name, fields: Object.keys(data) });
  res.json({ bucket: serialize(bucket) });
});

router.post('/:id/recalculate', async (req, res) => {
  const bucket = await prisma.storageBucket.findUnique({ where: { id: req.params.id } });
  if (!bucket) throw notFound('Bucket tidak ditemukan.');
  const agg = await prisma.file.aggregate({ where: { bucketId: bucket.id, status: 'READY' }, _sum: { sizeBytes: true } });
  const updated = await prisma.storageBucket.update({
    where: { id: bucket.id },
    data: { usedCapacityBytes: agg._sum.sizeBytes ?? 0n },
  });
  res.json({ bucket: serialize(updated) });
});

router.delete('/:id', async (req, res) => {
  const bucket = await prisma.storageBucket.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { files: true } } },
  });
  if (!bucket) throw notFound('Bucket tidak ditemukan.');
  if (bucket.provider === 'LOCAL') throw badRequest('Bucket Local Disk tidak dapat dihapus, cukup nonaktifkan.');
  if (bucket._count.files > 0) {
    throw conflict(
      `Bucket "${bucket.name}" masih menyimpan ${bucket._count.files} file. Nonaktifkan bucket agar tidak menerima upload baru.`
    );
  }
  await prisma.storageBucket.delete({ where: { id: bucket.id } });
  logActivity(req.user.id, 'BUCKET_DELETE', 'BUCKET', bucket.id, { name: bucket.name });
  res.json({ message: `Bucket "${bucket.name}" berhasil dihapus.` });
});

export default router;
