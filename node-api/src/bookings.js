import express, { Router } from "express";
import { withTransaction } from "./db.js";
import {
  addDays,
  flightDayName,
  formatDate,
  isoWeekday,
  lastDayOfMonth,
  parseCalendarDate,
  todayInMakassar,
} from "./dates.js";
import {
  HttpError,
  InvalidInput,
  readInteger,
  requireJsonObject,
  toText,
  wrap,
} from "./http.js";

export const BOOKING_LIMIT = 12;
export const FLIGHT_DAYS = [1, 3, 6];
export const ROUTES = ["MNA-IAX", "MNA-MDC"];
export const STATUSES = ["Menunggu verifikasi", "Booked", "Dibayar"];
// Kapasitas yang ditampilkan pada rekomendasi jadwal alternatif.
const ALTERNATIVE_CAPACITY = 10;

const BOOKING_COLUMNS =
  "id, passenger_name, phone, passenger_type, booking_no, route_code, travel_date, status, booking_source, booking_at";

const VALID_PASSENGER_TYPES = ["adult", "child", "infant"];
const VALID_BOOKING_SOURCES = ["n8n", "web"];

export function bookingForApi(row) {
  const bookingAt = String(row.booking_at).replaceAll(" ", "T");

  return {
    id: Number(row.id),
    name: row.passenger_name,
    phone: row.phone,
    type: row.passenger_type || "adult",
    bookingNo: Number(row.booking_no),
    route: row.route_code,
    date: String(row.travel_date),
    status: row.status,
    source: row.booking_source === "n8n" ? "n8n" : "web",
    createdAt: bookingAt.slice(0, 10),
    bookingDate: bookingAt.slice(0, 10),
    bookingAt,
  };
}

export function validateRouteAndDate(route, date, today = todayInMakassar()) {
  if (!ROUTES.includes(route))
    throw new InvalidInput("Rute penerbangan tidak valid.");

  const parsed = parseCalendarDate(date);
  if (!parsed) throw new InvalidInput("Tanggal tidak valid.");

  const todayText = formatDate(today);
  if (date < todayText)
    throw new InvalidInput("Tanggal penerbangan sudah lewat.");
  const currentMonth = todayText.slice(0, 7);
  const nextMonth = formatDate(addDays(lastDayOfMonth(today), 1)).slice(0, 7);
  if (![currentMonth, nextMonth].includes(date.slice(0, 7))) {
    throw new InvalidInput(
      "Pemesanan hanya tersedia untuk bulan ini dan bulan berikutnya.",
    );
  }
  if (!FLIGHT_DAYS.includes(isoWeekday(parsed))) {
    throw new InvalidInput(
      "Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.",
    );
  }
}

export function extractPassengers(body) {
  let source = body.passengers ?? null;
  if (source === null && body.name !== undefined && body.name !== null) {
    source = [
      { name: body.name, phone: body.phone ?? "", type: body.type ?? "adult" },
    ];
  }

  if (!Array.isArray(source) || source.length === 0) {
    throw new InvalidInput("Isi minimal satu data penumpang.");
  }

  const passengers = source.map((passenger) => {
    let name;
    let phone;
    let type;
    if (typeof passenger === "string") {
      name = passenger.trim();
      phone = toText(body.phone).trim();
      type = body.type ?? "adult";
    } else if (
      passenger !== null &&
      typeof passenger === "object" &&
      !Array.isArray(passenger)
    ) {
      name = toText(passenger.name ?? passenger.passenger_name ?? "").trim();
      phone = toText(passenger.phone ?? body.phone ?? "").trim();
      type = toText(passenger.type ?? "adult")
        .trim()
        .toLowerCase();
    } else {
      throw new InvalidInput("Data penumpang tidak valid.");
    }

    if (name === "" || phone === "") {
      throw new InvalidInput(
        "Nama dan nomor WhatsApp setiap penumpang wajib diisi.",
      );
    }

    if (!VALID_PASSENGER_TYPES.includes(type)) {
      throw new InvalidInput(
        `Tipe penumpang hanya boleh: ${VALID_PASSENGER_TYPES.join(", ")}.`,
      );
    }

    return { name, phone, type };
  });

  const seatedPassengersCount = passengers.filter(
    (passenger) => passenger.type !== "infant",
  ).length;
  if (
    seatedPassengersCount > BOOKING_LIMIT ||
    passengers.length > BOOKING_LIMIT * 2
  ) {
    throw new InvalidInput(
      `Jumlah penumpang melebihi kapasitas maksimum ${BOOKING_LIMIT}.`,
    );
  }
  return passengers;
}

function passengerNamesToCheck(body) {
  let source = body.passengers ?? null;
  if (source === null && body.name !== undefined && body.name !== null)
    source = [body.name];

  if (!Array.isArray(source) || source.length === 0) {
    throw new InvalidInput(
      "Nama penumpang wajib diisi untuk pemeriksaan booking.",
    );
  }

  return source.map((passenger) => {
    let name;
    if (typeof passenger === "string") {
      name = passenger.trim();
    } else if (
      passenger !== null &&
      typeof passenger === "object" &&
      !Array.isArray(passenger)
    ) {
      name = toText(passenger.name ?? passenger.passenger_name ?? "").trim();
    } else {
      throw new InvalidInput("Format data penumpang tidak valid.");
    }
    if (name === "")
      throw new InvalidInput("Nama penumpang tidak boleh kosong.");
    return name;
  });
}

async function fetchBooking(db, id) {
  const [rows] = await db.execute(
    `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = :id`,
    { id },
  );
  return rows.length === 0 ? null : bookingForApi(rows[0]);
}

const freeNumbers = (usedNumbers) =>
  Array.from({ length: BOOKING_LIMIT }, (_, index) => index + 1).filter(
    (number) => !usedNumbers.includes(number),
  );

async function allocateScheduleNumbers(
  connection,
  route,
  date,
  excludeId = null,
) {
  const [usedRows] =
    excludeId === null
      ? await connection.execute(
          `SELECT booking_no, id, passenger_type FROM bookings
           WHERE route_code = :route AND travel_date = :date FOR UPDATE`,
          { route, date },
        )
      : await connection.execute(
          `SELECT booking_no, id, passenger_type FROM bookings
           WHERE route_code = :route AND travel_date = :date AND id <> :id FOR UPDATE`,
          { route, date, id: excludeId },
        );

  const allUsed = new Set(usedRows.map((row) => Number(row.booking_no)));
  const takeNextInfantNo = () => {
    let candidate = BOOKING_LIMIT + 1;
    while (allUsed.has(candidate)) candidate += 1;
    allUsed.add(candidate);
    return candidate;
  };

  // Bebaskan nomor kursi 1..12 jika sebelumnya sempat ditempati oleh penumpang infant.
  for (const row of usedRows) {
    const no = Number(row.booking_no);
    if (
      row.passenger_type === "infant" &&
      row.id !== undefined &&
      no >= 1 &&
      no <= BOOKING_LIMIT
    ) {
      const nextNo = takeNextInfantNo();
      allUsed.delete(no);
      row.booking_no = nextNo;
      await connection.execute(
        `UPDATE bookings SET booking_no = :bookingNo WHERE id = :id`,
        { bookingNo: nextNo, id: Number(row.id) },
      );
    }
  }

  const seatedUsed = usedRows
    .filter((row) => (row.passenger_type || "adult") !== "infant")
    .map((row) => Number(row.booking_no));

  return {
    availableSeats: freeNumbers(seatedUsed),
    takeNextInfantNo,
  };
}

export async function findAlternativeFlights(
  db,
  route,
  requestedDate,
  today = todayInMakassar(),
) {
  const requested = parseCalendarDate(requestedDate);
  const firstDayOfNextMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
  );
  const endDate = new Date(
    Date.UTC(
      firstDayOfNextMonth.getUTCFullYear(),
      firstDayOfNextMonth.getUTCMonth(),
      9,
    ),
  );
  if (today > endDate) return [];
  const startDate = addDays(today, -1);

  const [rows] = await db.execute(
    `SELECT travel_date, COUNT(DISTINCT booking_no) AS booked
     FROM bookings
     WHERE route_code = :route AND travel_date > :start AND travel_date <= :end
       AND passenger_type != 'infant'
     GROUP BY travel_date`,
    { route, start: formatDate(startDate), end: formatDate(endDate) },
  );
  const bookedByDate = new Map(
    rows.map((row) => [String(row.travel_date), Number(row.booked)]),
  );

  const alternatives = [];
  for (
    let cursor = today;
    cursor <= endDate;
    cursor = addDays(cursor, 1)
  ) {
    if (!FLIGHT_DAYS.includes(isoWeekday(cursor))) continue;

    const date = formatDate(cursor);
    if (requested && date === formatDate(requested)) continue;
    const booked = bookedByDate.get(date) ?? 0;
    const available = Math.max(0, ALTERNATIVE_CAPACITY - booked);
    if (available > 0) {
      alternatives.push({
        date,
        day: flightDayName(cursor),
        capacity: ALTERNATIVE_CAPACITY,
        booked,
        available,
        availableSeats: available,
      });
    }
  }
  return alternatives;
}

async function notifyBooked(webhookUrl, booking) {
  if (!webhookUrl || webhookUrl === "off") return;

  const payload = {
    id: booking.id,
    name: booking.name,
    phone: booking.phone,
    bookingNo: booking.bookingNo,
    route: booking.route,
    date: booking.date,
    status: booking.status,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`Booking webhook: HTTP ${response.status}`);
  } catch (error) {
    console.error(`Booking webhook gagal: ${error.message}`);
  }
}

async function listOrCheckAvailability(db, query, today) {
  if (query.route === undefined && query.date === undefined) {
    const [rows] = await db.query(
      `SELECT ${BOOKING_COLUMNS} FROM bookings ORDER BY booking_at DESC, id DESC`,
    );
    return { status: 200, body: rows.map(bookingForApi) };
  }

  const route = toText(query.route);
  const date = toText(query.date);

  if (!ROUTES.includes(route)) {
    throw new HttpError(400, {
      success: false,
      status: "invalid_route",
      error: "Rute penerbangan tidak valid.",
    });
  }

  const parsed = parseCalendarDate(date);
  if (!parsed) {
    throw new HttpError(400, {
      success: false,
      status: "invalid_date",
      error: "Format tanggal harus YYYY-MM-DD.",
    });
  }

  const day = flightDayName(parsed);
  const alternatives = await findAlternativeFlights(db, route, date, today);

  if (!FLIGHT_DAYS.includes(isoWeekday(parsed))) {
    return {
      status: 200,
      body: {
        success: true,
        status: "no_schedule",
        route,
        date,
        day,
        message: "Tidak ada jadwal penerbangan pada tanggal tersebut.",
        alternatives,
      },
    };
  }

  const [rows] = await db.execute(
    `SELECT COUNT(DISTINCT booking_no) AS booked
     FROM bookings 
     WHERE route_code = :route AND travel_date = :date
       AND passenger_type != 'infant'`,
    { route, date },
  );
  const booked = Number(rows[0].booked);
  const available = Math.max(BOOKING_LIMIT - booked, 0);

  return {
    status: 200,
    body: {
      success: true,
      status: available > 0 ? "available" : "full",
      route,
      date,
      day,
      capacity: BOOKING_LIMIT,
      booked,
      availableSeats: available,
      available,
      alternatives,
    },
  };
}

async function checkBooking(db, body, route, date) {
  const duplicates = [];
  const checked = new Set();

  for (const name of passengerNamesToCheck(body)) {
    const normalized = name.toLowerCase();
    if (checked.has(normalized)) continue;
    checked.add(normalized);

    const [rows] = await db.execute(
      `SELECT id, passenger_name, booking_no, status FROM bookings
       WHERE route_code = :route AND travel_date = :date
         AND LOWER(TRIM(passenger_name)) = LOWER(TRIM(:name))
       LIMIT 1`,
      { route, date, name },
    );
    if (rows.length > 0) {
      duplicates.push({
        name: rows[0].passenger_name,
        bookingNo: Number(rows[0].booking_no),
        status: rows[0].status,
      });
    }
  }

  // Get seat occupancy info (excluding infant)
  const [seatRows] = await db.execute(
    `SELECT COUNT(DISTINCT booking_no) AS occupiedSeats,
            SUM(CASE WHEN passenger_type = 'infant' THEN 1 ELSE 0 END) AS infantCount
     FROM bookings
     WHERE route_code = :route AND travel_date = :date
       AND passenger_type != 'infant'`,
    { route, date },
  );
  const occupiedSeats = Number(seatRows[0]?.occupiedSeats ?? 0);
  const infantCount = Number(seatRows[0]?.infantCount ?? 0);
  const availableSeats = Math.max(BOOKING_LIMIT - occupiedSeats, 0);

  const isDuplicate = duplicates.length > 0;
  return {
    status: 200,
    body: {
      success: true,
      status: isDuplicate ? "duplicate_booking" : "not_duplicate",
      duplicate: isDuplicate,
      route,
      date,
      duplicates,
      capacity: BOOKING_LIMIT,
      occupiedSeats,
      availableSeats,
      infantCount,
      message: isDuplicate
        ? "Penumpang sudah terdaftar pada rute dan tanggal tersebut."
        : "Penumpang belum terdaftar.",
    },
  };
}

const duplicateResponse = (message) =>
  new HttpError(409, {
    success: false,
    status: "duplicate_booking",
    duplicate: true,
    message,
  });

async function createBookings(pool, passengers, route, date, source = "n8n") {
  const created = await withTransaction(pool, async (connection) => {
    const seenNames = new Set();

    for (const { name } of passengers) {
      const normalized = name.toLowerCase();
      if (seenNames.has(normalized)) {
        throw duplicateResponse(
          "Nama penumpang yang sama terdapat lebih dari satu kali dalam pemesanan.",
        );
      }
      seenNames.add(normalized);

      const [existing] = await connection.execute(
        `SELECT id FROM bookings
         WHERE route_code = :route AND travel_date = :date
           AND LOWER(TRIM(passenger_name)) = LOWER(TRIM(:name))
         LIMIT 1 FOR UPDATE`,
        { route, date, name },
      );
      if (existing.length > 0) {
        throw duplicateResponse(
          `Penumpang ${name} sudah terdaftar pada rute dan tanggal tersebut.`,
        );
      }
    }

    const { availableSeats, takeNextInfantNo } = await allocateScheduleNumbers(
      connection,
      route,
      date,
    );
    const seatedNeeded = passengers.filter(
      (passenger) => passenger.type !== "infant",
    ).length;
    if (seatedNeeded > availableSeats.length) {
      throw new HttpError(409, {
        success: false,
        error: "Kapasitas pemesanan untuk jadwal ini tidak mencukupi.",
      });
    }

    let seatCursor = 0;
    const bookings = [];
    for (const passenger of passengers) {
      const assignedNo =
        passenger.type === "infant"
          ? takeNextInfantNo()
          : availableSeats[seatCursor++];
      const [result] = await connection.execute(
        `INSERT INTO bookings
           (passenger_name, phone, passenger_type, booking_no, route_code, travel_date, status, booking_source, booking_at)
         VALUES (:name, :phone, :type, :bookingNo, :route, :date, :status, :source, CURRENT_TIMESTAMP)`,
        {
          name: passenger.name,
          phone: passenger.phone,
          type: passenger.type,
          bookingNo: assignedNo,
          route,
          date,
          status: STATUSES[1],
          source,
        },
      );
      bookings.push(await fetchBooking(connection, Number(result.insertId)));
    }
    return bookings;
  });

  return { status: 201, body: created };
}

async function updateBooking(pool, id, body, webhookUrl) {
  const { before, after } = await withTransaction(pool, async (connection) => {
    const [rows] = await connection.execute(
      `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = :id FOR UPDATE`,
      { id },
    );
    if (rows.length === 0)
      throw new HttpError(404, { error: "Pemesanan tidak ditemukan." });

    const current = bookingForApi(rows[0]);
    const has = (key) => Object.hasOwn(body, key);
    let { name, phone, type, route, date, bookingNo, status, source } = current;

    if (has("name")) {
      name = toText(body.name).trim();
      if (name === "") throw new InvalidInput("Nama penumpang wajib diisi.");
    }
    if (has("phone")) {
      phone = toText(body.phone).trim();
      if (phone === "") throw new InvalidInput("Nomor WhatsApp wajib diisi.");
    }
    if (has("type")) {
      type = toText(body.type).trim().toLowerCase();
      if (!VALID_PASSENGER_TYPES.includes(type))
        throw new InvalidInput(
          `Tipe penumpang hanya boleh: ${VALID_PASSENGER_TYPES.join(", ")}.`,
        );
    }
    if (has("route")) {
      route = toText(body.route);
      if (!ROUTES.includes(route))
        throw new InvalidInput("Rute penerbangan tidak valid.");
    }
    if (has("date")) {
      date = toText(body.date).trim();
      const parsed = parseCalendarDate(date);
      if (!parsed) throw new InvalidInput("Tanggal tidak valid.");
      if (!FLIGHT_DAYS.includes(isoWeekday(parsed))) {
        throw new InvalidInput(
          "Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.",
        );
      }
    }
    if (has("status")) {
      status = toText(body.status);
      if (!STATUSES.includes(status))
        throw new InvalidInput("Status pemesanan tidak valid.");
    }
    if (has("source")) {
      source = toText(body.source).trim().toLowerCase();
      if (!VALID_BOOKING_SOURCES.includes(source)) {
        throw new InvalidInput(
          `Sumber pemesanan hanya boleh: ${VALID_BOOKING_SOURCES.join(", ")}.`,
        );
      }
    }
    if (
      !["name", "phone", "type", "route", "date", "status", "source"].some(has)
    ) {
      throw new InvalidInput("Tidak ada perubahan data pemesanan.");
    }

    const scheduleChanged = route !== current.route || date !== current.date;
    const seatTypeChanged =
      type !== current.type &&
      (type === "infant" || current.type === "infant");

    if (scheduleChanged || seatTypeChanged) {
      const { availableSeats, takeNextInfantNo } =
        await allocateScheduleNumbers(connection, route, date, id);
      if (type === "infant") {
        if (bookingNo <= BOOKING_LIMIT || scheduleChanged) {
          bookingNo = takeNextInfantNo();
        }
      } else {
        if (availableSeats.length === 0) {
          throw new HttpError(409, {
            error: "Kapasitas pada rute dan tanggal tujuan sudah penuh.",
          });
        }
        if (
          bookingNo < 1 ||
          bookingNo > BOOKING_LIMIT ||
          !availableSeats.includes(bookingNo)
        ) {
          bookingNo = availableSeats[0];
        }
      }
    }

    await connection.execute(
      `UPDATE bookings
       SET passenger_name = :name, phone = :phone, passenger_type = :type, 
           route_code = :route, travel_date = :date, booking_no = :bookingNo,
           status = :status, booking_source = :source
       WHERE id = :id`,
      { name, phone, type, route, date, bookingNo, status, source, id },
    );

    return { before: current, after: await fetchBooking(connection, id) };
  });

  if (!after) throw new HttpError(404, { error: "Pemesanan tidak ditemukan." });

  // Webhook hanya dikirim saat status berubah menjadi Booked dan tidak menahan respons.
  if (before.status !== "Booked" && after.status === "Booked") {
    void notifyBooked(webhookUrl, after);
  }
  return { status: 200, body: after };
}

export function bookingsRouter({
  pool,
  bookingWebhookUrl,
  now = () => new Date(),
}) {
  const router = Router();
  const sseClients = new Set();

  function broadcastBookingCreated(payload) {
    if (sseClients.size === 0) return;
    const message = `event: booking_created\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  router.get("/stream", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write(`event: connected\ndata: {"status":"ok"}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);
    heartbeat.unref?.();

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  router.use(express.json({ limit: "1mb", type: () => true }));

  const send = (res, { status, body }) => res.status(status).json(body);
  const requireId = (req) => {
    const id = readInteger(req.query.id);
    if (id === null || id < 1)
      throw new InvalidInput("ID pemesanan tidak valid.");
    return id;
  };

  router.get(
    "/",
    wrap(async (req, res) =>
      send(
        res,
        await listOrCheckAvailability(pool, req.query, todayInMakassar(now())),
      ),
    ),
  );

  router.post(
    "/",
    wrap(async (req, res) => {
      const body = requireJsonObject(req);
      const action = toText(body.action ?? "create_booking")
        .trim()
        .toLowerCase();
      const route = toText(body.route);
      const date = toText(body.date);

      validateRouteAndDate(route, date, todayInMakassar(now()));

      if (action === "check_booking")
        return send(res, await checkBooking(pool, body, route, date));
      if (!["create_booking", "booking"].includes(action)) {
        throw new InvalidInput("Action tidak dikenal.");
      }
      const source =
        toText(body.source ?? "").trim().toLowerCase() === "web"
          ? "web"
          : "n8n";
      const result = await createBookings(
        pool,
        extractPassengers(body),
        route,
        date,
        source,
      );
      broadcastBookingCreated({
        source,
        route,
        date,
        bookings: result.body,
        createdAt: now().toISOString(),
      });
      send(res, result);
    }),
  );

  router.patch(
    "/",
    wrap(async (req, res) => {
      const id = requireId(req);
      send(
        res,
        await updateBooking(
          pool,
          id,
          requireJsonObject(req),
          bookingWebhookUrl,
        ),
      );
    }),
  );

  router.delete(
    "/",
    wrap(async (req, res) => {
      const id = requireId(req);
      const [result] = await pool.execute(
        "DELETE FROM bookings WHERE id = :id",
        { id },
      );
      if (result.affectedRows === 0) {
        throw new HttpError(404, { error: "Pemesanan tidak ditemukan." });
      }
      res.status(204).end();
    }),
  );

  router.use((req, res) => {
    res.set("Allow", "GET, POST, PATCH, DELETE");
    res.status(405).json({ error: "Metode permintaan tidak didukung." });
  });

  return router;
}
