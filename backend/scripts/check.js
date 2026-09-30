import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const root = fileURLToPath(new URL("../", import.meta.url));
const paths = [...await files(join(root, "src")), ...await files(join(root, "scripts")), ...await files(join(root, "test")),
  fileURLToPath(new URL("../../src/api.js", import.meta.url)), fileURLToPath(new URL("../../src/ui3d.js", import.meta.url))];
for (const path of paths.filter(p => p.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
}
console.log(`Syntax checks passed (${paths.length} files).`);
