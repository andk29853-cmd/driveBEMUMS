import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

const bool = (v, d) =>
  v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const GB = 1024 ** 3;

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-insecure-encryption-key',

  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Base URL publik backend (dipakai untuk URL upload/download Local Disk).
  // Kosongkan bila frontend memakai proxy /api (default dev Vite).
  publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),

  maxFileSizeBytes: Math.round(Number(process.env.MAX_FILE_SIZE_MB || 5120) * 1024 * 1024),
  presignedExpires: Number(process.env.PRESIGNED_URL_EXPIRES || 900),

  localStorage: {
    enabled: bool(process.env.LOCAL_STORAGE_ENABLED, true),
    path: path.resolve(BACKEND_ROOT, process.env.LOCAL_STORAGE_PATH || './uploads'),
    capacityBytes: BigInt(Math.round(Number(process.env.LOCAL_STORAGE_CAPACITY_GB || 500) * GB)),
  },
};

if (env.nodeEnv === 'production' && env.jwtSecret.startsWith('dev-insecure')) {
  console.warn('⚠️  JWT_SECRET belum diatur! Segera set di .env untuk production.');
}
