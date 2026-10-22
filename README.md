# SijaLink Backend

REST API untuk aplikasi teknisi ISP SijaLink. Dibangun dengan NestJS,
TypeScript, PostgreSQL, dan Prisma. Semua endpoint aplikasi berada di bawah
`/api/v1`; dokumentasi OpenAPI tersedia di `/docs`.

Kebutuhan integrasi aplikasi Flutter, daftar endpoint yang diperlukan, dan
gap implementasi tersedia di [docs/frontend-integration.md](docs/frontend-integration.md).

## Menjalankan lokal

```bash
npm install
cp .env.example .env
# Isi JWT_SECRET dengan secret acak minimal 32 karakter
docker compose up -d postgres
npm run db:generate
npx prisma migrate deploy
npm run start:dev
```

Untuk membuat migration baru saat pengembangan, gunakan
`npm run db:migrate:dev -- --name <nama-migrasi>`.

## Data demo lokal

Setelah database kosong dimigrasikan, jalankan `npm run db:seed`. Seed ini
idempotent dan hanya boleh berjalan saat `NODE_ENV` bukan `production`. Seed
membuat akun demo, customer, tiket, SPK, absensi hari ini, notifikasi, dan dua
router inventaris sintetis. Tidak ada password PPPoE; router selalu berstatus
`UNKNOWN` dan tidak ada status koneksi, jumlah klien, atau uptime palsu.

Akun demo:

| Role | Email |
| --- | --- |
| Admin | `admin.demo@sijalink.test` |
| Supervisor | `supervisor.demo@sijalink.test` |
| Teknisi | `teknisi.demo@sijalink.test` |

Password untuk semua akun: `SijaLink-Demo-2026!`. Akun dan password ini hanya
untuk development lokal; jangan gunakan atau seed ke production.

## Endpoint

Semua endpoint berikut kecuali login dan health memerlukan header
`Authorization: Bearer <accessToken>`. Swagger di `/docs` memuat operasi dan
skema body.

| Fitur | Endpoint |
| --- | --- |
| Health | `GET /api/v1/health` |
| Auth | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` |
| User | `GET /api/v1/users`, `POST /api/v1/users` |
| Customer | `GET/POST /api/v1/customers`, `GET/PATCH/DELETE /api/v1/customers/:id` |
| Ticket | `GET/POST /api/v1/tickets`, `GET /api/v1/tickets/:id`, `PATCH /api/v1/tickets/:id/status`, `PATCH /api/v1/tickets/:id/assignment` |
| SPK | `GET/POST /api/v1/spk`, `GET /api/v1/spk/:id`, `PATCH /api/v1/spk/:id/status`, `PATCH /api/v1/spk/:id/assignment` |
| Attendance | `POST /api/v1/attendance/check-in`, `POST /api/v1/attendance/check-out`, `GET /api/v1/attendance/today`, `/history`, `/summary` |
| Notifications | `GET /api/v1/notifications`, `/unread-count`, `PATCH /:id/read`, `/read-all`, `DELETE /:id` |
| Router | `GET/POST /api/v1/routers`, `GET/PATCH/DELETE /api/v1/routers/:id` |

List mendukung `page` dan `limit` dengan maksimum `limit=100`. Role: `ADMIN`,
`SUPERVISOR`, dan `TECHNICIAN`; batas mutasi diterapkan di endpoint/guard.
Password PPPoE tidak disimpan atau ditampilkan. Penghapusan customer bersifat
soft-delete dengan mengubah status ke `INACTIVE`. Notifikasi hanya dapat
diakses pemiliknya.

Contoh login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teknisi@example.com","password":"password-anda"}'
```

Tidak ada akun bawaan. Buat akun administrator awal melalui Prisma Studio atau
mekanisme provisioning internal yang aman.

## Environment

- `DATABASE_URL`: koneksi PostgreSQL.
- `JWT_SECRET`: secret JWT acak minimal 32 karakter; jangan commit secret.
- `CORS_ORIGINS`: daftar origin dipisahkan koma.
- `BUSINESS_TIMEZONE`: zona waktu untuk penentuan hari attendance, default
  `Asia/Jakarta`; timestamp tetap tersimpan UTC.

Ringkasan presensi menggunakan jam masuk dari `WORK_START_TIME` (default 08:00)
di zona `BUSINESS_TIMEZONE`. Router hanya berupa inventaris metadata dan
status tetap `UNKNOWN` sampai benar-benar diperiksa. Backend tidak menjalankan
command RouterOS atau operasi GenieACS/reboot.

## Integrasi teknisi fase 1–2

Jalankan `npm run db:generate` dan `npx prisma migrate deploy` sebelum memakai
endpoint baru. Teknisi hanya melihat SPK/tiket miliknya dan hanya dapat mengubah
status berurutan `NEW` → `IN_PROGRESS` → `DONE`; admin/supervisor boleh membatalkan
pekerjaan aktif. Token akun nonaktif tidak berlaku lagi pada request berikutnya.

- `POST /api/v1/attendance/check-in` dan `/check-out` wajib `multipart/form-data`
  berisi `photo` (JPEG/PNG/WebP, maksimal 5 MB); `latitude` dan `longitude`
  opsional tetapi harus diberikan berpasangan. Foto ada di `PRIVATE_UPLOAD_DIR`
  (default `private-uploads`), **bukan direktori publik**. Siapkan volume persisten
  dengan backup dan pembatasan akses; penyimpanan lokal tidak cocok untuk beberapa
  replika tanpa shared storage. Respons presensi berisi `checkInPhotoUrl` dan
  `checkOutPhotoUrl`; akses foto tetap perlu Bearer token via
  `GET /api/v1/attendance/:id/photo/check-in|check-out`.
- `POST /api/v1/attendance/leave-requests` menerima
  `{ "type": "SICK" | "PERMISSION", "reason": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }`.
  `GET /api/v1/attendance/leave-requests` menampilkan permohonan sendiri untuk
  teknisi, seluruhnya untuk admin/supervisor (`page`, `limit`, `status`, `userId`).
  Admin/supervisor memutuskan lewat `PATCH /api/v1/attendance/leave-requests/:id/review`
  dengan `{ "status": "APPROVED" | "REJECTED" }`. Maksimal 31 hari, tidak dapat
  mulai sebelum hari ini, tidak boleh tumpang tindih dengan permohonan aktif
  atau check-in; persetujuan ulang memeriksa benturan check-in. Ditolak boleh
  diajukan ulang. Rekap bulanan menghitung `totalPresent`, `totalLate`,
  `totalSick`, dan `totalPermission` (dua terakhir hanya yang disetujui).
- `GET /api/v1/auth/me` kini menampilkan `address`, `phone`, `photoUrl`, dan
  `router: null` (belum ada relasi router-teknisi). `PATCH /api/v1/users/me`
  hanya menerima `address` dan `phone`; email/role tetap tidak dapat diubah
  sendiri. Foto profil `PUT /api/v1/users/me/photo` menggunakan multipart field
  `photo`, `GET /api/v1/users/me/photo` menampilkan foto milik sendiri, dan
  `DELETE /api/v1/users/me/photo` menghapusnya.

Jam masuk default `WORK_START_TIME=08:00` dalam `BUSINESS_TIMEZONE=Asia/Jakarta`;
ubah sebelum operasional bila aturan kerja berbeda. Keduanya dipakai untuk
perhitungan keterlambatan; backend belum menerapkan libur atau jadwal shift.
