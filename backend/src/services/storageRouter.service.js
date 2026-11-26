import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { formatBytes, slugifyKey } from '../lib/files.js';
import { s3Driver } from '../storage/s3.driver.js';
import { localDriver } from '../storage/local.driver.js';

export const LOCAL_BUCKET_ID = 'local-disk';

/**
 * StorageRouterService
 * --------------------
 * Pusat logika Multi-Bucket Storage:
 *  - memilih bucket aktif dengan sisa kapasitas cukup secara otomatis,
 *  - menerbitkan Presigned Upload / Download URL,
 *  - mengabstraksi perbedaan driver S3-compatible dan Local Disk.
 */
class StorageRouterService {
  driverFor(bucket) {
    return bucket.provider === 'LOCAL' ? localDriver : s3Driver;
  }

  /** Memastikan baris bucket "Local Disk" ada bila LOCAL_STORAGE_ENABLED=true. */
  async ensureLocalBucket() {
    if (!env.localStorage.enabled) return null;
    return prisma.storageBucket.upsert({
      where: { id: LOCAL_BUCKET_ID },
      update: {},
      create: {
        id: LOCAL_BUCKET_ID,
        name: 'Local Disk (Fallback)',
        provider: 'LOCAL',
        region: 'local',
        bucketName: 'local-uploads',
        endpoint: null,
        maxCapacityBytes: env.localStorage.capacityBytes,
        isActive: true,
        priority: -100,
      },
    });
  }

  freeBytes(bucket) {
    return bucket.maxCapacityBytes - bucket.usedCapacityBytes;
  }

  /**
   * Pilih bucket untuk file berukuran `sizeBytes`.
   * Aturan: bucket aktif & (max - used >= size). Bucket S3 selalu didahulukan,
   * Local Disk hanya dipakai sebagai fallback. Urutan: priority DESC, sisa ruang DESC.
   */
  async selectBucket(sizeBytes) {
    const size = BigInt(sizeBytes);
    const buckets = await prisma.storageBucket.findMany({ where: { isActive: true } });
    const usable = buckets.filter((b) => b.provider !== 'LOCAL' || env.localStorage.enabled);

    const candidates = usable
      .filter((b) => this.freeBytes(b) >= size)
      .sort((a, b) => {
        const localA = a.provider === 'LOCAL' ? 1 : 0;
        const localB = b.provider === 'LOCAL' ? 1 : 0;
        if (localA !== localB) return localA - localB;
        if (a.priority !== b.priority) return b.priority - a.priority;
        const fa = this.freeBytes(a);
        const fb = this.freeBytes(b);
        return fa === fb ? 0 : fa > fb ? -1 : 1;
      });

    if (!candidates.length) {
      if (!usable.length) {
        throw new HttpError(
          507,
          'Belum ada storage bucket aktif. Hubungi Admin untuk menambahkan bucket atau aktifkan LOCAL_STORAGE_ENABLED.',
          { code: 'NO_BUCKET' }
        );
      }
      const maxFree = usable.reduce((m, b) => (this.freeBytes(b) > m ? this.freeBytes(b) : m), 0n);
      throw new HttpError(
        507,
        `Kapasitas seluruh storage bucket tidak mencukupi untuk file ${formatBytes(size)} (sisa terbesar ${formatBytes(maxFree)}). Hubungi Admin.`,
        { code: 'BUCKET_FULL' }
      );
    }
    return candidates[0];
  }

  buildObjectKey(rootFolderId, fileName) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${rootFolderId}/${yyyy}/${mm}/${randomUUID()}-${slugifyKey(fileName)}`;
  }

  async createUploadUrl(bucket, key, contentType, sizeBytes) {
    try {
      return await this.driverFor(bucket).presignUpload(bucket, key, contentType, sizeBytes);
    } catch (err) {
      console.error('[storage] presign upload gagal', err);
      throw new HttpError(502, `Gagal membuat URL upload untuk bucket "${bucket.name}".`, { code: 'BUCKET_ERROR' });
    }
  }

  async createDownloadUrl(bucket, key, opts) {
    try {
      return await this.driverFor(bucket).presignDownload(bucket, key, opts);
    } catch (err) {
      console.error('[storage] presign download gagal', err);
      throw new HttpError(502, `Gagal membuat URL unduhan dari bucket "${bucket.name}".`, { code: 'BUCKET_ERROR' });
    }
  }

  async getObjectSize(bucket, key) {
    try {
      const head = await this.driverFor(bucket).head(bucket, key);
      return head ? head.size : null;
    } catch (err) {
      console.error('[storage] head object gagal', err);
      throw new HttpError(502, `Gagal terhubung ke storage bucket "${bucket.name}" untuk verifikasi file.`, {
        code: 'BUCKET_ERROR',
      });
    }
  }

  /** Hapus object (best-effort, tidak melempar error agar DB tetap konsisten). */
  async deleteObject(bucket, key) {
    try {
      await this.driverFor(bucket).delete(bucket, key);
      return true;
    } catch (err) {
      console.error(`[storage] gagal menghapus object ${key} di bucket ${bucket.name}`, err?.message || err);
      return false;
    }
  }

  async testConnection(bucket) {
    const started = Date.now();
    try {
      await this.driverFor(bucket).test(bucket);
      return { ok: true, latencyMs: Date.now() - started, message: 'Koneksi berhasil.' };
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      let message = err?.message || 'Koneksi gagal.';
      if (status === 403) message = 'Akses ditolak (403). Periksa Access Key / Secret Key dan izin bucket.';
      else if (status === 404) message = 'Bucket tidak ditemukan (404). Periksa nama bucket dan endpoint.';
      else if (status === 301) message = 'Region / endpoint tidak sesuai (301).';
      return { ok: false, latencyMs: Date.now() - started, message };
    }
  }
}

export const storageRouter = new StorageRouterService();
