import { prisma } from '../lib/prisma.js';

/** Catat aktivitas (fire-and-forget, tidak menggagalkan request utama). */
export function logActivity(userId, action, entityType, entityId = null, details = null) {
  prisma.activityLog
    .create({ data: { userId, action, entityType, entityId, details: details ?? undefined } })
    .catch((err) => console.error('[activity] gagal mencatat aktivitas', err.message));
}
