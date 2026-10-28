# Kebutuhan integrasi frontend teknisi SijaLink

Dokumen ini membandingkan frontend Flutter di `../sijalink_mobile` dengan
backend ini pada 20 Oktober 2026. Ini adalah **inventaris kebutuhan dan usulan
kontrak**, bukan pernyataan bahwa endpoint yang diusulkan sudah tersedia.
Sumber kondisi backend: `src/api/api.controller.ts`, `src/auth/auth.controller.ts`,
`prisma/schema.prisma`; sumber kebutuhan UI: modul `lib/auth/` dan
`lib/teknisi/` pada frontend.

## Konvensi integrasi

- Seluruh path API di bawah diawali `/api/v1`. URL dasar lokal, misalnya
  `http://localhost:3000/api/v1`, harus diubah sesuai alamat yang **dapat
  dijangkau perangkat** (localhost emulator/perangkat bukan localhost PC).
- Semua request selain login dan health menggunakan
  `Authorization: Bearer <accessToken>`. Login merespons `accessToken`,
  `tokenType`, `expiresIn`, dan `user`; `GET /auth/me` memvalidasi sesi.
  Backend belum menyediakan refresh token maupun revokasi/logout server.
- Daftar customer, tiket, dan SPK merespons `{items, total, page, limit}`;
  default `limit=20`, maksimum 100. Jangan mengasumsikan satu request berisi
  seluruh data. Riwayat attendance serta notifikasi saat ini merespons array,
  walaupun mendukung `page` dan `limit`.
- Status pekerjaan backend: `NEW`, `IN_PROGRESS`, `DONE`, `CANCELLED`; status
  customer: `ACTIVE`, `ISOLATED`, `INACTIVE`. Frontend perlu memetakan ke label
  Indonesia dan menangani `CANCELLED` yang belum ada pada model UI.
- Backend menggunakan `id` database di parameter `:id`. `number` SPK/tiket
  dan `accountCode` customer adalah kode tampilan, **bukan** pengganti `id`.
- Tanggal/jam dikirim sebagai timestamp JSON; tampilan presensi harus memakai
  zona waktu bisnis (default `Asia/Jakarta`).

## Endpoint yang dibutuhkan frontend

Keterangan: **Ada** = sudah diimplementasikan; **Ada, perlu penyesuaian** =
endpoint tersedia tetapi belum sepenuhnya memenuhi alur UI; **Belum ada** =
usulan endpoint yang memerlukan desain dan implementasi.

| Fitur FE | Method dan path | Status | Kebutuhan / catatan |
| --- | --- | --- | --- |
| Login | `POST /auth/login` | Ada | Body `{email, password}`; ganti login dummy frontend. |
| Sesi & identitas | `GET /auth/me` | Ada | Periksa token ketika aplikasi dibuka; tangani 401/token kedaluwarsa. |
| Logout | Hapus token di FE | Tidak wajib endpoint | Endpoint server baru diperlukan bila ada mekanisme revokasi token. |
| Customer: daftar & pencarian | `GET /customers?page=&limit=&search=&status=` | Ada | Pencarian nama/account code dan filter status. |
| Customer: detail | `GET /customers/:id` | Ada | Gunakan ID database; pemetaan field diperlukan di FE. |
| SPK: daftar & filter | `GET /spk?page=&limit=&status=&assigneeId=` | Ada, perlu penyesuaian | Tentukan dan tegakkan di backend apakah teknisi hanya boleh melihat pekerjaan yang ditugaskan kepadanya. |
| SPK: detail | `GET /spk/:id` | Ada | Untuk detail bila FE membutuhkannya. |
| SPK: ubah status | `PATCH /spk/:id/status` | Ada, perlu penyesuaian | Body `{ "status": "IN_PROGRESS" }` atau `DONE`; evaluasi otorisasi berdasarkan penugasan. Backend membuat audit dan notifikasi. |
| Tiket: daftar & filter | `GET /tickets?page=&limit=&status=&assigneeId=` | Ada, perlu penyesuaian | Tentukan dan tegakkan cakupan akses teknisi. |
| Tiket: detail | `GET /tickets/:id` | Ada | Untuk detail bila FE membutuhkannya. |
| Tiket: ubah status | `PATCH /tickets/:id/status` | Ada, perlu penyesuaian | Body `{ "status": "IN_PROGRESS" }` atau `DONE`; evaluasi otorisasi berdasarkan penugasan. |
| Presensi: hari ini | `GET /attendance/today` | Ada | Mengisi status check-in/out di Beranda dan halaman Kehadiran; respons bisa `null`. |
| Presensi: check-in | `POST /attendance/check-in` | Ada, perlu penyesuaian | Saat ini body hanya koordinat opsional `latitude`/`longitude`; FE mensyaratkan foto. |
| Presensi: check-out | `POST /attendance/check-out` | Ada, perlu penyesuaian | Belum menerima/mengaitkan foto. |
| Presensi: riwayat | `GET /attendance/history?from=&to=&page=&limit=` | Ada, perlu penyesuaian | Backend mengirim satu record per hari; FE memakai record check-in, check-out, dan izin terpisah. |
| Presensi: ringkasan | `GET /attendance/summary?month=YYYY-MM` | Ada, perlu penyesuaian | `totalPresent` tersedia, `totalLate` masih `null`; jumlah izin/sakit belum tersedia. |
| Sakit/izin | Usulan `POST /attendance/leave-requests` | Belum ada | Jenis + keterangan, aturan persetujuan dan relasi dengan presensi harian perlu diputuskan. |
| Foto absensi | Usulan multipart `POST /uploads/attendance` **atau** multipart pada check-in/out | Belum ada | Satu desain saja; perlu penyimpanan, batas ukuran/format, otorisasi akses foto, dan URL/path untuk riwayat. |
| Profil: baca | `GET /auth/me` | Ada, perlu penyesuaian | Baru berisi ID, nama, email, role, active, createdAt; belum ada alamat, telepon, foto, atau Mikrotik terpasang. |
| Profil: edit sendiri | Usulan `PATCH /users/me` | Belum ada | Edit alamat, telepon, email; jangan izinkan FE mengubah role lewat endpoint profil. |
| Foto profil | Usulan `PUT /users/me/photo`, `DELETE /users/me/photo` | Belum ada | Foto FE saat ini hanya disimpan lokal. Perlu aturan penyimpanan dan akses. |
| Notifikasi: daftar | `GET /notifications?page=&limit=&unreadOnly=` | Ada | Map `readAt != null` menjadi `isRead`; siapkan pagination. |
| Notifikasi: jumlah baru | `GET /notifications/unread-count` | Ada | Badge harus memakai hitungan server, bukan hanya item dari halaman pertama. |
| Notifikasi: tandai dibaca | `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | Ada | Ganti perubahan state lokal dengan request server. |
| Notifikasi: hapus | `DELETE /notifications/:id` | Ada | Mendukung swipe-to-delete FE. |
| Mikrotik: inventaris | `GET /routers` | Ada, perlu penyesuaian | Hanya metadata + status `UNKNOWN`; belum menyediakan status online terverifikasi, uptime, atau jumlah klien. |
| GenieACS: perangkat | Usulan `GET /acs/devices` | Belum ada | Butuh serial, model, customer, online dan sumber data GenieACS nyata. |
| GenieACS: reboot | Usulan `POST /acs/devices/:serial/reboot` | Belum ada | Perlu autentikasi ke GenieACS, otorisasi teknisi, audit, hasil job yang jujur, dan penanganan kegagalan. |

Endpoint admin/supervisor (`POST /users`, pengelolaan customer/router,
penugasan SPK/tiket) sudah ada sebagian di backend tetapi **bukan** kebutuhan
tampilan teknisi saat ini.

## Pemetaan respons backend ke model frontend

| Frontend | Backend sekarang | Tindakan |
| --- | --- | --- |
| `AuthUser.nama`, `role` | `user.name`, `user.role` (`TECHNICIAN`) | Map nilai; simpan token dengan mekanisme penyimpanan yang sesuai kebutuhan keamanan aplikasi. Akun dummy `teknisi@sijalink.id` bukan akun backend. |
| `Customer.id` yang ditampilkan | `accountCode`; ID endpoint = `id` | Simpan **keduanya** di model FE. |
| `nama`, `alamat`, `telp`, `paket` | `name`, `address`, `phone`, `plan` | Map dan tangani nilai nullable. |
| `tglPemasangan`, `pppoeUser`, `odp`, `mikrotik` | `installationDate`, `pppoeUsername`, `odp`, `router?.name` | Format tanggal di FE; tampilkan nilai kosong dengan aman. |
| Status customer `Aktif`/`Isolir`/`Tidak Aktif` | `ACTIVE`/`ISOLATED`/`INACTIVE` | Map dua arah untuk filter. |
| `Spk.no`, `jenis`, `customer`, `alamat` | `number`, `workType`, `customer?.name`, `address` | Tambahkan `id` database di model FE untuk PATCH. |
| `Ticket.no`, `judul`, `prioritas`, `customer` | `number`, `title`, `priority`, `customer?.name` | Tambahkan `id` database; tangani customer nullable. |
| `AppNotif.spkNo`, `isRead`, `type` | `spkNumber`, `readAt`, **tanpa** `type` | Pilih apakah FE menurunkan jenis dari data yang ada atau backend menambahkan jenis notifikasi terstruktur. |
| `PresensiRecord` per peristiwa | `Attendance` per `workDate` dengan `checkInAt`/`checkOutAt` | FE dapat memetakan check-in/out menjadi record tampilan, tetapi izin, foto, dan statistik belum ada. |
| `Mikrotik.online`, `clientCount`, `uptime` | `Router.status` (`UNKNOWN`), tanpa count/uptime | Jangan menafsirkan `UNKNOWN` sebagai offline atau menampilkan angka palsu. |

Backend **tidak** menyimpan maupun mengirim password PPPoE. Data dummy frontend
masih memiliki `pppoePass` dan UI dapat menampilkan/menyalinnya. Jangan menambah
password PPPoE ke respons customer umum untuk menyamakan UI; hilangkan bagian
itu di FE produksi, atau rancang alur akses rahasia terpisah dengan keputusan
keamanan eksplisit.

## Pekerjaan frontend yang harus berjalan bersama backend

1. Ganti `AuthRepository` dummy dengan login API, periksa sesi melalui
   `/auth/me`, lampirkan Bearer token, dan tangani 401. Saat ini
   `lib/core/network/api_client.dart` belum menambahkan header Authorization.
2. Ganti `Dummy*Repository` fitur dengan pemanggilan endpoint nyata. Daftar
   placeholder dalam `lib/core/network/teknisi_api.dart` memakai path
   `/teknisi/...` dan `PUT` untuk status, sedangkan backend memakai path di
   tabel ini dan `PATCH`. Mengisi `API_BASE_URL` saja tidak mengaktifkan API.
3. Lengkapi model, pagination, status loading/error/empty, dan pemetaan status
   serta tanggal. Jangan telan error diam-diam ketika request gagal.
4. Kirim perubahan status SPK/tiket ke backend **sebelum** menampilkan sukses.
   Jangan lagi membuat notifikasi lokal ganda (`pushSpk`) jika notifikasi
   berasal dari server. Re-fetch sesuai kebutuhan.
5. Jangan tampilkan foto absensi yang hanya tersimpan di perangkat lain tanpa
   URL/otorisasi file server; sinkronkan data hari ini dan riwayat setelah aksi.
6. Tombol reboot GenieACS saat ini hanya menampilkan snackbar dan belum
   memanggil API. Nonaktifkan/beri penanda belum tersedia sampai integrasi
   reboot berhasil dan mendapat respons nyata.

## Keputusan backend yang perlu disepakati

- **Otorisasi pekerjaan:** apakah teknisi melihat semua SPK/tiket atau hanya
  yang ditugaskan? Apakah hanya assignee yang boleh mengubah status? Saat ini
  filter `assigneeId` opsional dan status dapat diubah oleh user terautentikasi;
  menyaring hanya di FE tidak cukup sebagai perlindungan akses.
- **Presensi:** foto wajib/tidak, ukuran dan format, batas jam masuk, aturan
  terlambat, cuti/sakit/izin dan status persetujuan. FE memakai batas statis
  `08:00`, sedangkan backend belum mengonfigurasi aturan keterlambatan.
- **Profil:** apakah email boleh diedit sendiri, apakah perlu verifikasi ulang,
  dan dari mana alamat, telepon, serta router teknisi berasal.
- **Perangkat:** sumber status/router yang valid, cakupan akses per teknisi,
  kredensial servis, rate limit/audit untuk reboot, dan respons saat perangkat
  tidak dapat dijangkau. Jangan membuat angka status sintetis.

## Urutan implementasi yang disarankan

1. **Fase 1 — API yang sudah ada:** login/JWT, customer, SPK, tiket,
   notifikasi; tetapkan otorisasi pekerjaan dan uji kontrak respons.
2. **Fase 2 — kebutuhan backend baru:** foto/izin presensi, ringkasan sesuai
   aturan kerja, profil dan foto profil.
3. **Fase 3 — integrasi eksternal:** telemetri Mikrotik dan GenieACS/reboot
   setelah sumber data, hak akses, dan prosedur operasional disepakati.

Setiap fase perlu pengujian API (termasuk 401, 403, 409 dan pagination) serta
pengujian alur aplikasi pada perangkat/emulator yang mengakses URL backend
nyata. Daftar endpoint yang belum ada di atas adalah **usulan**, bukan bagian
dari implementasi yang sudah selesai.
