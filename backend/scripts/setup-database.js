// Creates only the two named local databases; never changes roles/passwords or existing data.
import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";

const path = new URL("../.env", import.meta.url);
let client;
try {
  let content = await readFile(path, "utf8");
  const env = dotenv.parse(content);
  const url = new URL(env.DATABASE_URL);
  if (url.hostname !== "localhost" || url.port !== "5432" || url.username !== "postgres" || url.pathname !== "/treckerhack" || !url.password) {
    throw Object.assign(new Error("Use configure-local.js first."), { code: "LOCAL_CONFIGURATION_REQUIRED" });
  }
  const admin = new URL(url);
  admin.pathname = "/postgres";
  client = new pg.Client({ connectionString: admin.href, connectionTimeoutMillis: 5000 });
  await client.connect();
  console.log("PostgreSQL connection authenticated successfully.");
  for (const name of ["treckerhack", "treckerhack_test"]) {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount) console.log(`Database ${name} already exists; retained.`);
    else {
      try { await client.query(`CREATE DATABASE "${name}"`); console.log(`Database ${name} created.`); }
      catch (error) { if (error.code !== "42P04") throw error; console.log(`Database ${name} already exists; retained.`); }
    }
  }
  const testUrl = new URL(url);
  testUrl.pathname = "/treckerhack_test";
  const line = `TEST_DATABASE_URL=${testUrl.href}`;
  content = /^TEST_DATABASE_URL=.*$/m.test(content) ? content.replace(/^TEST_DATABASE_URL=.*$/m, () => line) : `${content.trimEnd()}\n${line}\n`;
  await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
  console.log("Dedicated test database configured in ignored .env; credentials were not printed.");
} catch (error) {
  console.error(`Database setup failed (${error.code ?? error.name}). No credentials were printed.`);
  process.exitCode = 1;
} finally { await client?.end(); }
