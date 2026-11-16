# Ticketing Data Service

React/Vite frontend with a PHP/PDO API served by the local PHP server.

## Local setup

1. Make sure Apache/PHP 8.2 and MySQL are running, and `ticketing_db.bookings` exists.
2. Ensure PHP has the `pdo_mysql` extension enabled.
3. Copy `config.example.php` to `config.local.php` and enter your local MySQL username and password. This file is ignored by Git.
4. Copy `.env.example` to `.env` and set `FINANCE_USERNAME` and `FINANCE_PASSWORD`. The local `.env` file is ignored by Git.
5. Run `npm install` in the project root.
6. Start the single frontend application with `npm run dev` from the project root. The Ticketing sidebar's Flight Data section contains read-only Dashboard, Riwayat Bulanan, and Penghasilan pages, styled consistently with the rest of Ticketing. The dashboard summarizes the current month's flights and the four latest months of ticket income; the other pages provide period details. Flight Data is read from the API only; no flight records are entered or modified in the UI.
7. Open the Vite URL shown in the terminal. Vite forwards `/server/...` requests to `http://127.0.0.1:9495`. The Flight Data pages request `/flights.php` from the local web server.

Check the PHP API directly at `http://127.0.0.1:9495/server/index.php?path=/api/health`. The React app calls `server/index.php` through the Vite proxy: GET returns the booking list, POST creates one or more bookings, PATCH updates a booking's status or passenger name, phone, and route, and DELETE removes a booking. PATCH and DELETE include `?id=<booking-id>`.

The API assigns numbers 01-12 per route and travel date, validates the Monday/Wednesday/Saturday flight schedule, and records the booking timestamp in MySQL. To create multiple passengers at once, send `passengers` as an array of `{ "name": "...", "phone": "..." }` objects along with `route` and `date`. The legacy single-passenger `name` and `phone` fields are also accepted.

Check seat availability with `GET http://127.0.0.1:9495/server/index.php?route=MNA-IAX&date=2026-11-09`. The response includes the capacity, number booked, available seats, and a `status` of `available` or `full`.

Existing browser `localStorage` bookings are not copied automatically to MySQL. Export them from the old UI first if you need to keep those records.

The Flight Data PHP API and its database migrations remain as backend support; the separate Flight Data React application has been consolidated into the Ticketing frontend.

## Keuangan access

The Penghasilan and Rincian Penghasilan pages require the credentials in `.env`. Their sidebar tabs are hidden until the server confirms an authenticated session; the login/logout button is at the bottom of the sidebar. Other pages, including Riwayat Flight and Ticketing, remain public. The Flight Data API removes ticket-fee fields for unauthenticated requests and requires an authenticated session for writes.

Set `FINANCE_USERNAME` and `FINANCE_PASSWORD` in the project-root `.env` file. The password is read as plaintext from the server-side environment and is not included in frontend code. Never commit `.env` or expose it through a public web root.

The login uses an HttpOnly, SameSite session cookie. Use the same site origin for the frontend and PHP APIs so the session protects both page access and Flight Data requests.

Riwayat Flight PDF previews and downloads also save a server copy under `flight-pdf/` as `data-flight-{bulan}-{tahun}.pdf`, for example `data-flight-november-2026.pdf`. The PHP process must be able to create and write to that folder. The folder is ignored by Git because it contains generated reports.

The Penghasilan PDF buttons export the current month's fee-ticket report; Rincian Penghasilan exports the selected month. The report includes flight fares, fees, route summaries, and the signature from `src/assets/ttd.png`.
