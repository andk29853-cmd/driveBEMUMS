import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, unauthorized } from '../lib/httpError.js';
import { requireAuth, requireLogin, signToken } from '../middleware/auth.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive });

router.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().email('Format email tidak valid'), password: z.string().min(1, 'Password wajib diisi') })
    .parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Email atau password salah.');
  }
  if (!user.isActive) throw unauthorized('Akun Anda dinonaktifkan. Hubungi Admin.');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  logActivity(user.id, 'LOGIN', 'AUTH', user.id);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/admin-key', async (req, res) => {
  const { key } = z.object({ key: z.string().min(1, 'Kata kunci wajib diisi') }).parse(req.body);
  const customKey = await prisma.appSetting.findUnique({ where: { key: 'adminAccessKey' } });
  const expectedKey = customKey?.value || process.env.ADMIN_ACCESS_KEY || 'AdminBEM!';
  if (key !== expectedKey) {
    throw unauthorized('Kata kunci Admin tidak sesuai.');
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw unauthorized('Akun Admin tidak ditemukan.');

  await prisma.user.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  logActivity(admin.id, 'LOGIN', 'AUTH', admin.id, { method: 'admin-key' });
  res.json({ token: signToken(admin), user: publicUser(admin) });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.patch('/me', requireAuth, requireLogin, async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100) }).parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name } });
  res.json({ user: publicUser(user) });
});

router.post('/change-password', requireAuth, requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({
      currentPassword: z.string().min(1, 'Password lama wajib diisi'),
      newPassword: z.string().min(6, 'Password baru minimal 6 karakter'),
    })
    .parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Password lama tidak sesuai.');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  logActivity(user.id, 'PASSWORD_CHANGE', 'USER', user.id);
  res.json({ message: 'Password berhasil diperbarui.' });
});

export default router;
