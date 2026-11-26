import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, BACKEND_ROOT } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { optionalAuth, requireAuth, requireManager } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { storageRouter } from './services/storageRouter.service.js';
import authRoutes from './routes/auth.routes.js';
import folderRoutes from './routes/folders.routes.js';
import fileRoutes from './routes/files.routes.js';
import bucketRoutes from './routes/buckets.routes.js';
import userRoutes from './routes/users.routes.js';
import statsRoutes from './routes/stats.routes.js';
import activityRoutes from './routes/activity.routes.js';
import localStorageRoutes from './routes/localStorage.routes.js';

// BigInt (kolom byte) → Number saat dikirim sebagai JSON
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function toJSON() {
  return Number(this);
};

const app = express();
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
  })
);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Local Disk "presigned" endpoints menerima stream mentah → sebelum body parser
app.use('/api/local-storage', localStorageRoutes);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }
  res.json({ status: 'ok', database, localStorage: env.localStorage.enabled, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/folders', optionalAuth, folderRoutes);
app.use('/api/files', requireAuth, fileRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/activity', requireAuth, activityRoutes);
app.use('/api/buckets', requireAuth, requireManager, bucketRoutes);
app.use('/api/users', requireAuth, requireManager, userRoutes);
app.use('/api', notFoundHandler);

// Production: sajikan build frontend (opsional, single deployment)
const distDir = path.resolve(BACKEND_ROOT, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use(errorHandler);

// Bersihkan upload PENDING yang ditinggalkan (> 6 jam)
async function cleanupStaleUploads() {
  try {
    const stale = await prisma.file.findMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 6 * 3600 * 1000) } },
      include: { bucket: true },
      take: 200,
    });
    for (const f of stale) {
      await storageRouter.deleteObject(f.bucket, f.objectKey);
      await prisma.file.delete({ where: { id: f.id } }).catch(() => {});
    }
    if (stale.length) console.log(`[cleanup] ${stale.length} upload tertunda dibersihkan`);
  } catch (err) {
    console.error('[cleanup] gagal', err.message);
  }
}

app.listen(env.port, async () => {
  console.log(`\n🚀 DriveBEM API berjalan di http://localhost:${env.port}`);
  console.log(`   Local Disk Fallback: ${env.localStorage.enabled ? `AKTIF (${env.localStorage.path})` : 'nonaktif'}\n`);
  try {
    await storageRouter.ensureLocalBucket();
    if (env.localStorage.enabled) fs.mkdirSync(env.localStorage.path, { recursive: true });
  } catch (err) {
    console.error('⚠️  Tidak dapat terhubung ke database:', err.message.split('\n').slice(-1)[0]);
  }
  cleanupStaleUploads();
  setInterval(cleanupStaleUploads, 3600 * 1000).unref();
});
