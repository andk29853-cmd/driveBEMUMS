import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../lib/httpError.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  folders: { select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } },
  _count: { select: { files: true } },
};

const createSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['ADMIN', 'SECRETARY', 'MEMBER']).default('MEMBER'),
  isActive: z.boolean().optional().default(true),
  folderIds: z.array(z.string()).optional().default([]),
});

const updateSchema = createSchema.partial().extend({
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
});

function guardRole(actor, targetRole) {
  if (targetRole === 'ADMIN' && actor.role !== 'ADMIN') throw forbidden('Hanya Admin yang dapat mengelola akun Admin.');
}

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
  res.json({ users });
});

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  guardRole(req.user, data.role);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw badRequest('Email sudah terdaftar.');

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      isActive: data.isActive,
      passwordHash: await bcrypt.hash(data.password, 10),
      folders: data.folderIds.length ? { connect: data.folderIds.map((id) => ({ id })) } : undefined,
    },
    select: userSelect,
  });
  logActivity(req.user.id, 'USER_CREATE', 'USER', user.id, { email: user.email, role: user.role });
  res.status(201).json({ user });
});

router.patch('/:id', async (req, res) => {
  const data = updateSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound('Pengguna tidak ditemukan.');
  guardRole(req.user, target.role);
  if (data.role) guardRole(req.user, data.role);
  if (target.id === req.user.id && (data.isActive === false || (data.role && data.role !== target.role))) {
    throw badRequest('Anda tidak dapat menonaktifkan atau mengubah role akun Anda sendiri.');
  }

  const update = {};
  for (const k of ['name', 'email', 'role', 'isActive']) if (data[k] !== undefined) update[k] = data[k];
  if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);
  if (data.folderIds) update.folders = { set: data.folderIds.map((id) => ({ id })) };

  const user = await prisma.user.update({ where: { id: target.id }, data: update, select: userSelect });
  logActivity(req.user.id, 'USER_UPDATE', 'USER', user.id, { email: user.email, fields: Object.keys(update) });
  res.json({ user });
});

router.delete('/:id', async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound('Pengguna tidak ditemukan.');
  if (target.id === req.user.id) throw badRequest('Anda tidak dapat menghapus akun Anda sendiri.');
  guardRole(req.user, target.role);
  await prisma.user.delete({ where: { id: target.id } });
  logActivity(req.user.id, 'USER_DELETE', 'USER', target.id, { email: target.email });
  res.json({ message: `Pengguna "${target.name}" berhasil dihapus.` });
});

export default router;
