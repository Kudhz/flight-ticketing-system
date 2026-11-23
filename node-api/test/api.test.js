import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import {
  extractPassengers,
  findAlternativeFlights,
  validateRouteAndDate,
} from "../src/bookings.js";
import { parseCalendarDate } from "../src/dates.js";
import { parseMonth, readWeight } from "../src/flights.js";
import { InvalidInput } from "../src/http.js";

// Rabu, 18 November 2026 pukul 13:00 WITA.
const NOW = new Date("2026-11-18T05:00:00Z");
const TODAY = parseCalendarDate("2026-11-18");

const noDatabase = {
  execute: async (sql) => {
    throw new Error(`Query tidak diharapkan: ${sql}`);
  },
};

async function startServer({ bookingsPool = noDatabase, flightsPool = noDatabase, pdfDirectory } = {}) {
  const config = {
    finance: { username: "admin", password: "rahasia", sessionSecret: "" },
    corsOrigins: ["http://localhost:5173"],
    bookingWebhookUrl: "off",
    pdfDirectory: pdfDirectory ?? os.tmpdir(),
  };
  const app = createApp({ config, bookingsPool, flightsPool, now: () => NOW });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

const json = (body, headers = {}) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

async function login(url) {
  const response = await fetch(`${url}/api/finance/login`, json({ username: "admin", password: "rahasia" }));
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

// Memastikan setiap placeholder bernama pada SQL punya nilai, karena tidak ada MySQL pada tes ini.
function assertBound(sql, params) {
  for (const [, name] of sql.matchAll(/:(\w+)/g)) {
    assert.ok(params && name in params, `Placeholder :${name} tidak terisi pada: ${sql.slice(0, 60)}`);
  }
}

function fakeBookingsPool({ duplicate = false } = {}) {
  const inserted = [];
  const state = { rollbacks: 0 };
  const handle = async (sql, params) => {
    assertBound(sql, params);
    if (/INSERT INTO bookings/.test(sql)) {
      inserted.push(params);
      return [{ insertId: inserted.length }];
    }
    if (/FROM bookings WHERE id = :id/.test(sql)) {
      const row = inserted[params.id - 1];
      return [
        [
          {
            id: params.id,
            passenger_name: row.name,
            phone: row.phone,
            booking_no: row.bookingNo,
            route_code: row.route,
            travel_date: row.date,
            status: row.status,
            booking_at: "2026-11-18 13:00:00",
          },
        ],
      ];
    }
    if (/SELECT booking_no/.test(sql)) return [[{ booking_no: 1 }, { booking_no: 3 }]];
    if (/GROUP BY travel_date/.test(sql)) return [[]];
    if (/COUNT\(DISTINCT booking_no\)/.test(sql)) return [[{ booked: 3 }]];
    if (/LOWER\(TRIM\(passenger_name\)\)/.test(sql)) return [duplicate ? [{ id: 1 }] : []];
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };
  const connection = {
    execute: handle,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {
      state.rollbacks += 1;
    },
    release: () => {},
  };
  return { execute: handle, query: handle, getConnection: async () => connection, inserted, state };
}

function fakeFlightsPool() {
  const statements = [];
  const handle = async (sql, params) => {
    if (sql.startsWith("INSERT") || sql.startsWith("DELETE")) {
      assertBound(sql, params);
      statements.push({ sql, params });
      return [{}];
    }
    if (/GROUP BY route/.test(sql)) {
      return [[{ route: "MNA-IAX", total_flights: 2, total_pax: 10, total_fee: "150000.00" }]];
    }
    if (/FROM flight_records/.test(sql)) {
      return [[{ id: 1, flight_day: 3, route: "MNA-IAX", pax: 10, basic_fare: "500000.00", fee_ticket: "15000.00" }]];
    }
    throw new Error(`Query tidak diharapkan: ${sql}`);
  };
  const connection = {
    execute: handle,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  return { execute: handle, getConnection: async () => connection, statements };
}

test("validateRouteAndDate mengizinkan bulan ini dan bulan berikutnya saja", () => {
  assert.doesNotThrow(() => validateRouteAndDate("MNA-IAX", "2026-11-21", TODAY));
  assert.doesNotThrow(() => validateRouteAndDate("MNA-IAX", "2026-12-02", TODAY));
  assert.throws(() => validateRouteAndDate("XXX", "2026-11-21", TODAY), /Rute penerbangan tidak valid/);
  assert.throws(() => validateRouteAndDate("MNA-IAX", "2026-02-30", TODAY), /Tanggal tidak valid/);
  assert.throws(() => validateRouteAndDate("MNA-IAX", "2026-11-17", TODAY), /sudah lewat/);
  assert.throws(() => validateRouteAndDate("MNA-IAX", "2027-01-02", TODAY), /bulan ini dan bulan berikutnya/);
  assert.throws(() => validateRouteAndDate("MNA-IAX", "2026-11-19", TODAY), /Senin, Rabu, dan Sabtu/);
  assert.doesNotThrow(() =>
    validateRouteAndDate("MNA-IAX", "2027-01-02", parseCalendarDate("2026-12-30")),
  );
  assert.throws(
    () => validateRouteAndDate("MNA-IAX", "2027-02-01", parseCalendarDate("2026-12-30")),
    /bulan ini dan bulan berikutnya/,
  );
});

test("extractPassengers mendukung format tunggal dan daftar", () => {
  assert.deepEqual(extractPassengers({ name: " Budi ", phone: "0812" }), [{ name: "Budi", phone: "0812", type: "adult" }]);
  assert.deepEqual(extractPassengers({ passengers: ["Ani", { name: "Cici", phone: "0899" }], phone: "0811" }), [
    { name: "Ani", phone: "0811", type: "adult" },
    { name: "Cici", phone: "0899", type: "adult" },
  ]);
  assert.throws(() => extractPassengers({ passengers: [{ name: "Ani" }] }), InvalidInput);
  assert.throws(() => extractPassengers({}), /minimal satu/);
  assert.throws(
    () => extractPassengers({ passengers: Array.from({ length: 13 }, (_, i) => ({ name: `P${i}`, phone: "1" })) }),
    /melebihi kapasitas/,
  );
});

test("findAlternativeFlights melewatkan jadwal penuh dan hari tanpa penerbangan", async () => {
  const db = { execute: async () => [[{ travel_date: "2026-11-25", booked: "10" }]] };
  const alternatives = await findAlternativeFlights(db, "MNA-IAX", "2026-11-21", TODAY);

  assert.deepEqual(
    alternatives.map((item) => [item.date, item.day, item.available]),
    [
      ["2026-11-23", "Senin", 10],
      ["2026-11-28", "Sabtu", 10],
      ["2026-11-30", "Senin", 10],
    ],
  );
});

test("parseMonth dan readWeight setara perilaku PHP", () => {
  assert.equal(parseMonth("Maret"), 3);
  assert.equal(parseMonth("12"), 12);
  assert.equal(parseMonth("13"), null);
  assert.equal(parseMonth("abc"), null);
  assert.equal(readWeight(""), 0);
  assert.equal(readWeight("12.345"), 12.35);
  assert.equal(readWeight("-1"), null);
  assert.equal(readWeight("abc"), null);
});

test("login Keuangan memakai cookie sesi bertanda tangan", async (t) => {
  const { url, close } = await startServer();
  t.after(close);

  let response = await fetch(`${url}/api/finance/session`);
  assert.deepEqual(await response.json(), { configured: true, authenticated: false });

  response = await fetch(`${url}/api/finance/login`, json({ username: "admin", password: "salah" }));
  assert.equal(response.status, 401);

  response = await fetch(`${url}/api/finance/login`, { ...json({}), body: "{rusak" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Format JSON tidak valid.");

  const cookie = await login(url);
  response = await fetch(`${url}/api/finance/session`, { headers: { Cookie: cookie } });
  assert.deepEqual(await response.json(), { configured: true, authenticated: true });

  const tampered = cookie.replace(/.$/, (char) => (char === "A" ? "B" : "A"));
  response = await fetch(`${url}/api/finance/session`, { headers: { Cookie: tampered } });
  assert.equal((await response.json()).authenticated, false);

  response = await fetch(`${url}/api/finance/session`, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});

test("API bookings menolak input tidak valid sebelum menyentuh database", async (t) => {
  const { url, close } = await startServer();
  t.after(close);

  let response = await fetch(`${url}/api/bookings?route=XXX&date=2026-11-21`);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).status, "invalid_route");

  response = await fetch(`${url}/api/bookings?route=MNA-IAX&date=21-11-2026`);
  assert.equal((await response.json()).status, "invalid_date");

  response = await fetch(`${url}/api/bookings`, json({ route: "MNA-IAX", date: "2026-11-19", name: "A", phone: "1" }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Senin, Rabu, dan Sabtu/);

  response = await fetch(`${url}/api/bookings?id=abc`, { method: "DELETE" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "ID pemesanan tidak valid.");

  response = await fetch(`${url}/api/bookings`, { method: "PUT" });
  assert.equal(response.status, 405);
});

test("POST /api/bookings memberi nomor booking kosong terkecil", async (t) => {
  const bookingsPool = fakeBookingsPool();
  const { url, close } = await startServer({ bookingsPool });
  t.after(close);

  const response = await fetch(
    `${url}/api/bookings`,
    json({ route: "MNA-IAX", date: "2026-11-21", passengers: [{ name: "Ani", phone: "0811" }, "Budi"], phone: "0899" }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(
    body.map((booking) => [booking.name, booking.phone, booking.bookingNo, booking.status, booking.bookingAt]),
    [
      ["Ani", "0811", 2, "Menunggu verifikasi", "2026-11-18T13:00:00"],
      ["Budi", "0899", 4, "Menunggu verifikasi", "2026-11-18T13:00:00"],
    ],
  );
});

test("POST /api/bookings menerima tanggal bulan depan dan menolak dua bulan ke depan", async (t) => {
  const bookingsPool = fakeBookingsPool();
  const { url, close } = await startServer({ bookingsPool });
  t.after(close);

  const payload = { route: "MNA-IAX", name: "Ani", phone: "0811" };
  let response = await fetch(
    `${url}/api/bookings`,
    json({ ...payload, date: "2026-12-02" }),
  );
  assert.equal(response.status, 201);

  response = await fetch(
    `${url}/api/bookings`,
    json({ ...payload, date: "2027-01-02" }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /bulan ini dan bulan berikutnya/);
  assert.equal(bookingsPool.inserted.length, 1);
});

test("POST /api/bookings menolak penumpang duplikat dan membatalkan transaksi", async (t) => {
  const bookingsPool = fakeBookingsPool({ duplicate: true });
  const { url, close } = await startServer({ bookingsPool });
  t.after(close);

  const response = await fetch(
    `${url}/api/bookings`,
    json({ route: "MNA-IAX", date: "2026-11-21", name: "Ani", phone: "0811" }),
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.status, "duplicate_booking");
  assert.equal(bookingsPool.state.rollbacks, 1);
  assert.equal(bookingsPool.inserted.length, 0);

  const check = await fetch(
    `${url}/api/bookings`,
    json({ action: "check_booking", route: "MNA-IAX", date: "2026-11-21", name: "Ani" }),
  );
  assert.equal((await check.json()).status, "duplicate_booking");
});

test("GET /api/bookings menghitung sisa kursi", async (t) => {
  const { url, close } = await startServer({ bookingsPool: fakeBookingsPool() });
  t.after(close);

  const body = await (await fetch(`${url}/api/bookings?route=MNA-IAX&date=2026-11-21`)).json();
  assert.equal(body.status, "available");
  assert.equal(body.booked, 3);
  assert.equal(body.availableSeats, 9);
  assert.equal(body.day, "Sabtu");

  const noSchedule = await (await fetch(`${url}/api/bookings?route=MNA-IAX&date=2026-11-19`)).json();
  assert.equal(noSchedule.status, "no_schedule");
});

test("API flights menyembunyikan data keuangan untuk pengguna belum login", async (t) => {
  const { url, close } = await startServer({ flightsPool: fakeFlightsPool() });
  t.after(close);

  const anonymous = await (await fetch(`${url}/api/flights?year=2026&month=november`)).json();
  assert.equal(anonymous.success, true);
  assert.ok(!("fee_ticket" in anonymous.data[0]) && !("basic_fare" in anonymous.data[0]));
  assert.ok(!("total_fee" in anonymous.summary) && !("total_fee" in anonymous.summary.by_route[0]));

  const cookie = await login(url);
  const finance = await (await fetch(`${url}/api/flights?year=2026&month=11`, { headers: { Cookie: cookie } })).json();
  assert.equal(finance.data[0].fee_ticket, "15000.00");
  assert.equal(finance.summary.total_fee, 150000);
  assert.equal(finance.summary.total_flights, 2);

  const invalid = await fetch(`${url}/api/flights?month=abc`);
  assert.equal(invalid.status, 400);
});

test("POST /api/flights dapat dipanggil tanpa login dan memvalidasi data", async (t) => {
  const flightsPool = fakeFlightsPool();
  const { url, close } = await startServer({ flightsPool });
  t.after(close);

  const payload = {
    year: 2026,
    month: "November",
    replace_period: true,
    flights: [{
      flight_day: 3,
      route: "MNA-IAX",
      pax: 8,
      adult_pax: 6,
      child_pax: 2,
      infant_pax: 1,
      basic_fare: 500000,
      fee_ticket: 15000,
      cargo_weight: "10.5",
    }],
  };

  let response = await fetch(`${url}/api/flights`, json(payload));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, message: "Data penerbangan berhasil disimpan.", inserted: 1 });
  assert.equal(flightsPool.statements.length, 2);
  assert.equal(flightsPool.statements[1].params.pax, 9);
  assert.equal(flightsPool.statements[1].params.adult_pax, 6);
  assert.equal(flightsPool.statements[1].params.child_pax, 2);
  assert.equal(flightsPool.statements[1].params.infant_pax, 1);
  assert.equal(flightsPool.statements[1].params.total_weight, 10.5);

  const mismatchPayload = {
    ...payload,
    replace_period: false,
    flights: [{
      flight_day: 28,
      route: "MNA-MDC",
      adult_pax: 10,
      child_pax: 1,
      infant_pax: 1,
      pax: 12,
      basic_fare: 483000,
      fee_ticket: 24150,
    }],
  };
  response = await fetch(`${url}/api/flights`, json(mismatchPayload));
  assert.equal(response.status, 201);
  const lastParams = flightsPool.statements.at(-1).params;
  assert.equal(lastParams.pax, 12);
  assert.equal(lastParams.adult_pax, 10);
  assert.equal(lastParams.child_pax, 1);
  assert.equal(lastParams.infant_pax, 1);
  assert.equal(lastParams.basic_fare, 483000);
  assert.equal(lastParams.fee_ticket, 24150);

  const iaxPayload = {
    ...mismatchPayload,
    flights: [{ ...mismatchPayload.flights[0], route: "MNA-IAX", basic_fare: 1, fee_ticket: 1 }],
  };
  response = await fetch(`${url}/api/flights`, json(iaxPayload));
  assert.equal(response.status, 201);
  const iaxParams = flightsPool.statements.at(-1).params;
  assert.equal(iaxParams.basic_fare, 380000);
  assert.equal(iaxParams.fee_ticket, 19000);

  const bad = { ...payload, flights: [{ ...payload.flights[0], route: "XXX-YYY" }] };
  response = await fetch(`${url}/api/flights`, json(bad));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, "Route tidak valid pada urutan 1.");

  response = await fetch(`${url}/api/flights`, json({ ...payload, flights: [{ ...payload.flights[0], flight_day: 31 }] }));
  assert.equal(response.status, 400);

  response = await fetch(`${url}/api/flights`, { method: "OPTIONS", headers: { Origin: "http://localhost:5173" } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("POST /api/flight-pdf menyimpan PDF dengan nama laporan bulanan", async (t) => {
  const pdfDirectory = await mkdtemp(path.join(os.tmpdir(), "flight-pdf-"));
  const { url, close } = await startServer({ pdfDirectory });
  t.after(async () => {
    await close();
    await rm(pdfDirectory, { recursive: true, force: true });
  });

  const pdf = Buffer.from("%PDF-1.4\nisi");
  let response = await fetch(`${url}/api/flight-pdf?year=2026&month=11`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdf,
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, filename: "data-flight-november-2026.pdf" });
  assert.deepEqual(await readFile(path.join(pdfDirectory, "data-flight-november-2026.pdf")), pdf);

  response = await fetch(`${url}/api/flight-pdf?year=2026&month=11`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "x",
  });
  assert.equal(response.status, 415);

  response = await fetch(`${url}/api/flight-pdf?year=2026&month=11`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: "bukan pdf",
  });
  assert.equal(response.status, 400);

  response = await fetch(`${url}/api/flight-pdf?year=2026&month=13`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdf,
  });
  assert.equal(response.status, 400);
});
