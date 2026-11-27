import fs from "node:fs/promises";
import path from "node:path";
import express, { Router } from "express";
import { HttpError, wrap } from "./http.js";

const SETTINGS_PATH = path.join(process.cwd(), "src", "settings.json");

const DEFAULT_TARIFFS = {
  "MNA-MDC": { basic_fare: 483000, fee_ticket: 24150 },
  "MNA-IAX": { basic_fare: 380000, fee_ticket: 19000 },
  "MDC-MNA": { basic_fare: 0, fee_ticket: 0 },
  "IAX-MNA": { basic_fare: 0, fee_ticket: 0 },
  ground_handling_per_flight: 30000,
};

async function readTariffs() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const saved = JSON.parse(raw);
    if (!isPlainObject(saved)) return { ...DEFAULT_TARIFFS };
    return { ...DEFAULT_TARIFFS, ...saved };
  } catch {
    return { ...DEFAULT_TARIFFS };
  }
}

async function writeTariffs(tariffs) {
  if (!isPlainObject(tariffs)) {
    throw new HttpError(400, { success: false, message: "Body harus berupa objek JSON." });
  }
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(tariffs, null, 2), "utf8");
  return tariffs;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function settingsRouter() {
  const router = Router();
  router.use(express.json({ limit: "16kb", type: () => true }));

  router.get(
    "/tariffs",
    wrap(async (req, res) => {
      res.json(await readTariffs());
    }),
  );

  router.put(
    "/tariffs",
    wrap(async (req, res) => {
      const result = await writeTariffs(req.body);
      res.json({ success: true, message: "Tarif berhasil diperbarui.", tariffs: result });
    }),
  );

  router.use((req, res) => {
    res.set("Allow", "GET, PUT, OPTIONS");
    res.status(405).json({ success: false, message: "Method tidak didukung." });
  });

  return router;
}
