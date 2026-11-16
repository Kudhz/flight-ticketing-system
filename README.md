# Ticketing Data Service

React/Vite frontend with a PHP/PDO API served by the local PHP server.

## Local setup

1. Make sure Apache/PHP 8.2 and MySQL are running, and `ticketing_db.bookings` exists.
2. Ensure PHP has the `pdo_mysql` extension enabled.
3. Copy `config.example.php` to `config.local.php` and enter your local MySQL username and password. This file is ignored by Git.
4. Run `npm install` in the project root.
5. Start the single frontend application with `npm run dev` from the project root. The Ticketing sidebar's Flight Data section contains read-only Dashboard, Riwayat Bulanan, and Penghasilan pages, styled consistently with the rest of Ticketing. The dashboard summarizes the current month's flights and the four latest months of ticket income; the other pages provide period details. Flight Data is read from the API only; no flight records are entered or modified in the UI.
6. Open the Vite URL shown in the terminal. Vite forwards `/server/...` requests to `http://127.0.0.1:9495`. The Flight Data pages request `/flights.php` from the local web server.

Check the PHP API directly at `http://127.0.0.1:9495/server/index.php?path=/api/health`. The React app calls `server/index.php` through the Vite proxy: GET returns the booking list, POST creates one or more bookings, PATCH updates a booking's status or passenger name, phone, and route, and DELETE removes a booking. PATCH and DELETE include `?id=<booking-id>`.

The API assigns numbers 01-12 per route and travel date, validates the Monday/Wednesday/Saturday flight schedule, and records the booking timestamp in MySQL. To create multiple passengers at once, send `passengers` as an array of `{ "name": "...", "phone": "..." }` objects along with `route` and `date`. The legacy single-passenger `name` and `phone` fields are also accepted.

Check seat availability with `GET http://127.0.0.1:9495/server/index.php?route=MNA-IAX&date=2026-11-09`. The response includes the capacity, number booked, available seats, and a `status` of `available` or `full`.

Existing browser `localStorage` bookings are not copied automatically to MySQL. Export them from the old UI first if you need to keep those records.

The Flight Data PHP API and its database migrations remain as backend support; the separate Flight Data React application has been consolidated into the Ticketing frontend.
