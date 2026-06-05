// Tiny static server for the generated demo. Usage: node test/serve-demo.mjs [dir] [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] || "examples/css-vars/demo";
const port = Number(process.argv[3] || 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (url === "/") url = "/index.html";
    const filePath = normalize(join(root, url));
    if (!filePath.startsWith(normalize(root))) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => {
  console.log(`dsmcp demo server: http://localhost:${port}/  (root: ${root})`);
});
