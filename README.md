# DriveBEM — Cloud Drive & Manajemen Arsip Terpusat

Aplikasi web **Cloud Drive & Manajemen Arsip Terpusat** (seperti Google Drive kustom organisasi/BEM) dengan **Sistem Kuota Folder Dinamis** dan arsitektur **Multi-Bucket Storage Router** yang kompatibel dengan berbagai penyedia S3-compatible object storage (**Cloudflare R2, Backblaze B2, Storj, MinIO, AWS S3**) serta dilengkapi **Local Disk Storage Fallback**.

---

## ✨ Fitur Utama

1. **Multi-Bucket Storage Router (`StorageRouterService`)**
   - Menggunakan AWS SDK v3 (`@aws-sdk/client-s3` & `@aws-sdk/s3-request-presigner`).
   - Pemilihan bucket otomatis berdasarkan status aktif (`is_active`), prioritas, dan ketersediaan ruang (`max_capacity_bytes - used_capacity_bytes >= file_size`).
   - **Direct Browser-to-Bucket Upload** via **Presigned Upload URL** dengan *real-time upload progress bar* sehingga file besar tidak membebani server backend.
   - **Local Disk Storage Fallback** (`LOCAL_STORAGE_ENABLED=true` di `.env`) agar aplikasi langsung dapat diuji coba secara lokal sebelum kredensial S3/R2/B2 dimasukkan.
2. **Validasi Kuota Folder Dinamis & Transaksi Atomik**
   - Setiap **Folder Utama** (Workspace Divisi / Kementerian) memiliki `quota_limit_bytes` dan `used_bytes`.
   - Subfolder bersarang (*nested folders*) tetap menghitung pemakaian kuota ke Folder Utama induknya (`root_folder_id`).
   - Validasi ketat sebelum Presigned URL dibuat (`folder.used_bytes + incoming_file_size <= folder.quota_limit_bytes`) dan update atomik di dalam `prisma.$transaction` saat upload selesai maupun saat file/folder dihapus.
3. **Role-Based Access Control (RBAC)**
   - **Admin / Sekretaris (`ADMIN`, `SECRETARY`):** Mengelola daftar Storage Bucket, membuat Folder Utama, mengatur & mengubah kuota per folder secara dinamis, mengelola pengguna, dan memantau total kapasitas gabungan seluruh bucket.
   - **Member / Pengguna (`MEMBER`):** Mengakses, mengunggah, mengunduh, mengganti nama, melihat pratinjau, dan menghapus file di dalam folder utama yang diizinkan serta memantau sisa kuota folder mereka.
4. **Manajemen File, Pencarian Cepat & In-App Preview Modal**
   - Drag-and-drop upload multi-file dengan *floating progress panel*.
   - **In-App Preview Modal** untuk melihat file **PDF, Gambar (JPG/PNG/WebP/SVG), Teks/Kode/CSV/JSON, Video, dan Audio** langsung di browser tanpa mengunduh.
   - Pencarian cepat (*instant search*) dan filter tipe dokumen (**Semua, PDF, Dokumen, Gambar, Lainnya**), dilengkapi toggle **Grid View & List View** serta **Light Mode & Dark Mode**.

---

## 📁 Struktur Folder Project

```text
driveBEM/
├── package.json                 # Workspace monorepo scripts (dev, build, db:migrate, db:seed)
├── .env.example                 # Contoh konfigurasi environment
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma        # Skema Prisma (User, StorageBucket, Folder, File, ActivityLog)
│   │   └── seed.js              # Seeder akun Admin/Sekretaris/Member & sample Folder Utama
│   └── src/
│       ├── server.js            # Entry point Express.js API
│       ├── config/env.js        # Konfigurasi environment
│       ├── lib/                 # Prisma client, AES-256-GCM encryption, helper file & error
│       ├── middleware/          # JWT Auth, RBAC guard, Global error handler
│       ├── storage/
│       │   ├── s3.driver.js     # Driver AWS SDK v3 S3-compatible Presigned PUT/GET
│       │   └── local.driver.js  # Driver Local Disk Fallback dengan signed token URL
│       ├── services/
│       │   ├── storageRouter.service.js  # Multi-Bucket Storage Router
│       │   ├── quota.service.js          # Validasi & transaksi atomik kuota folder/bucket
│       │   ├── access.service.js         # RBAC folder & breadcrumb tree
│       │   └── activity.service.js       # Audit log aktivitas
│       └── routes/              # Endpoint Auth, Folders, Files, Buckets, Users, Stats, Activity
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── context/             # AuthContext, UploadContext, ThemeContext, ToastContext, ConfirmContext
        ├── components/          # AppLayout, FileExplorer, PreviewModal, UploadPanel, RootFolderModal, dll.
        └── pages/               # LoginPage, DashboardPage, FolderDetailPage, RecentPage, BucketsPage, UsersPage, SettingsPage
```

---

## 🚀 Langkah Menjalankan Project

### 1. Prasyarat
- **Node.js** v18+ (disarankan v20+)
- **PostgreSQL** (lokal atau **Supabase** PostgreSQL)

### 2. Instalasi Dependensi
Dari root folder project (`driveBEM`):
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
Sesuaikan `DATABASE_URL` dan `DIRECT_URL` di `backend/.env` dengan koneksi PostgreSQL lokal atau Supabase Anda.
> Secara default `LOCAL_STORAGE_ENABLED=true`, sehingga Anda langsung dapat mengunggah dan mengunduh file ke penyimpanan lokal (`backend/uploads`) sebelum menghubungkan bucket S3/R2/B2.

### 4. Migrasi Database & Seed Data Default
Jalankan migrasi skema Prisma dan seed akun awal:
```bash
# Membuat tabel di database (atau gunakan `npm run db:push` untuk prototipe cepat)
npm run db:migrate

# Mengisi akun default (Admin, Sekretaris, Anggota) + sample Folder Utama
npm run db:seed
```

### 5. Menjalankan Aplikasi (Development)
Jalankan backend (`http://localhost:4000`) dan frontend Vite (`http://localhost:5173`) secara bersamaan:
```bash
npm run dev
```
Buka **`http://localhost:5173`** di browser.

---

## 🔑 Akun Default (Hasil Seed)

| Role | Email | Password | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@drive.local` | `admin123` | Kelola Storage Bucket, Folder Utama & Kuota, Semua Pengguna, Semua File |
| **Sekretaris** | `sekretaris@drive.local` | `sekretaris123` | Kelola Storage Bucket, Folder Utama & Kuota, Anggota, Semua File |
| **Member / Anggota** | `anggota@drive.local` | `anggota123` | Akses, upload, preview, rename & hapus file pada folder divisi yang diizinkan |

*(Di halaman Login tersedia tombol sekali klik untuk mengisi akun demo di atas).*
