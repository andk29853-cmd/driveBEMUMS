import { Router } from 'express';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { HttpError, notFound, unauthorized } from '../lib/httpError.js';
import { resolveLocalPath, verifyLocalToken } from '../storage/local.driver.js';

/**
 * Endpoint penerima "presigned URL" untuk Local Disk Storage Fallback.
 * Dipasang SEBELUM express.json() agar body mentah (stream) tidak diparsing.
 */
const router = Router();

function readToken(token, op) {
  try {
    const payload = verifyLocalToken(token);
    if (payload.op !== op) throw new Error('op');
    return payload;
  } catch {
    throw unauthorized('URL sudah kedaluwarsa atau tidak valid.');
  }
}

router.put('/upload/:token', async (req, res) => {
  const payload = readToken(req.params.token, 'put');
  const target = resolveLocalPath(payload.key);
  await fs.mkdir(path.dirname(target), { recursive: true });

  const tmp = `${target}.part`;
  let received = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (received > payload.size) return cb(new HttpError(413, 'Ukuran file melebihi ukuran yang dideklarasikan.'));
      cb(null, chunk);
    },
  });

  try {
    await pipeline(req, limiter, createWriteStream(tmp));
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'Upload terputus. Silakan coba lagi.');
  }
  res.json({ ok: true, size: received });
});

router.get('/object/:token', async (req, res) => {
  const payload = readToken(req.params.token, 'get');
  const target = resolveLocalPath(payload.key);
  try {
    await fs.access(target);
  } catch {
    throw notFound('File tidak ditemukan di penyimpanan lokal.');
  }
  const fileName = payload.fn || path.basename(target);
  const ascii = String(fileName).replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  res.setHeader('Content-Type', payload.ct || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${payload.disp === 'inline' ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
  );
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(path.relative(env.localStorage.path, target), { root: env.localStorage.path, dotfiles: 'allow' });
});

export default router;
