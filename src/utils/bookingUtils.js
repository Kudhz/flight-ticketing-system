import { BOOKINGS_ENDPOINT, FINANCE_AUTH_ENDPOINT } from "../apiConfig";

export const BOOKING_LIMIT = 12;
export const BOOKING_NUMBERS = Array.from(
  { length: BOOKING_LIMIT },
  (_, index) => index + 1,
);
export const isOccupiedSeat = (booking) => booking.type !== "infant";
export const isN8nBooking = (booking) => booking?.source === "n8n";
export const STATUSES = ["Menunggu verifikasi", "Booked", "Dibayar"];
export const ROUTES = [
  {
    value: "MNA-IAX",
    origin: "Melonguane",
    originCode: "MNA",
    destination: "Miangas",
    destinationCode: "IAX",
    label: "Melonguane (MNA) - Miangas (IAX)",
  },
  {
    value: "MNA-MDC",
    origin: "Melonguane",
    originCode: "MNA",
    destination: "Manado",
    destinationCode: "MDC",
    label: "Melonguane (MNA) - Manado (MDC)",
  },
];
export const DEFAULT_ROUTE = "MNA-MDC";
export const FLIGHT_DAYS = new Set([1, 3, 6]);

export const localDateISO = (date = new Date()) => {
  const today = date;
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isFlightDate = (date) =>
  FLIGHT_DAYS.has(new Date(`${date}T00:00:00`).getDay());

export const firstFlightDateInMonth = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  while (
    date.getMonth() === monthNumber - 1 &&
    !FLIGHT_DAYS.has(date.getDay())
  ) {
    date.setDate(date.getDate() + 1);
  }
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
};

export const nearestFlightDateInMonth = (month) => {
  const today = localDateISO();
  const anchor = today.startsWith(`${month}-`) ? today : `${month}-01`;
  const anchorDate = new Date(`${anchor}T00:00:00`);

  for (let distance = 0; distance <= 3; distance += 1) {
    const offsets = distance === 0 ? [0] : [distance, -distance];
    for (const offset of offsets) {
      const candidate = new Date(anchorDate);
      candidate.setDate(anchorDate.getDate() + offset);
      if (
        localDateISO(candidate).startsWith(`${month}-`) &&
        FLIGHT_DAYS.has(candidate.getDay())
      ) {
        return localDateISO(candidate);
      }
    }
  }

  return firstFlightDateInMonth(month);
};

export const DEFAULT_DATE = nearestFlightDateInMonth(localDateISO().slice(0, 7));

export const flightDatesInMonth = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  }).filter(isFlightDate);
};

export const timeLabel = (timestamp) =>
  timestamp
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp))
    : "Waktu tidak tercatat";

export const normalizePassengerName = (name) =>
  String(name || "")
    .trim()
    .toLocaleUpperCase("id-ID");

export const isBookingCheckedIn = (booking, overrides = {}) => {
  if (booking && overrides && Object.hasOwn(overrides, booking.id)) {
    return Boolean(overrides[booking.id]);
  }
  return Boolean(booking?.checkedIn);
};

export const FINANCE_PAGES = new Set(["flightDashboard", "flightIncome"]);

export const apiRequest = async (path, options = {}) => {
  const headers = { ...options.headers };
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  }
  return result;
};

export const financeAuthUrl = (action) => `${FINANCE_AUTH_ENDPOINT}/${action}`;

export const bookingsFromApiResponse = (result) => {
  const bookings = [
    result,
    result?.bookings,
    result?.data,
    result?.data?.bookings,
  ].find(Array.isArray);
  const bookingList = bookings || (result?.id !== undefined ? [result] : null);

  if (
    !bookingList ||
    bookingList.some(
      (booking) =>
        !booking || typeof booking !== "object" || booking.id === undefined,
    )
  ) {
    throw new Error(
      "Format respons API tidak memuat daftar pemesanan yang valid.",
    );
  }

  return bookingList;
};

export const fetchBookings = async () => {
  const result = await apiRequest(BOOKINGS_ENDPOINT);
  return bookingsFromApiResponse(result);
};

export const dateLabel = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

export const weekdayName = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
  }).format(new Date(`${date}T00:00:00`));

export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Nada chime kabin pesawat (2 nada: E5 -> G#5)
    const notes = [
      { freq: 659.25, start: 0, duration: 0.18 },
      { freq: 830.61, start: 0.16, duration: 0.32 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
  } catch {
    // Abaikan jika browser memblokir autoplay audio sebelum interaksi user
  }
};

export const createBookingNotifications = (newBookings, source = "n8n") => {
  const groups = new Map();

  newBookings.forEach((booking) => {
    const key = `${booking.route}|${booking.date}|${booking.phone || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `notif-${booking.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source,
        route: booking.route,
        date: booking.date,
        phone: booking.phone || "-",
        createdAt: booking.bookingAt || new Date().toISOString(),
        read: false,
        passengers: [],
      });
    }
    groups.get(key).passengers.push({
      id: booking.id,
      name: booking.name,
      type: booking.type || "adult",
      bookingNo: booking.bookingNo,
      status: booking.status,
    });
  });

  return Array.from(groups.values());
};

export const triggerBrowserNotification = (notification) => {
  try {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      window.Notification.permission !== "granted"
    ) {
      return;
    }

    const paxNames = notification.passengers
      .map((p) => `${p.name} (#${String(p.bookingNo).padStart(2, "0")})`)
      .join(", ");
    const title = `Pesanan Baru WA Otomatis • ${notification.route}`;
    const body = `${notification.passengers.length} PAX: ${paxNames}\nJadwal: ${weekdayName(notification.date)}, ${dateLabel(notification.date)}`;

    new window.Notification(title, {
      body,
      icon: "/favicon.svg",
      tag: notification.id,
    });
  } catch {
    // Abaikan jika browser tidak mendukung Notification constructor
  }
};
