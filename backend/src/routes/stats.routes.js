import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isManager } from '../middleware/auth.js';
import { getAccessibleRootIds } from '../services/access.service.js';

const router = Router();

// GET /api/stats/overview — ringkasan kapasitas untuk sidebar & dashboard
router.get('/overview', async (req, res) => {
  const manager = isManager(req.user);
  const rootIds = await getAccessibleRootIds(req.user);
  const fileScope = { status: 'READY', ...(rootIds ? { rootFolderId: { in: rootIds } } : {}) };

  const [roots, byCategory, fileCount] = await Promise.all([
    prisma.folder.findMany({
      where: { isRoot: true, ...(rootIds ? { id: { in: rootIds } } : {}) },
      select: { id: true, name: true, color: true, quotaLimitBytes: true, usedBytes: true },
    }),
    prisma.file.groupBy({ by: ['category'], where: fileScope, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.file.count({ where: fileScope }),
  ]);

  const categories = byCategory.map((c) => ({
    category: c.category,
    count: c._count._all,
    bytes: c._sum.sizeBytes ?? 0n,
  }));

  if (manager) {
    const [buckets, userCount] = await Promise.all([
      prisma.storageBucket.findMany({
        select: {
          id: true,
          name: true,
          provider: true,
          isActive: true,
          maxCapacityBytes: true,
          usedCapacityBytes: true,
        },
        orderBy: { priority: 'desc' },
      }),
      prisma.user.count(),
    ]);
    const active = buckets.filter((b) => b.isActive);
    return res.json({
      scope: 'global',
      capacityBytes: active.reduce((s, b) => s + b.maxCapacityBytes, 0n),
      usedBytes: buckets.reduce((s, b) => s + b.usedCapacityBytes, 0n),
      allocatedQuotaBytes: roots.reduce((s, r) => s + (r.quotaLimitBytes ?? 0n), 0n),
      counts: { buckets: buckets.length, activeBuckets: active.length, users: userCount, folders: roots.length, files: fileCount },
      buckets,
      categories,
    });
  }

  const activeBuckets = await prisma.storageBucket.findMany({
    where: { isActive: true },
    select: { maxCapacityBytes: true, usedCapacityBytes: true },
  });

  res.json({
    scope: 'personal',
    capacityBytes: activeBuckets.reduce((s, b) => s + b.maxCapacityBytes, 0n),
    usedBytes: activeBuckets.reduce((s, b) => s + b.usedCapacityBytes, 0n),
    counts: { folders: roots.length, files: fileCount },
    categories,
  });
});

export default router;
