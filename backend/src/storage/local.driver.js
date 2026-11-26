import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { badRequest } from '../lib/httpError.js';

/**
 * Local Disk Storage Fallback.
 * Meniru alur "presigned URL" S3: backend menerbitkan URL bertanda tangan (JWT)
 * yang berlaku sementara, lalu browser melakukan PUT/GET langsung ke URL tersebut.
 */
const ROOT = env.localStorage.path;

export function resolveLocalPath(key) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw badRequest('Object key tidak valid.');
  return full;
}

export function signLocalToken(payload) {
  return jwt.sign({ ...payload, scope: 'local-storage' }, env.jwtSecret, { expiresIn: env.presignedExpires });
}

export function verifyLocalToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.scope !== 'local-storage') throw new Error('Invalid scope');
  return payload;
}

export const localDriver = {
  async presignUpload(_bucket, key, contentType, size) {
    const token = signLocalToken({ op: 'put', key, size: Number(size) });
    return {
      url: `${env.publicApiUrl}/api/local-storage/upload/${token}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    };
  },

  async presignDownload(_bucket, key, { fileName, contentType, disposition = 'attachment' }) {
    const token = signLocalToken({ op: 'get', key, fn: fileName, ct: contentType, disp: disposition });
    return `${env.publicApiUrl}/api/local-storage/object/${token}`;
  },

  async head(_bucket, key) {
    try {
      const stat = await fs.stat(resolveLocalPath(key));
      return { size: stat.size };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  },

  async delete(_bucket, key) {
    await fs.rm(resolveLocalPath(key), { force: true });
  },

  async test() {
    await fs.mkdir(ROOT, { recursive: true });
    const probe = path.join(ROOT, '.write-test');
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
    return true;
  },
};
