#!/usr/bin/env node
/**
 * Zero-dependency static server for local development.
 *
 * The site itself needs no server (it runs from file://), but a server gives
 * you clean URLs, correct MIME types, and a place to proxy the optional
 * backend during development.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { ROOT } from "./lib/load-curriculum.mjs";

const PORT = Number(process.env.PORT || 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel.endsWith("/")) rel += "index.html";

    // Contain path traversal: normalise, strip leading ../ sequences, then
    // verify the resolved path is still inside the project root.
    const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
    const path = join(ROOT, safe);
    if (!path.startsWith(ROOT)) {
      res.writeHead(403, { "Content-Type": "text/plain" }).end("forbidden");
      return;
    }

    const info = await stat(path);
    if (info.isDirectory()) {
      const body = await readFile(join(path, "index.html"));
      res.writeHead(200, { "Content-Type": TYPES[".html"] });
      res.end(body);
      return;
    }

    const body = await readFile(path);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
  }
}).listen(PORT, () => {
  console.log(`\n  Forge running at http://localhost:${PORT}\n`);
});
