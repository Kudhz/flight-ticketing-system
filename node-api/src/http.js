export class HttpError extends Error {
  constructor(status, body) {
    super(body?.error ?? body?.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Kesalahan input pengguna; dijawab 400 dengan pesan yang sama seperti API PHP.
export class InvalidInput extends Error {}

export const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function requireJsonObject(req) {
  if (!isPlainObject(req.body)) {
    throw new InvalidInput("Isi permintaan harus berupa objek JSON.");
  }
  return req.body;
}

export const toText = (value) => (value === undefined || value === null ? "" : String(value));

export function readInteger(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  if (typeof value === "string" && /^[+-]?(0|[1-9]\d*)$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

// Setara is_numeric() di PHP untuk angka dan string numerik desimal.
export function isNumeric(value) {
  if (typeof value === "number") return Number.isFinite(value);
  return (
    typeof value === "string" &&
    /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(value) &&
    Number.isFinite(Number(value))
  );
}
