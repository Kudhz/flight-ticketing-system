import express, { Router } from "express";
import { withTransaction } from "./db.js";
import { HttpError, isNumeric, isPlainObject, readInteger, toText, wrap } from "./http.js";

const MONTHS = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};
const ALLOWED_ROUTES = ["MDC-MNA", "MNA-IAX", "IAX-MNA", "MNA-MDC"];

const fail = (status, message) => new HttpError(status, { success: false, message });

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function parseMonth(value) {
  if (isNumeric(value)) {
    const month = Math.trunc(Number(value));
    return month >= 1 && month <= 12 ? month : null;
  }
  if (typeof value === "string") return MONTHS[value.trim().toLowerCase()] ?? null;
  return null;
}

export function readWeight(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (!isNumeric(value)) return null;

  const weight = Number(value);
  return weight < 0 || weight > 99999999.99 ? null : round2(weight);
}

const readCount = (value) => {
  const count = readInteger(value);
  return count === null || count < 0 ? null : count;
};

function readPassengerTypes(source) {
  const adult = readCount(source.adult_pax ?? source.adultPax ?? 0);
  const child = readCount(source.child_pax ?? source.childPax ?? 0);
  const infant = readCount(source.infant_pax ?? source.infantPax ?? 0);
  const hasBreakdown =
    source.adult_pax !== undefined ||
    source.adultPax !== undefined ||
    source.child_pax !== undefined ||
    source.childPax !== undefined ||
    source.infant_pax !== undefined ||
    source.infantPax !== undefined;

  if (!hasBreakdown) {
    const pax = readInteger(source.pax ?? null);
    if (pax === null || pax < 0) return null;
    return { pax, adult_pax: pax, child_pax: 0, infant_pax: 0 };
  }

  if (
    adult === null ||
    child === null ||
    infant === null
  ) {
    return null;
  }

  const seatedPax = adult + child;
  if (source.pax !== undefined && source.pax !== null && source.pax !== "") {
    const suppliedPax = readInteger(source.pax);
    if (suppliedPax === null || suppliedPax !== seatedPax) return null;
  }

  return { pax: seatedPax, adult_pax: adult, child_pax: child, infant_pax: infant };
}

function readLoadFields(source) {
  const fields = {
    passenger_weight: readWeight(source.passenger_weight ?? 0),
    baggage_pieces: readCount(source.baggage_pieces ?? 0),
    baggage_weight: readWeight(source.baggage_weight ?? 0),
    cabin_baggage_pieces: readCount(source.cabin_baggage_pieces ?? 0),
    cabin_baggage_weight: readWeight(source.cabin_baggage_weight ?? 0),
    cargo_pieces: readCount(source.cargo_pieces ?? 0),
    cargo_weight: readWeight(source.cargo_weight ?? 0),
  };
  if (Object.values(fields).some((field) => field === null)) return null;

  return {
    ...fields,
    total_weight: round2(
      fields.passenger_weight +
        fields.baggage_weight +
        fields.cabin_baggage_weight +
        fields.cargo_weight,
    ),
  };
}

const isValidDay = (year, month, day) => {
  if (day === null || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

function readPeriod(source) {
  const year = readInteger(source.billing_year ?? source.year ?? null);
  const month = parseMonth(source.billing_month ?? source.month ?? null);
  if (year === null || year < 2000 || year > 2100 || month === null) {
    throw fail(400, "billing_year/year dan billing_month/month wajib diisi dengan nilai yang valid.");
  }
  return { year, month };
}

function buildPeriodFilter(query) {
  const conditions = [];
  const params = {};

  if (query.year !== undefined && query.year !== "") {
    const year = readInteger(query.year);
    if (year === null || year < 2000 || year > 2100) throw fail(400, "Tahun tidak valid.");
    conditions.push("billing_year = :year");
    params.year = year;
  }
  if (query.month !== undefined && query.month !== "") {
    const month = parseMonth(query.month);
    if (month === null) {
      throw fail(400, "Bulan tidak valid (gunakan 1-12 atau nama bulan Indonesia).");
    }
    conditions.push("billing_month = :month");
    params.month = month;
  }

  return { where: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "", params };
}

const sequence = (index) => `pada urutan ${index + 1}.`;

function validateLoadRecords(records, { year, month }) {
  if (!Array.isArray(records) || records.length === 0 || records.length > 500) {
    throw fail(400, "Kirim 1 sampai 500 data berat penerbangan.");
  }

  return records.map((record, index) => {
    if (!isPlainObject(record)) {
      throw fail(400, `Format data tidak valid ${sequence(index)}`);
    }

    const day = readInteger(record.flight_day ?? null);
    const passengers = readPassengerTypes(record);
    if (!isValidDay(year, month, day) || passengers === null) {
      throw fail(400, `Tanggal atau jumlah PAX tidak valid ${sequence(index)}`);
    }

    const load = readLoadFields(record);
    if (load === null) {
      throw fail(
        400,
        `Berat harus nol atau lebih dan jumlah koli harus bilangan bulat nol atau lebih ${sequence(index)}`,
      );
    }
    return { year, month, day, ...passengers, ...load };
  });
}

function validateFlights(flights, period) {
  const { year, month } = period;

  return flights.map((flight, index) => {
    if (!isPlainObject(flight)) {
      throw fail(400, `Format data penerbangan tidak valid ${sequence(index)}`);
    }

    const day = readInteger(flight.flight_day ?? flight.date ?? null);
    const route = flight.route ?? null;
    const passengers = readPassengerTypes(flight);
    const basicFare = flight.basic_fare ?? flight.basicFare ?? null;
    const feeTicket = flight.fee_ticket ?? flight.feeTicket ?? null;

    if (!isValidDay(year, month, day)) {
      throw fail(400, `Tanggal penerbangan tidak valid ${sequence(index)}`);
    }
    if (typeof route !== "string" || !ALLOWED_ROUTES.includes(route)) {
      throw fail(400, `Route tidak valid ${sequence(index)}`);
    }
    if (passengers === null) {
      throw fail(400, `PAX harus bilangan bulat nol atau lebih ${sequence(index)}`);
    }
    if (!isNumeric(basicFare) || Number(basicFare) < 0 || !isNumeric(feeTicket) || Number(feeTicket) < 0) {
      throw fail(400, `Basic fare dan fee tiket harus berupa angka nol atau lebih ${sequence(index)}`);
    }

    const load = readLoadFields(flight);
    if (load === null) {
      throw fail(
        400,
        `Berat harus angka nol atau lebih dan jumlah koli harus bilangan bulat nol atau lebih ${sequence(index)}`,
      );
    }

    const note = toText(flight.note ?? "BERJADWAL").trim().slice(0, 255);
    return {
      year,
      month,
      day,
      route,
      ...passengers,
      basic_fare: Number(basicFare),
      fee_ticket: Number(feeTicket),
      note,
      ...load,
    };
  });
}

const LOAD_COLUMNS =
  "id, billing_year, billing_month, flight_day, pax, adult_pax, child_pax, infant_pax, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight";
const FLIGHT_COLUMNS =
  "id, billing_year, billing_month, flight_day, route, pax, adult_pax, child_pax, infant_pax, basic_fare, fee_ticket, note, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight, created_at, updated_at";

const bind = (params) => (Object.keys(params).length > 0 ? params : undefined);

async function readFlights(pool, query, isFinanceUser) {
  const { where, params } = buildPeriodFilter(query);
  const values = bind(params);

  if (query.dataset === "loads") {
    const [loads] = await pool.execute(
      `SELECT ${LOAD_COLUMNS} FROM flight_load_records${where} ORDER BY billing_year DESC, billing_month DESC, flight_day ASC, id ASC`,
      values,
    );
    return { success: true, data: loads };
  }

  const [records] = await pool.execute(
    `SELECT ${FLIGHT_COLUMNS} FROM flight_records${where} ORDER BY billing_year DESC, billing_month DESC, flight_day ASC, id ASC`,
    values,
  );
  const [byRoute] = await pool.execute(
    `SELECT route, COUNT(*) AS total_flights, COALESCE(SUM(pax), 0) AS total_pax, COALESCE(SUM(adult_pax), 0) AS total_adult_pax, COALESCE(SUM(child_pax), 0) AS total_child_pax, COALESCE(SUM(infant_pax), 0) AS total_infant_pax, COALESCE(SUM(pax * fee_ticket), 0) AS total_fee FROM flight_records${where} GROUP BY route ORDER BY route`,
    values,
  );

  const summary = {
    total_flights: 0,
    total_pax: 0,
    total_adult_pax: 0,
    total_child_pax: 0,
    total_infant_pax: 0,
    total_fee: 0,
    by_route: byRoute,
  };
  for (const routeSummary of byRoute) {
    summary.total_flights += Number(routeSummary.total_flights);
    summary.total_pax += Number(routeSummary.total_pax);
    summary.total_adult_pax += Number(routeSummary.total_adult_pax ?? 0);
    summary.total_child_pax += Number(routeSummary.total_child_pax ?? 0);
    summary.total_infant_pax += Number(routeSummary.total_infant_pax ?? 0);
    summary.total_fee += Number(routeSummary.total_fee);
  }

  if (!isFinanceUser) {
    // Data keuangan hanya untuk pengguna yang sudah login Keuangan.
    summary.by_route = byRoute.map(({ total_fee: _fee, ...rest }) => rest);
    delete summary.total_fee;
    return {
      success: true,
      data: records.map(({ basic_fare: _fare, fee_ticket: _feeTicket, ...rest }) => rest),
      summary,
    };
  }

  return { success: true, data: records, summary };
}

async function saveLoads(pool, payload, period) {
  const loads = validateLoadRecords(payload.records ?? null, period);

  await withTransaction(pool, async (connection) => {
    await connection.execute(
      "DELETE FROM flight_load_records WHERE billing_year = :year AND billing_month = :month",
      period,
    );
    for (const load of loads) {
      await connection.execute(
          `INSERT INTO flight_load_records (billing_year, billing_month, flight_day, pax, adult_pax, child_pax, infant_pax, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight)
           VALUES (:year, :month, :day, :pax, :adult_pax, :child_pax, :infant_pax, :passenger_weight, :baggage_pieces, :baggage_weight, :cabin_baggage_pieces, :cabin_baggage_weight, :cargo_pieces, :cargo_weight, :total_weight)`,
        load,
      );
    }
  });

  return {
    success: true,
    message: "Data berat dan bagasi berhasil disimpan tanpa mengubah data keuangan.",
    saved: loads.length,
  };
}

async function saveFlights(pool, payload, period) {
  const replacePeriod = payload.replace_period === true;
  const flights = payload.flights ?? [payload];

  if (!Array.isArray(flights) || flights.length > 500 || (flights.length === 0 && !replacePeriod)) {
    throw fail(
      400,
      "Kirim maksimal 500 data penerbangan. Data kosong hanya boleh untuk mengganti seluruh periode.",
    );
  }

  const validated = validateFlights(flights, period);

  await withTransaction(pool, async (connection) => {
    if (replacePeriod) {
      await connection.execute(
        "DELETE FROM flight_records WHERE billing_year = :year AND billing_month = :month",
        period,
      );
    }
    for (const flight of validated) {
      await connection.execute(
        `INSERT INTO flight_records (billing_year, billing_month, flight_day, route, pax, adult_pax, child_pax, infant_pax, basic_fare, fee_ticket, note, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight)
         VALUES (:year, :month, :day, :route, :pax, :adult_pax, :child_pax, :infant_pax, :basic_fare, :fee_ticket, :note, :passenger_weight, :baggage_pieces, :baggage_weight, :cabin_baggage_pieces, :cabin_baggage_weight, :cargo_pieces, :cargo_weight, :total_weight)`,
        flight,
      );
    }
  });

  return { success: true, message: "Data penerbangan berhasil disimpan.", inserted: validated.length };
}

function corsMiddleware(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin ?? "";
    if (allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
    }
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  };
}

export function flightsRouter({ pool, auth, corsOrigins }) {
  const router = Router();
  router.use(corsMiddleware(corsOrigins));
  router.use(express.json({ limit: "2mb", type: () => true }));

  router.get(
    "/",
    wrap(async (req, res) => {
      res.json(await readFlights(pool, req.query, auth.isAuthenticated(req)));
    }),
  );

  router.post(
    "/",
    wrap(async (req, res) => {
      if (!isPlainObject(req.body)) throw fail(400, "Body harus berupa JSON yang valid.");

      const period = readPeriod(req.body);
      const result =
        req.body.dataset === "loads"
          ? await saveLoads(pool, req.body, period)
          : await saveFlights(pool, req.body, period);
      res.status(201).json(result);
    }),
  );

  router.use((req, res) => {
    res.set("Allow", "GET, POST, OPTIONS");
    res.status(405).json({ success: false, message: "Method tidak didukung." });
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, message: "Body harus berupa JSON yang valid." });
    }

    console.error(error);
    res.status(500).json({
      success: false,
      message: "Kesalahan server/database. Periksa koneksi MySQL dan log server.",
      error_code: String(error.errno ?? error.code ?? "INTERNAL_ERROR"),
    });
  });

  return router;
}
