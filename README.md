# SijaLink Backend

REST API untuk aplikasi teknisi ISP SijaLink. Dibangun dengan NestJS,
TypeScript, PostgreSQL, dan Prisma. Semua endpoint aplikasi berada di bawah
`/api/v1`; dokumentasi OpenAPI tersedia di `/docs`.

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

Aturan jam kerja keterlambatan belum ditetapkan, sehingga summary attendance
mengembalikan `totalLate: null`. Router hanya berupa inventaris metadata dan
status tetap `UNKNOWN` sampai benar-benar diperiksa. Backend tidak menjalankan
command RouterOS atau operasi GenieACS/reboot.
