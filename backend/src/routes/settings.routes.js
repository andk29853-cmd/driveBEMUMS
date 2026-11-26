import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/httpError.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { logActivity } from '../services/activity.service.js';

const router = Router();

const DEFAULTS = {
  cabinetName: 'Kabinet Kolektiva BEM UMS 2026',
  appTagline: 'Cloud Arsip Terpusat',
};

// GET /api/settings — publik, untuk menampilkan nama kabinet aktif
router.get('/', async (_req, res) => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    settings: {
      cabinetName: map.cabinetName || DEFAULTS.cabinetName,
      appTagline: map.appTagline || DEFAULTS.appTagline,
    },
  });
});

// PATCH /api/settings — khusus Admin / Sekretaris untuk mengganti nama kabinet saat masa transisi
router.patch('/', requireAuth, requireManager, async (req, res) => {
  const data = z
    .object({
      cabinetName: z.string().trim().min(2, 'Nama kabinet minimal 2 karakter').max(120).optional(),
      appTagline: z.string().trim().min(2).max(120).optional(),
    })
    .parse(req.body);

  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  logActivity(req.user.id, 'SETTINGS_UPDATE', 'SYSTEM', null, data);
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(DEFAULTS) } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    settings: {
      cabinetName: map.cabinetName || DEFAULTS.cabinetName,
      appTagline: map.appTagline || DEFAULTS.appTagline,
    },
  });
});

// POST /api/settings/admin-key — ubah kata kunci Admin
router.post('/admin-key', requireAuth, requireManager, async (req, res) => {
  const { currentKey, newKey } = z
    .object({
      currentKey: z.string().min(1, 'Kata kunci lama wajib diisi'),
      newKey: z.string().trim().min(4, 'Kata kunci baru minimal 4 karakter').max(100),
    })
    .parse(req.body);

  const stored = await prisma.appSetting.findUnique({ where: { key: 'adminAccessKey' } });
  const expected = stored?.value || process.env.ADMIN_ACCESS_KEY || 'AdminBEM!';
  if (currentKey !== expected) throw badRequest('Kata kunci lama tidak sesuai.');

  await prisma.appSetting.upsert({
    where: { key: 'adminAccessKey' },
    update: { value: newKey },
    create: { key: 'adminAccessKey', value: newKey },
  });
  logActivity(req.user.id, 'PASSWORD_CHANGE', 'USER', req.user.id);
  res.json({ message: 'Kata kunci Admin berhasil diperbarui.' });
});

export default router;
