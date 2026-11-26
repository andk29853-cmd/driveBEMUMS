import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/httpError.js';
import { isManager } from '../middleware/auth.js';

/** null = semua folder (Admin/Sekretaris/Pengguna terbuka), array id = folder utama yang diizinkan (Member). */
export async function getAccessibleRootIds(user) {
  if (isManager(user) || user?.role === 'GUEST') return null;
  const roots = await prisma.folder.findMany({
    where: { isRoot: true, members: { some: { id: user.id } } },
    select: { id: true },
  });
  return roots.map((r) => r.id);
}

export async function canAccessRoot(user, rootId) {
  if (isManager(user) || user?.role === 'GUEST') return true;
  const count = await prisma.folder.count({
    where: { id: rootId, isRoot: true, members: { some: { id: user.id } } },
  });
  return count > 0;
}

/** Validasi akses user ke sebuah folder (root/subfolder). Mengembalikan folder & id folder utama. */
export async function assertFolderAccess(user, folderId) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw notFound('Folder tidak ditemukan.');
  const rootId = folder.isRoot ? folder.id : folder.rootId;
  if (!(await canAccessRoot(user, rootId))) throw forbidden('Anda tidak memiliki akses ke folder ini.');
  return { folder, rootId };
}

export async function assertFileAccess(user, fileId, include = {}) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, include: { bucket: true, ...include } });
  if (!file) throw notFound('File tidak ditemukan.');
  if (!(await canAccessRoot(user, file.rootFolderId))) throw forbidden('Anda tidak memiliki akses ke file ini.');
  return file;
}

/** Breadcrumb dari folder utama sampai folder saat ini. */
export async function getBreadcrumb(folder) {
  const trail = [{ id: folder.id, name: folder.name, isRoot: folder.isRoot }];
  let parentId = folder.parentId;
  let guard = 0;
  while (parentId && guard++ < 50) {
    const parent = await prisma.folder.findUnique({
      where: { id: parentId },
      select: { id: true, name: true, isRoot: true, parentId: true },
    });
    if (!parent) break;
    trail.unshift({ id: parent.id, name: parent.name, isRoot: parent.isRoot });
    parentId = parent.parentId;
  }
  return trail;
}

/** Semua id folder di dalam subtree (termasuk folder itu sendiri). */
export async function getSubtreeIds(folder) {
  const rootId = folder.isRoot ? folder.id : folder.rootId;
  const all = await prisma.folder.findMany({ where: { rootId }, select: { id: true, parentId: true } });
  const childrenMap = new Map();
  for (const f of all) {
    if (!childrenMap.has(f.parentId)) childrenMap.set(f.parentId, []);
    childrenMap.get(f.parentId).push(f.id);
  }
  const ids = [folder.id];
  for (let i = 0; i < ids.length; i++) {
    for (const child of childrenMap.get(ids[i]) || []) ids.push(child);
  }
  return ids;
}
