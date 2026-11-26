import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.join('.');
    return res.status(400).json({
      message: field ? `Input "${field}" tidak valid: ${first.message}` : first?.message || 'Input tidak valid.',
      issues: err.issues,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Data dengan nilai tersebut sudah ada.' });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Data tidak ditemukan.' });
    if (err.code === 'P2003') return res.status(409).json({ message: 'Data masih digunakan oleh data lain.' });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(err);
    return res.status(503).json({ message: 'Database tidak dapat dihubungi. Periksa DATABASE_URL.' });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid.' });
  }

  console.error('[error]', err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
}
