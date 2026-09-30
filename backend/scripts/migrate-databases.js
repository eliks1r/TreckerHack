import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = dotenv.parse(await readFile(new URL("../.env", import.meta.url), "utf8"));
for (const key of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
  if (!env[key]) { console.error(`Missing ${key}; configure local databases first.`); process.exit(1); }
  console.log(`Applying committed migrations for ${key === "DATABASE_URL" ? "application" : "test"} database.`);
  const child = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd: root, env: { ...process.env, DATABASE_URL: env[key] }, stdio: "inherit",
  });
  if (child.status !== 0) process.exit(child.status ?? 1);
}
