import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { decrypt } from '../lib/crypto.js';

/**
 * Driver S3-compatible (Cloudflare R2, Backblaze B2, Storj, MinIO, AWS S3, dll).
 * Client di-cache per bucket & otomatis dibuat ulang ketika konfigurasi bucket berubah.
 */
const cache = new Map();

function buildClient(bucket) {
  return new S3Client({
    region: bucket.region || 'auto',
    endpoint: bucket.endpoint || undefined,
    forcePathStyle: bucket.forcePathStyle ?? true,
    credentials: {
      accessKeyId: decrypt(bucket.accessKey) || '',
      secretAccessKey: decrypt(bucket.secretKey) || '',
    },
    // Penting untuk R2/B2/Storj: jangan tambahkan header checksum CRC32 otomatis
    // pada presigned URL (tidak didukung sebagian provider & browser upload).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
  });
}

function getClient(bucket) {
  if (!bucket.id) return buildClient(bucket); // konfigurasi belum disimpan (test koneksi)
  const version = bucket.updatedAt ? new Date(bucket.updatedAt).getTime() : 0;
  const cached = cache.get(bucket.id);
  if (cached && cached.version === version) return cached.client;
  const client = buildClient(bucket);
  cache.set(bucket.id, { version, client });
  return client;
}

function contentDisposition(disposition, fileName) {
  const ascii = String(fileName).replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const s3Driver = {
  async presignUpload(bucket, key, contentType) {
    const command = new PutObjectCommand({ Bucket: bucket.bucketName, Key: key, ContentType: contentType });
    const url = await getSignedUrl(getClient(bucket), command, { expiresIn: env.presignedExpires });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType } };
  },

  async presignDownload(bucket, key, { fileName, contentType, disposition = 'attachment' }) {
    const command = new GetObjectCommand({
      Bucket: bucket.bucketName,
      Key: key,
      ResponseContentDisposition: contentDisposition(disposition, fileName),
      ResponseContentType: contentType,
    });
    return getSignedUrl(getClient(bucket), command, { expiresIn: env.presignedExpires });
  },

  async head(bucket, key) {
    try {
      const res = await getClient(bucket).send(new HeadObjectCommand({ Bucket: bucket.bucketName, Key: key }));
      return { size: Number(res.ContentLength ?? 0) };
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') return null;
      throw err;
    }
  },

  async delete(bucket, key) {
    await getClient(bucket).send(new DeleteObjectCommand({ Bucket: bucket.bucketName, Key: key }));
  },

  async test(bucket) {
    await getClient(bucket).send(new HeadBucketCommand({ Bucket: bucket.bucketName }));
    return true;
  },
};
