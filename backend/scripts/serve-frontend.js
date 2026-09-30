import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".task": "application/octet-stream" };
export function createFrontendServer() {
  return createServer(async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); return res.end(); }
      const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = resolve(root, path === "/" ? "index.html" : path.slice(1));
      const rel = relative(root, file);
      const allowed = ["index.html", "styles.css"].includes(rel) || ["src", "assets", "vendor"].some(dir => rel.startsWith(dir + sep));
      if (!allowed || rel.startsWith("..") || rel.split(/[\\/]/).some(part => part.startsWith("."))) {
        res.writeHead(404); return res.end("Not found");
      }
      if (!(await stat(file)).isFile()) { res.writeHead(404); return res.end("Not found"); }
      const bytes = await readFile(file);
      res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "Content-Length": bytes.length,
        "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createFrontendServer().listen(8000, "127.0.0.1", () => console.log("Motion Tracker frontend: http://localhost:8000"));
}
