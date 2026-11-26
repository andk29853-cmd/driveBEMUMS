import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/httpError.js';

export const MANAGER_ROLES = ['ADMIN', 'SECRETARY'];
export const isManager = (user) => MANAGER_ROLES.includes(user?.role);

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

const GUEST_USER = Object.freeze({
  id: null,
  name: 'Pengguna',
  email: null,
  role: 'GUEST',
  isActive: true,
});

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      if (user && user.isActive) {
        req.user = user;
        return next();
      }
    } catch {
      // Abaikan token tidak valid, lanjutkan sebagai pengguna biasa
    }
  }

  req.user = GUEST_USER;
  next();
}

export async function requireAuth(req, _res, next) {
  return optionalAuth(req, _res, next);
}

export function requireLogin(req, _res, next) {
  if (!req.user?.id) throw unauthorized('Silakan login sebagai Admin terlebih dahulu.');
  next();
}

export function requireManager(req, _res, next) {
  if (!isManager(req.user)) throw forbidden('Fitur ini khusus Admin / Sekretaris.');
  next();
}
