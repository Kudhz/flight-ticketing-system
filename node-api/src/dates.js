const TIME_ZONE = "Asia/Makassar";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = { 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 7: "Minggu" };

// Tanggal kalender direpresentasikan sebagai Date UTC tengah malam agar bebas dari zona waktu server.
export function parseCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return valid ? date : null;
}

export const formatDate = (date) => date.toISOString().slice(0, 10);

export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

export const lastDayOfMonth = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

// Nomor hari ISO: Senin = 1 ... Minggu = 7.
export const isoWeekday = (date) => date.getUTCDay() || 7;

export const flightDayName = (date) => DAY_NAMES[isoWeekday(date)];

export function todayInMakassar(now = new Date()) {
  const text = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return parseCalendarDate(text);
}
