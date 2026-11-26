import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError, badRequest, forbidden } from '../lib/httpError.js';
import { categorize, cleanName, formatBytes } from '../lib/files.js';
import { isManager } from '../middleware/auth.js';
import { assertFileAccess, assertFolderAccess, getAccessibleRootIds } from '../services/access.service.js';
import { assertQuotaAvailable, consumeQuota, releaseQuota } from '../services/quota.service.js';
import { storageRouter } from '../services/storageRouter.service.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

const fileSelect = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  folderId: true,
  rootFolderId: true,
  uploadedBy: { select: { id: true, name: true } },
  folder: { select: { id: true, name: true } },
  rootFolder: { select: { id: true, name: true, color: true } },
  bucket: { select: { id: true, name: true, provider: true } },
};

function categoryFilter(type) {
  switch ((type || '').toUpperCase()) {
    case 'PDF':
      return { category: 'PDF' };
    case 'DOCUMENT':
      return { category: 'DOCUMENT' };
    case 'IMAGE':
      return { category: 'IMAGE' };
    case 'OTHER':
      return { category: { notIn: ['PDF', 'DOCUMENT', 'IMAGE'] } };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------
// POST /api/files/upload-url — validasi kuota, pilih bucket, buat Presigned URL
// ---------------------------------------------------------------------
const uploadSchema = z.object({
  folderId: z.string().min(1),
  name: z.string().min(1, 'Nama file wajib diisi').max(255),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(255).optional().nullable(),
});

router.post('/upload-url', async (req, res) => {
  const data = uploadSchema.parse(req.body);
  const { folder, rootId } = await assertFolderAccess(req.user, data.folderId);

  if (data.size > env.maxFileSizeBytes) {
    throw new HttpError(413, `Ukuran file melebihi batas maksimum ${formatBytes(env.maxFileSizeBytes)} per file.`, {
      code: 'FILE_TOO_LARGE',
    });
  }

  // 1) Validasi kuota folder utama: used_bytes + incoming <= quota_limit_bytes
  const root = folder.isRoot ? folder : await prisma.folder.findUnique({ where: { id: rootId } });
  assertQuotaAvailable(root, data.size);

  // 2) Pilih bucket aktif dengan kapasitas cukup
  const bucket = await storageRouter.selectBucket(data.size);

  // 3) Catat file PENDING & buat Presigned URL
  const name = cleanName(data.name) || 'file';
  const mimeType = data.mimeType || 'application/octet-stream';
  const objectKey = storageRouter.buildObjectKey(rootId, name);

  const file = await prisma.file.create({
    data: {
      name,
      mimeType,
      sizeBytes: BigInt(data.size),
      category: categorize(mimeType, name),
      objectKey,
      status: 'PENDING',
      folderId: folder.id,
      rootFolderId: rootId,
      bucketId: bucket.id,
      uploadedById: req.user.id,
    },
  });

  try {
    const upload = await storageRouter.createUploadUrl(bucket, objectKey, mimeType, data.size);
    res.json({
      fileId: file.id,
      upload,
      expiresIn: env.presignedExpires,
      bucket: { id: bucket.id, name: bucket.name, provider: bucket.provider },
    });
  } catch (err) {
    await prisma.file.delete({ where: { id: file.id } }).catch(() => {});
    throw err;
  }
});

// ---------------------------------------------------------------------
// POST /api/files/:id/complete — verifikasi object & hitung kuota (transaction)
// ---------------------------------------------------------------------
router.post('/:id/complete', async (req, res) => {
  const file = await assertFileAccess(req.user, req.params.id);
  if (file.uploadedById && file.uploadedById !== req.user.id && !isManager(req.user)) throw forbidden();
  if (file.status === 'READY') {
    return res.json({ file: await prisma.file.findUnique({ where: { id: file.id }, select: fileSelect }) });
  }

  const actualSize = await storageRouter.getObjectSize(file.bucket, file.objectKey);
  if (actualSize === null) throw badRequest('File belum ditemukan di storage. Upload mungkin gagal, silakan coba lagi.');

  try {
    await prisma.$transaction(async (tx) => {
      await consumeQuota(tx, { rootFolderId: file.rootFolderId, bucketId: file.bucketId, size: actualSize });
      await tx.file.update({ where: { id: file.id }, data: { status: 'READY', sizeBytes: BigInt(actualSize) } });
    });
  } catch (err) {
    // Rollback fisik: hapus object & record bila kuota/bucket tidak mencukupi
    await storageRouter.deleteObject(file.bucket, file.objectKey);
    await prisma.file.delete({ where: { id: file.id } }).catch(() => {});
    throw err;
  }

  const result = await prisma.file.findUnique({ where: { id: file.id }, select: fileSelect });
  logActivity(req.user.id, 'FILE_UPLOAD', 'FILE', file.id, {
    name: file.name,
    size: formatBytes(actualSize),
    folder: result.folder?.name,
    bucket: file.bucket.name,
  });
  res.json({ file: result });
});

// ---------------------------------------------------------------------
// POST /api/files/:id/abort — batalkan upload PENDING
// ---------------------------------------------------------------------
router.post('/:id/abort', async (req, res) => {
  const file = await assertFileAccess(req.user, req.params.id);
  if (file.status !== 'PENDING') return res.json({ ok: true });
  if (file.uploadedById && file.uploadedById !== req.user.id && !isManager(req.user)) throw forbidden();
  await prisma.file.delete({ where: { id: file.id } });
  await storageRouter.deleteObject(file.bucket, file.objectKey);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// GET /api/files/search?q=&type=&rootId=
// ---------------------------------------------------------------------
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const type = String(req.query.type || '');
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rootIds = await getAccessibleRootIds(req.user);

  const scope = rootIds ? { rootFolderId: { in: rootIds } } : {};
  if (req.query.rootId) scope.rootFolderId = rootIds ? { in: rootIds.filter((id) => id === req.query.rootId) } : req.query.rootId;

  const [files, folders] = await Promise.all([
    prisma.file.findMany({
      where: {
        status: 'READY',
        ...scope,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...categoryFilter(type),
      },
      select: fileSelect,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    q && !type
      ? prisma.folder.findMany({
          where: {
            name: { contains: q, mode: 'insensitive' },
            ...(rootIds ? { OR: [{ id: { in: rootIds } }, { rootId: { in: rootIds } }] } : {}),
          },
          select: { id: true, name: true, isRoot: true, color: true, root: { select: { id: true, name: true } } },
          take: 10,
          orderBy: { name: 'asc' },
        })
      : [],
  ]);
  res.json({ files, folders });
});

// ---------------------------------------------------------------------
// GET /api/files/recent
// ---------------------------------------------------------------------
router.get('/recent', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const rootIds = await getAccessibleRootIds(req.user);
  const files = await prisma.file.findMany({
    where: { status: 'READY', ...(rootIds ? { rootFolderId: { in: rootIds } } : {}), ...categoryFilter(req.query.type) },
    select: fileSelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ files });
});

// ---------------------------------------------------------------------
// GET /api/files/:id/url?disposition=inline|attachment — Presigned Download URL
// ---------------------------------------------------------------------
router.get('/:id/url', async (req, res) => {
  const file = await assertFileAccess(req.user, req.params.id);
  if (file.status !== 'READY') throw badRequest('File belum selesai diunggah.');
  const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';
  const url = await storageRouter.createDownloadUrl(file.bucket, file.objectKey, {
    fileName: file.name,
    contentType: file.mimeType,
    disposition,
  });
  if (disposition === 'attachment') logActivity(req.user.id, 'FILE_DOWNLOAD', 'FILE', file.id, { name: file.name });
  res.json({ url, expiresIn: env.presignedExpires });
});

// ---------------------------------------------------------------------
// PATCH /api/files/:id — ganti nama
// ---------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1, 'Nama file wajib diisi').max(255) }).parse(req.body);
  const file = await assertFileAccess(req.user, req.params.id);
  const clean = cleanName(name);
  if (!clean) throw badRequest('Nama file tidak valid.');
  const updated = await prisma.file.update({
    where: { id: file.id },
    data: { name: clean, category: categorize(file.mimeType, clean) },
    select: fileSelect,
  });
  logActivity(req.user.id, 'FILE_RENAME', 'FILE', file.id, { from: file.name, to: clean });
  res.json({ file: updated });
});

// ---------------------------------------------------------------------
// DELETE /api/files/:id — hapus file & kurangi kuota (transaction)
// ---------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const file = await assertFileAccess(req.user, req.params.id);

  await prisma.$transaction(async (tx) => {
    await tx.file.delete({ where: { id: file.id } });
    if (file.status === 'READY') await releaseQuota(tx, [file]);
  });
  await storageRouter.deleteObject(file.bucket, file.objectKey);

  logActivity(req.user.id, 'FILE_DELETE', 'FILE', file.id, { name: file.name, size: formatBytes(file.sizeBytes) });
  res.json({ message: `File "${file.name}" berhasil dihapus.`, freedBytes: file.sizeBytes });
});

export default router;
