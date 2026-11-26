import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../lib/httpError.js';
import { cleanName, formatBytes } from '../lib/files.js';
import { isManager, requireAuth, requireManager } from '../middleware/auth.js';
import { assertFolderAccess, getBreadcrumb, getSubtreeIds } from '../services/access.service.js';
import { releaseQuota } from '../services/quota.service.js';
import { storageRouter } from '../services/storageRouter.service.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

const COLORS = ['blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'emerald', 'teal', 'cyan', 'slate'];

const rootSelect = (withMembers) => ({
  id: true,
  name: true,
  description: true,
  color: true,
  isRoot: true,
  quotaLimitBytes: true,
  usedBytes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { rootFiles: { where: { status: 'READY' } }, descendants: true, members: true } },
  ...(withMembers ? { members: { select: { id: true, name: true, email: true, role: true } } } : {}),
});

// ---------------------------------------------------------------------
// GET /api/folders/roots — daftar semua Folder Utama (publik: metadata saja + status hasAccess)
// ---------------------------------------------------------------------
router.get('/roots', async (req, res) => {
  const manager = isManager(req.user);
  const folders = await prisma.folder.findMany({
    where: { isRoot: true },
    select: {
      ...rootSelect(manager),
      ...(req.user?.id && !manager ? { members: { where: { id: req.user.id }, select: { id: true } } } : {}),
    },
    orderBy: { name: 'asc' },
  });

  const result = folders.map((f) => {
    const hasAccess = Boolean(manager || req.user?.role === 'GUEST' || f.members?.some((m) => m.id === req.user?.id));
    if (!manager) {
      const { members: _omit, ...rest } = f;
      return { ...rest, hasAccess };
    }
    return { ...f, hasAccess };
  });

  res.json({ folders: result });
});

// Semua endpoint folder di bawah ini wajib login
router.use(requireAuth);

// ---------------------------------------------------------------------
// GET /api/folders/:id — isi folder (subfolder + file) & breadcrumb
// ---------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { folder, rootId } = await assertFolderAccess(req.user, req.params.id);

  const manager = isManager(req.user);
  const [children, files, root, breadcrumb] = await Promise.all([
    prisma.folder.findMany({
      where: { parentId: folder.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { files: { where: { status: 'READY' } }, children: true } },
      },
    }),
    prisma.file.findMany({
      where: { folderId: folder.id, status: 'READY' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        folderId: true,
        uploadedBy: { select: { id: true, name: true } },
        bucket: { select: { id: true, name: true, provider: true } },
      },
    }),
    folder.isRoot && !manager
      ? Promise.resolve(folder)
      : prisma.folder.findUnique({ where: { id: rootId }, select: rootSelect(manager) }),
    folder.isRoot
      ? Promise.resolve([{ id: folder.id, name: folder.name, isRoot: true }])
      : getBreadcrumb(folder),
  ]);

  res.json({
    folder: {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      isRoot: folder.isRoot,
      parentId: folder.parentId,
      rootId,
    },
    root,
    breadcrumb,
    children,
    files,
    limits: { maxFileSizeBytes: env.maxFileSizeBytes },
    permissions: { canManage: isManager(req.user), canUpload: true, canCreateFolder: true },
  });
});

// ---------------------------------------------------------------------
// POST /api/folders — buat Folder Utama (Admin) atau subfolder
// ---------------------------------------------------------------------
const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama folder wajib diisi').max(120),
  parentId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  color: z.enum(COLORS).optional(),
  quotaLimitBytes: z.number().int().positive('Kuota harus lebih dari 0').optional().nullable(),
  memberIds: z.array(z.string()).optional(),
});

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  const name = cleanName(data.name);
  if (!name) throw badRequest('Nama folder tidak valid.');

  if (!data.parentId) {
    // Folder Utama (Workspace / Divisi / Kementerian)
    if (!isManager(req.user)) throw forbidden('Hanya Admin / Sekretaris yang dapat membuat Folder Utama.');
    if (!data.quotaLimitBytes) throw badRequest('Kuota folder utama wajib ditentukan.');
    const folder = await prisma.folder.create({
      data: {
        name,
        description: data.description || null,
        color: data.color || 'blue',
        isRoot: true,
        quotaLimitBytes: BigInt(data.quotaLimitBytes),
        createdById: req.user.id,
        members: data.memberIds?.length ? { connect: data.memberIds.map((id) => ({ id })) } : undefined,
      },
      select: rootSelect(true),
    });
    logActivity(req.user.id, 'FOLDER_CREATE', 'FOLDER', folder.id, {
      name,
      root: true,
      quota: formatBytes(data.quotaLimitBytes),
    });
    return res.status(201).json({ folder });
  }

  // Subfolder
  const { folder: parent, rootId } = await assertFolderAccess(req.user, data.parentId);
  const duplicate = await prisma.folder.findFirst({
    where: { parentId: parent.id, name: { equals: name, mode: 'insensitive' } },
  });
  if (duplicate) throw badRequest(`Folder "${name}" sudah ada di lokasi ini.`);

  const folder = await prisma.folder.create({
    data: { name, color: data.color || 'slate', parentId: parent.id, rootId, createdById: req.user.id },
  });
  logActivity(req.user.id, 'FOLDER_CREATE', 'FOLDER', folder.id, { name, parent: parent.name });
  res.status(201).json({ folder });
});

// ---------------------------------------------------------------------
// PATCH /api/folders/:id — ganti nama / ubah kuota / anggota
// ---------------------------------------------------------------------
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.enum(COLORS).optional(),
  quotaLimitBytes: z.number().int().positive('Kuota harus lebih dari 0').optional(),
  memberIds: z.array(z.string()).optional(),
});

router.patch('/:id', async (req, res) => {
  const data = updateSchema.parse(req.body);
  const { folder } = await assertFolderAccess(req.user, req.params.id);
  const manager = isManager(req.user);

  if (folder.isRoot && !manager) throw forbidden('Hanya Admin / Sekretaris yang dapat mengubah Folder Utama.');
  if (!folder.isRoot && (data.quotaLimitBytes || data.memberIds)) {
    throw badRequest('Kuota & anggota hanya dapat diatur pada Folder Utama.');
  }

  const update = {};
  if (data.name !== undefined) {
    const name = cleanName(data.name);
    if (!name) throw badRequest('Nama folder tidak valid.');
    update.name = name;
  }
  if (data.description !== undefined) update.description = data.description;
  if (data.color) update.color = data.color;

  if (data.quotaLimitBytes !== undefined) {
    const newQuota = BigInt(data.quotaLimitBytes);
    if (newQuota < folder.usedBytes) {
      throw badRequest(
        `Kuota baru (${formatBytes(newQuota)}) lebih kecil dari penggunaan saat ini (${formatBytes(folder.usedBytes)}). Hapus beberapa file terlebih dahulu.`
      );
    }
    update.quotaLimitBytes = newQuota;
  }
  if (data.memberIds) update.members = { set: data.memberIds.map((id) => ({ id })) };

  const updated = await prisma.folder.update({
    where: { id: folder.id },
    data: update,
    select: folder.isRoot ? rootSelect(manager) : undefined,
  });

  if (data.quotaLimitBytes !== undefined && folder.quotaLimitBytes !== update.quotaLimitBytes) {
    logActivity(req.user.id, 'QUOTA_UPDATE', 'FOLDER', folder.id, {
      name: updated.name,
      from: formatBytes(folder.quotaLimitBytes),
      to: formatBytes(update.quotaLimitBytes),
    });
  }
  if (update.name && update.name !== folder.name) {
    logActivity(req.user.id, 'FOLDER_RENAME', 'FOLDER', folder.id, { from: folder.name, to: update.name });
  }
  res.json({ folder: updated });
});

// ---------------------------------------------------------------------
// DELETE /api/folders/:id — hapus folder beserta isinya (transaction)
// ---------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { folder } = await assertFolderAccess(req.user, req.params.id);
  if (folder.isRoot && !isManager(req.user)) throw forbidden('Hanya Admin / Sekretaris yang dapat menghapus Folder Utama.');

  const folderIds = await getSubtreeIds(folder);
  const files = await prisma.file.findMany({
    where: { folderId: { in: folderIds } },
    include: { bucket: true },
  });
  const readyFiles = files.filter((f) => f.status === 'READY');
  const totalBytes = readyFiles.reduce((s, f) => s + f.sizeBytes, 0n);

  await prisma.$transaction(async (tx) => {
    await releaseQuota(tx, readyFiles);
    await tx.file.deleteMany({ where: { folderId: { in: folderIds } } });
    await tx.folder.delete({ where: { id: folder.id } });
  });

  // Hapus object fisik setelah transaksi DB berhasil
  await Promise.allSettled(files.map((f) => storageRouter.deleteObject(f.bucket, f.objectKey)));

  logActivity(req.user.id, 'FOLDER_DELETE', 'FOLDER', folder.id, {
    name: folder.name,
    files: files.length,
    freed: formatBytes(totalBytes),
  });
  res.json({ message: `Folder "${folder.name}" berhasil dihapus.`, deletedFiles: files.length, freedBytes: totalBytes });
});

// ---------------------------------------------------------------------
// POST /api/folders/:id/recalculate — hitung ulang used_bytes (Admin)
// ---------------------------------------------------------------------
router.post('/:id/recalculate', requireManager, async (req, res) => {
  const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
  if (!folder || !folder.isRoot) throw notFound('Folder utama tidak ditemukan.');
  const agg = await prisma.file.aggregate({
    where: { rootFolderId: folder.id, status: 'READY' },
    _sum: { sizeBytes: true },
  });
  const used = agg._sum.sizeBytes ?? 0n;
  const updated = await prisma.folder.update({
    where: { id: folder.id },
    data: { usedBytes: used },
    select: rootSelect(true),
  });
  res.json({ folder: updated });
});

export default router;
