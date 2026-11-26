import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MB = 1024 ** 2;
const GB = 1024 ** 3;

const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

async function upsertUser({ name, email, password, role }) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function main() {
  console.log('🌱 Seeding database...');

  const admin = await upsertUser({
    name: process.env.SEED_ADMIN_NAME || 'Administrator',
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@drive.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    role: 'ADMIN',
  });
  const secretary = await upsertUser({
    name: 'Sekretaris Umum',
    email: 'sekretaris@drive.local',
    password: 'sekretaris123',
    role: 'SECRETARY',
  });
  const member = await upsertUser({
    name: 'Anggota Kominfo',
    email: 'anggota@drive.local',
    password: 'anggota123',
    role: 'MEMBER',
  });

  // Local Disk Fallback bucket
  if (bool(process.env.LOCAL_STORAGE_ENABLED, true)) {
    await prisma.storageBucket.upsert({
      where: { id: 'local-disk' },
      update: {},
      create: {
        id: 'local-disk',
        name: 'Local Disk (Fallback)',
        provider: 'LOCAL',
        region: 'local',
        bucketName: 'local-uploads',
        maxCapacityBytes: BigInt(Math.round(Number(process.env.LOCAL_STORAGE_CAPACITY_GB || 500) * GB)),
        priority: -100,
      },
    });
  }

  // Folder Utama Kabinet Kolektiva BEM UMS 2026 (masing-masing 25 GB)
  const units = [
    { name: 'Sekretaris Kabinet', color: 'red', description: 'Kabinet Kolektiva BEM UMS 2026 — Figur Ahmad Brilian & Khalda Syifa Nida' },
    { name: 'Bendahara Kabinet', color: 'amber', description: 'Kabinet Kolektiva BEM UMS 2026 — Nisa Hidayanti Putri' },
    { name: 'Kemenlugri', color: 'blue', description: 'Kabinet Kolektiva BEM UMS 2026 — Jody Julian Putra Caesar' },
    { name: 'Kemendagri', color: 'emerald', description: 'Kabinet Kolektiva BEM UMS 2026 — Firda Hayyuning Nusa' },
    { name: 'Kemenpop', color: 'orange', description: 'Kabinet Kolektiva BEM UMS 2026 — Bramantyo Ikhsanul Hakim' },
    { name: 'Kemen Advokesma', color: 'violet', description: 'Kabinet Kolektiva BEM UMS 2026 — Anggris Bagus Eka Saputra' },
    { name: 'Kemen Pergerakan', color: 'pink', description: 'Kabinet Kolektiva BEM UMS 2026 — Riezky Prayudha Anggito Prabowo' },
    { name: 'Kemendinfo', color: 'indigo', description: 'Kabinet Kolektiva BEM UMS 2026 — Chandra Nur Prasetya' },
  ];

  for (const u of units) {
    const exists = await prisma.folder.findFirst({ where: { name: u.name, isRoot: true } });
    if (exists) continue;
    await prisma.folder.create({
      data: {
        name: u.name,
        description: u.description,
        color: u.color,
        isRoot: true,
        quotaLimitBytes: BigInt(25 * GB),
        createdById: admin.id,
      },
    });
  }

  console.log('\n✅ Seed selesai. Akun default:');
  console.table([
    { role: 'ADMIN', email: admin.email, password: process.env.SEED_ADMIN_PASSWORD || 'admin123' },
    { role: 'SECRETARY', email: secretary.email, password: 'sekretaris123' },
    { role: 'MEMBER', email: member.email, password: 'anggota123' },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
