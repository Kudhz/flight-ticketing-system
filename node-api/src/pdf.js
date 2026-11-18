import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import express, { Router } from "express";
import { HttpError, readInteger, wrap } from "./http.js";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MONTH_NAMES = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
];
const tooLarge = () => new HttpError(413, { error: "Ukuran PDF melebihi batas 10 MB." });

export function flightPdfRouter({ directory }) {
  const router = Router();

  router.post(
    "/",
    (req, res, next) => {
      const contentType = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/pdf") {
        return next(new HttpError(415, { error: "Konten harus berupa PDF." }));
      }
      if (Number(req.headers["content-length"]) > MAX_PDF_BYTES) return next(tooLarge());
      next();
    },
    express.raw({ type: "application/pdf", limit: MAX_PDF_BYTES }),
    wrap(async (req, res) => {
      const pdf = req.body;
      if (!Buffer.isBuffer(pdf) || !pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        throw new HttpError(400, { error: "Isi file bukan PDF yang valid." });
      }

      const year = readInteger(req.query.year);
      const month = readInteger(req.query.month);
      if (year === null || year < 2024 || year > 2100 || month === null || month < 1 || month > 12) {
        throw new HttpError(400, { error: "Bulan atau tahun laporan tidak valid." });
      }

      const fileName = `data-flight-${MONTH_NAMES[month - 1]}-${year}.pdf`;
      const temporaryPath = path.join(directory, `.flight-pdf-${process.pid}-${Date.now()}.tmp`);

      await mkdir(directory, { recursive: true });
      try {
        await writeFile(temporaryPath, pdf);
        await rename(temporaryPath, path.join(directory, fileName));
      } finally {
        await rm(temporaryPath, { force: true });
      }

      res.status(201).json({ success: true, filename: fileName });
    }),
  );

  router.use((req, res) => {
    res.set("Allow", "POST");
    res.status(405).json({ error: "Method tidak didukung." });
  });

  return router;
}
