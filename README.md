# Ticketing Data Service

React/Vite frontend with a PHP/PDO API served by the local PHP server.

## Local setup

1. Make sure Apache/PHP 8.2 and MySQL are running, and `ticketing_db.bookings` exists.
2. Ensure PHP has the `pdo_mysql` extension enabled.
3. Copy `config.example.php` to `config.local.php` and enter your local MySQL username and password. This file is ignored by Git.
4. Copy `.env.example` to `.env` and set `FINANCE_USERNAME` and `FINANCE_PASSWORD`. The local `.env` file is ignored by Git.
5. Run `npm install` in the project root.
6. Start the single frontend application with `npm run dev` from the project root. The Ticketing sidebar's Flight Data section contains read-only Dashboard, Riwayat Bulanan, and Penghasilan pages, styled consistently with the rest of Ticketing. The dashboard summarizes the current month's flights and the four latest months of ticket income; the other pages provide period details. Flight Data is read from the API only; no flight records are entered or modified in the UI.
7. Open the Vite URL shown in the terminal. Vite forwards `/server/...` requests to `http://127.0.0.1:9495`. The Flight Data pages request `/server/flights.php`.

Check the PHP API directly at `http://127.0.0.1:9495/server/index.php?path=/api/health`. The React app calls `server/index.php` through the Vite proxy: GET returns the booking list, POST creates one or more bookings, PATCH updates a booking's status or passenger name, phone, and route, and DELETE removes a booking. PATCH and DELETE include `?id=<booking-id>`.

The API assigns numbers 01-12 per route and travel date, validates the Monday/Wednesday/Saturday flight schedule, and records the booking timestamp in MySQL. To create multiple passengers at once, send `passengers` as an array of `{ "name": "...", "phone": "..." }` objects along with `route` and `date`. The legacy single-passenger `name` and `phone` fields are also accepted.

Check seat availability with `GET http://127.0.0.1:9495/server/index.php?route=MNA-IAX&date=2026-11-09`. The response includes the capacity, number booked, available seats, and a `status` of `available` or `full`.

Existing browser `localStorage` bookings are not copied automatically to MySQL. Export them from the old UI first if you need to keep those records.

All PHP files live in `server/`: `index.php` (bookings, login, PDF), `flights.php` (Flight Data API), `finance-auth.php`, and `flights-config.php` (Flight Data database connection, configured with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` in the PHP-FPM environment). The Flight Data database migrations are in `Flight-Data/database/migrations`. The separate Flight Data React application has been consolidated into the Ticketing frontend.

## Node.js API (alternatif PHP)

Folder `node-api/` berisi API Node.js (Express + mysql2) dengan kontrak yang sama seperti PHP. API PHP di `server/` tetap utuh, sehingga bisa dibandingkan atau dikembalikan kapan saja. Salinan semua file yang diubah untuk migrasi ini ada di `backup/2026-11-18_pre-node-api/`.

| Endpoint Node.js | Setara PHP |
| --- | --- |
| `GET/POST/PATCH/DELETE /api/bookings` | `server/index.php` (pemesanan, `?id=` untuk PATCH/DELETE) |
| `GET /api/finance/session`, `POST /api/finance/login`, `POST /api/finance/logout` | `server/index.php?path=/api/finance/...` |
| `POST /api/flight-pdf?year=&month=` | `server/index.php?path=/api/flight-pdf` |
| `GET/POST /api/flights` | `server/flights.php` |
| `GET /api/health` | `server/index.php?path=/api/health` |

Menjalankan di lokal:

1. `cd node-api` lalu `npm install`.
2. Isi `.env` di root proyek (atau `node-api/.env`) dengan `FINANCE_USERNAME`, `FINANCE_PASSWORD`, dan variabel `BOOKINGS_DB_*` serta `FLIGHTS_DB_*`; daftar lengkapnya ada di `.env.example`. Variabel yang sudah ada di environment proses (misalnya dari PM2 atau systemd) selalu didahulukan.
3. `npm start` (atau `npm run dev` untuk auto-reload). Server mendengarkan `127.0.0.1:3001`; `npm test` menjalankan tesnya.
4. Frontend memakai PHP secara bawaan. Untuk memakai Node.js, set `VITE_API_BACKEND=node` lalu jalankan ulang `npm run dev` atau `npm run build`. Saat `npm run dev`, Vite meneruskan `/api` ke `127.0.0.1:3001`.

Di server, jalankan `node-api` dengan PM2 atau systemd, lalu teruskan `/api/` dari Nginx:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
}
```

Catatan perilaku:

- Sesi login Keuangan memakai cookie `lupin_finance` yang ditandatangani (HttpOnly, SameSite=Lax, berlaku 12 jam) dan tidak disimpan di server. Logout menghapus cookie di browser. Isi `SESSION_SECRET` agar sesi tetap valid setelah password diganti.
- Webhook ke n8n saat status menjadi Booked dikirim di latar belakang dan tidak menahan respons. URL-nya diatur lewat `BOOKING_WEBHOOK_URL` (`off` untuk menonaktifkan).
- Dua database tetap terpisah: `ticketing_db` untuk pemesanan dan `db-jmt` untuk Flight Data.

## Keuangan access

The Penghasilan and Rincian Penghasilan pages require the credentials in `.env`. Their sidebar tabs are hidden until the server confirms an authenticated session; the login/logout button is at the bottom of the sidebar. Other pages, including Riwayat Flight and Ticketing, remain public. The Flight Data API removes ticket-fee fields for unauthenticated requests and requires an authenticated session for writes.

Set `FINANCE_USERNAME` and `FINANCE_PASSWORD` in the project-root `.env` file. The password is read as plaintext from the server-side environment and is not included in frontend code. Never commit `.env` or expose it through a public web root.

The login uses an HttpOnly, SameSite session cookie. Use the same site origin for the frontend and PHP APIs so the session protects both page access and Flight Data requests.

Riwayat Flight PDF previews and downloads also save a server copy under `flight-pdf/` as `data-flight-{bulan}-{tahun}.pdf`, for example `data-flight-november-2026.pdf`. The PHP process must be able to create and write to that folder. The folder is ignored by Git because it contains generated reports.

The Penghasilan PDF buttons export the current month's fee-ticket report; Rincian Penghasilan exports the selected month. The report includes flight fares, fees, route summaries, and the signature from `src/assets/ttd.png`.
