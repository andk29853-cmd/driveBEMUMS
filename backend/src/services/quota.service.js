import { HttpError } from '../lib/httpError.js';
import { formatBytes } from '../lib/files.js';

/**
 * QuotaService — semua perubahan used_bytes / used_capacity_bytes dilakukan dengan
 * UPDATE atomik di dalam database transaction sehingga aman dari race condition.
 */

/** Validasi awal sebelum presigned URL dibuat. */
export function assertQuotaAvailable(rootFolder, incomingSize) {
  if (rootFolder.quotaLimitBytes === null || rootFolder.quotaLimitBytes === undefined) return;
  const size = BigInt(incomingSize);
  if (rootFolder.usedBytes + size > rootFolder.quotaLimitBytes) {
    const remaining = rootFolder.quotaLimitBytes - rootFolder.usedBytes;
    throw new HttpError(
      413,
      `Kuota folder "${rootFolder.name}" tidak mencukupi. Sisa kuota ${formatBytes(remaining > 0n ? remaining : 0n)}, sedangkan file berukuran ${formatBytes(size)}.`,
      {
        code: 'QUOTA_EXCEEDED',
        remainingBytes: Number(remaining > 0n ? remaining : 0n),
        quotaLimitBytes: Number(rootFolder.quotaLimitBytes),
        usedBytes: Number(rootFolder.usedBytes),
      }
    );
  }
}

/** Tambahkan pemakaian (dipanggil saat upload terverifikasi). Melempar error jika kuota terlampaui. */
export async function consumeQuota(tx, { rootFolderId, bucketId, size }) {
  const bytes = BigInt(size);

  const folderUpdated = await tx.$executeRaw`
    UPDATE "folders"
       SET "used_bytes" = "used_bytes" + ${bytes}, "updated_at" = NOW()
     WHERE "id" = ${rootFolderId}
       AND ("quota_limit_bytes" IS NULL OR "used_bytes" + ${bytes} <= "quota_limit_bytes")`;
  if (folderUpdated === 0) {
    throw new HttpError(413, 'Kuota folder penuh. File tidak dapat disimpan.', { code: 'QUOTA_EXCEEDED' });
  }

  const bucketUpdated = await tx.$executeRaw`
    UPDATE "storage_buckets"
       SET "used_capacity_bytes" = "used_capacity_bytes" + ${bytes}, "updated_at" = NOW()
     WHERE "id" = ${bucketId}
       AND "used_capacity_bytes" + ${bytes} <= "max_capacity_bytes"`;
  if (bucketUpdated === 0) {
    throw new HttpError(507, 'Kapasitas storage bucket penuh. Silakan coba unggah ulang.', { code: 'BUCKET_FULL' });
  }
}

/**
 * Kurangi pemakaian untuk sekumpulan file READY (dipanggil saat hapus file/folder).
 * files: [{ rootFolderId, bucketId, sizeBytes }]
 */
export async function releaseQuota(tx, files) {
  const byRoot = new Map();
  const byBucket = new Map();
  for (const f of files) {
    const size = BigInt(f.sizeBytes);
    byRoot.set(f.rootFolderId, (byRoot.get(f.rootFolderId) || 0n) + size);
    byBucket.set(f.bucketId, (byBucket.get(f.bucketId) || 0n) + size);
  }
  for (const [id, bytes] of byRoot) {
    await tx.$executeRaw`
      UPDATE "folders" SET "used_bytes" = GREATEST("used_bytes" - ${bytes}, 0), "updated_at" = NOW()
       WHERE "id" = ${id}`;
  }
  for (const [id, bytes] of byBucket) {
    await tx.$executeRaw`
      UPDATE "storage_buckets" SET "used_capacity_bytes" = GREATEST("used_capacity_bytes" - ${bytes}, 0), "updated_at" = NOW()
       WHERE "id" = ${id}`;
  }
}
