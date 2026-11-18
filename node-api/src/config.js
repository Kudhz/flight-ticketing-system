import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(apiRoot, "..");

// Variabel yang sudah ada di environment tidak ditimpa oleh file .env.
for (const envPath of [path.join(apiRoot, ".env"), path.join(projectRoot, ".env")]) {
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

const env = process.env;
const text = (key, fallback) => (env[key] !== undefined && env[key] !== "" ? env[key] : fallback);

export function loadConfig() {
  return {
    port: Number(text("PORT", "3001")),
    host: text("HOST", "127.0.0.1"),
    finance: {
      username: text("FINANCE_USERNAME", ""),
      password: text("FINANCE_PASSWORD", ""),
      sessionSecret: text("SESSION_SECRET", ""),
    },
    bookingsDb: {
      host: text("BOOKINGS_DB_HOST", "127.0.0.1"),
      port: Number(text("BOOKINGS_DB_PORT", "3306")),
      database: text("BOOKINGS_DB_NAME", "ticketing_db"),
      user: text("BOOKINGS_DB_USER", "root"),
      password: text("BOOKINGS_DB_PASSWORD", ""),
    },
    flightsDb: {
      host: text("FLIGHTS_DB_HOST", "127.0.0.1"),
      port: Number(text("FLIGHTS_DB_PORT", "43306")),
      database: text("FLIGHTS_DB_NAME", "db-jmt"),
      user: text("FLIGHTS_DB_USER", "DB-JMT"),
      password: text("FLIGHTS_DB_PASSWORD", ""),
    },
    corsOrigins: text(
      "CORS_ORIGINS",
      [
        "http://192.168.111.177:8892",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8892",
        "http://127.0.0.1:8892",
      ].join(","),
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    bookingWebhookUrl: text(
      "BOOKING_WEBHOOK_URL",
      "http://192.168.111.177:5678/webhook/booking-status",
    ),
    pdfDirectory: text("PDF_DIR", path.join(projectRoot, "flight-pdf")),
  };
}
