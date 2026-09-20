// Plain-Node server for Aliyun / any VPS: no Cloudflare anywhere.
// - SQLite via node:sqlite (same SQL as D1)
// - Hono app reused unchanged (env.DB shimmed)
// - Serves dist/ statically + SPA fallback + /api
// Usage: npm ci && npm run build && node src/server/node.ts   (Node >= 22.13)
import { createServer } from "node:http";
import { gzipSync, constants as z } from "node:zlib";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
// SQLite: prefers node:sqlite (Node >= 22.13), falls back to bun:sqlite (Bun)
const { DatabaseSync } = (await import("node:sqlite").catch(() => null as any)) ??
  ((await import("bun:sqlite" as any).catch(() => { throw new Error("need Node >= 22.13 or Bun"); })) as any);
import app from "../worker/index.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
const DB_PATH = process.env.STARISLE_DB || join(ROOT, "data", "starisle.db");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);

mkdirSync(join(ROOT, "data"), { recursive: true });
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

// one-time schema + seed if empty
const { n } = sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='members'").get() as any;
if (!n) {
  console.log("empty database, applying schema + seed…");
  for (const f of ["src/db/schema.sql", "src/db/seed.sql"]) {
    sqlite.exec(readFileSync(join(ROOT, f), "utf8"));
  }
  console.log("seeded.");
}

// D1-compatible shim over node:sqlite
const DB = {
  prepare(sql: string) {
    const stmt = sqlite.prepare(sql);
    const mk = (args: any[]) => ({
      all: async () => ({ results: stmt.all(...args) }),
      first: async () => stmt.get(...args) ?? null,
      run: async () => {
        const r = stmt.run(...args);
        return { meta: { last_row_id: Number(r.lastInsertRowid ?? 0), changes: Number(r.changes ?? 0) } };
      },
      _syncRun: () => stmt.run(...args),
    });
    return {
      all: async () => ({ results: stmt.all() }),
      first: async () => stmt.get() ?? null,
      run: async () => {
        const r = stmt.run();
        return { meta: { last_row_id: Number(r.lastInsertRowid ?? 0), changes: Number(r.changes ?? 0) } };
      },
      bind: (...params: any[]) => {
        const args = params.map((p) => (p === undefined ? null : p));
        return mk(args);
      },
    };
  },
  batch: async (stmts: any[]) => {
    for (const s of stmts) s._syncRun();
    return { results: [] };
  },
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon",
};

const SECURE = process.env.COOKIE_SECURE !== "0"; // default: Secure cookies (serve behind HTTPS/nginx)

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on("data", (c) => { size += c.length; if (size > 1_048_576) { reject(new Error("payload too large")); req.destroy(); } else chunks.push(c); });
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
      const request = new Request(`http://local${url.pathname}${url.search}`, {
        method: req.method, headers: req.headers as any,
        body: body ? new Uint8Array(body) : undefined,
      });
      const resp = await app.fetch(request, { DB, COOKIE_SECURE: SECURE } as any, {} as any);
      const headers: Record<string, string> = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'",
        ...Object.fromEntries(resp.headers.entries()),
      };
      const payload = Buffer.from(await resp.arrayBuffer());
      const gz = (req.headers["accept-encoding"] ?? "").includes("gzip") && payload.length > 1024 && (headers["Content-Type"] ?? "").includes("json");
      if (gz) headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(resp.status, headers);
      res.end(gz ? gzipSync(payload, { level: z.Z_BEST_SPEED }) : payload);
      return;
    }
    // static + SPA fallback
    const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(DIST, safe === "/" ? "index.html" : safe);
    if (!existsSync(file) || existsSync(join(file, "index.html"))) {
      const alt = join(file, "index.html");
      file = existsSync(alt) ? alt : join(DIST, "index.html");
    }
    const data = readFileSync(file);
    const type = MIME[extname(file)] ?? "application/octet-stream";
    const cache = extname(file) === ".html"
      ? "no-cache"
      : file.includes(`${DIST}/assets/`) || /\.(jpg|png|webp|woff2)$/.test(file)
        ? "public, max-age=31536000, immutable"
        : "public, max-age=86400";
    const gz = /text|javascript|css|json|svg/.test(type) && (req.headers["accept-encoding"] ?? "").includes("gzip") && data.length > 1024;
    res.writeHead(200, {
      "Content-Type": type, "Content-Encoding": gz ? "gzip" : "identity",
      "Cache-Control": cache, Vary: "Accept-Encoding",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'",
    });
    res.end(gz ? gzipSync(data, { level: z.Z_BEST_SPEED }) : data);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => console.log(`starisle (aliyun mode) on http://localhost:${PORT}`));
