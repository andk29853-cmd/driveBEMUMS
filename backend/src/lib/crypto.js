import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Enkripsi kredensial bucket (access key / secret key) saat disimpan di database.
const PREFIX = 'enc:v1:';
const key = crypto.createHash('sha256').update(String(env.encryptionKey)).digest();

export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return plain ?? null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, data].map((b) => b.toString('base64')).join(':');
}

export function decrypt(value) {
  if (!value) return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // nilai plain (mis. diinput manual)
  const [iv, tag, data] = value.slice(PREFIX.length).split(':').map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function mask(value) {
  const plain = (() => {
    try {
      return decrypt(value);
    } catch {
      return null;
    }
  })();
  if (!plain) return null;
  if (plain.length <= 8) return '••••' + plain.slice(-2);
  return plain.slice(0, 4) + '••••' + plain.slice(-4);
}
