import express from "express";
import { createFinanceAuth, financeRouter } from "./auth.js";
import { bookingsRouter } from "./bookings.js";
import { flightsRouter } from "./flights.js";
import { HttpError, InvalidInput } from "./http.js";
import { flightPdfRouter } from "./pdf.js";

export function createApp({ config, bookingsPool, flightsPool, now = () => new Date() }) {
  const app = express();
  app.disable("x-powered-by");

  const auth = createFinanceAuth(config.finance);

  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.use("/api/finance", financeRouter(auth));
  app.use("/api/flight-pdf", flightPdfRouter({ directory: config.pdfDirectory }));
  app.use(
    "/api/bookings",
    bookingsRouter({ pool: bookingsPool, bookingWebhookUrl: config.bookingWebhookUrl, now }),
  );
  app.use(
    "/api/flights",
    flightsRouter({ pool: flightsPool, auth, corsOrigins: config.corsOrigins }),
  );

  app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json(error.body);
    if (error instanceof InvalidInput) return res.status(400).json({ error: error.message });
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Format JSON tidak valid." });
    }
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "Ukuran PDF melebihi batas 10 MB." });
    }

    console.error(error);
    res.status(500).json({
      error: "Terjadi kesalahan pada server. Periksa konfigurasi dan log server.",
    });
  });

  return app;
}
