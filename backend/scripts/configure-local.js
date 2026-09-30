// Local-only configuration helper. Password input is hidden and never logged.
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import dotenv from "dotenv";

const envPath = new URL("../.env", import.meta.url);
let content;
try { content = await readFile(envPath, "utf8"); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  content = await readFile(new URL("../.env.example", import.meta.url), "utf8");
}
const existing = dotenv.parse(content);
function set(name, value) {
  const line = `${name}=${value}`;
  const expression = new RegExp(`^${name}=.*$`, "m");
  content = expression.test(content) ? content.replace(expression, () => line) : `${content.trimEnd()}\n${line}\n`;
}
set("JWT_SECRET", existing.JWT_SECRET?.length >= 32 ? existing.JWT_SECRET : randomBytes(48).toString("hex"));
set("PORT", "3000");
set("FRONTEND_ORIGIN", "http://localhost:8000");
set("NODE_ENV", "development");
set("ENABLE_DEMO_AUTH", "false");

let password = "";
try { password = decodeURIComponent(new URL(existing.DATABASE_URL).password); } catch { /* Not configured yet. */ }
if (!process.argv.includes("--prepare")) {
  if (!process.stdin.isTTY) {
    console.error("Run this helper in your local interactive terminal for hidden password input.");
    process.exitCode = 1;
  } else {
    const hiddenOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    hiddenOutput.isTTY = true;
    const prompt = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
    process.stdout.write("PostgreSQL password for postgres (hidden input): ");
    try { password = await prompt.question(""); }
    finally { prompt.close(); process.stdout.write("\n"); }
    if (!password) { console.error("Empty password: database credentials were not changed."); process.exitCode = 1; }
  }
}
if (password) {
  set("DATABASE_URL", `postgresql://postgres:${encodeURIComponent(password)}@localhost:5432/treckerhack`);
} else if (!existing.DATABASE_URL) {
  // No guessed password. This URL cannot authenticate until local input is supplied.
  set("DATABASE_URL", "postgresql://postgres@localhost:5432/treckerhack");
}
await writeFile(envPath, content, { encoding: "utf8", mode: 0o600 });
password = "";
console.log(process.argv.includes("--prepare") ? "Local configuration prepared; credentials were not printed."
  : process.exitCode ? "Non-secret configuration prepared; password input is still required." : "Local configuration saved; credentials were not printed.");
