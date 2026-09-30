import { readConfig } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { createApp } from "./app.js";

let db;
try {
  const config = readConfig();
  db = createDatabase(config.databaseUrl);
  await db.$connect();
  const server = createApp({ db, config }).listen(config.port, "127.0.0.1", () => {
    console.log(`Motion Tracker API listening on http://localhost:${config.port}`);
  });
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { await db.$disconnect(); clearTimeout(timer); process.exit(0); });
  });
} catch {
  console.error("Backend startup failed. Check DATABASE_URL, JWT_SECRET and PostgreSQL availability; see backend/README.md.");
  await db?.$disconnect();
  process.exitCode = 1;
}
