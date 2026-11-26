import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isManager } from '../middleware/auth.js';

const router = Router();

// GET /api/activity — Admin melihat semua, Member hanya aktivitasnya sendiri
router.get('/', async (req, res) => {
  if (!req.user?.id) return res.json({ logs: [] });
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const where = isManager(req.user) ? {} : { userId: req.user.id };
  if (req.query.entityType) where.entityType = String(req.query.entityType);
  const logs = await prisma.activityLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ logs });
});

export default router;
