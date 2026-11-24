import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";

const config = loadConfig();
const bookingsPool = createPool(config.bookingsDb);
const flightsPool = createPool(config.flightsDb);
const app = createApp({ config, bookingsPool, flightsPool });

if (!config.finance.username || !config.finance.password) {
  console.warn("FINANCE_USERNAME/FINANCE_PASSWORD belum diisi; login Keuangan dinonaktifkan.");
}

const server = app.listen(config.port, config.host, () => {
  console.log(`Ticketing API berjalan di http://${config.host}:${config.port}`);
});

const shutdown = () => {
  server.close(async () => {
    await Promise.allSettled([bookingsPool.end(), flightsPool.end()]);
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
