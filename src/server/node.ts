// Self-contained server: Bun (fast path) or Node >= 22.13. No Docker, no Cloudflare.
// Serves dist/ statically + /api (Hono app) + SPA fallback, with short-TTL API cache.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { gzipSync, constants as z } from "node:zlib";

const ROOT = new URL("../..", import.meta.url).pathname;
const DB_PATH = process.env.STARISLE_DB || join(ROOT, "data", "starisle.db");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);
const SECURE = process.env.COOKIE_SECURE !== "0";

const USE_PG = !!process.env.DATABASE_URL;

type DBClass = new (path: string) => any;
let DatabaseSync: DBClass;
let sqlite: any = null;
if (!USE_PG) {
  const ns: any = await import("node:sqlite").catch(() => null as any);
  if (ns?.DatabaseSync) DatabaseSync = ns.DatabaseSync;
  else {
    const bun: any = await import("bun:sqlite" as any).catch(() => null as any);
    if (!bun?.Database) throw new Error("need Node >= 22.13 or Bun");
    DatabaseSync = bun.Database;
  }
  mkdirSync(join(ROOT, "data"), { recursive: true });
  sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const { n } = sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='members'").get() as any;
  if (!n) {
    console.log("empty database, applying schema + seed…");
    sqlite.exec(readFileSync(join(ROOT, "src/db/schema.sql"), "utf8"));
    sqlite.exec(readFileSync(join(ROOT, "src/db/seed.sql"), "utf8"));
    console.log("seeded.");
  }
}

// D1-compatible shim over node:sqlite / bun:sqlite
const sqliteDB = {
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
      bind: (...params: any[]) => mk(params.map((p) => (p === undefined ? null : p))),
    };
  },
  batch: async (stmts: any[]) => {
    for (const s of stmts) s._syncRun();
    return { results: [] };
  },
};

const { default: app } = await import("../worker/index.ts");

// PostgreSQL path
let DB: any = sqliteDB;
if (USE_PG) {
  const { makePgDb, translate } = await import("./pg.ts");
  DB = makePgDb();
  const pool = DB._pool as import("pg").Pool;
  const { rows } = await pool.query("SELECT to_regclass('public.members') AS t");
  if (!rows[0]?.t) {
    console.log("postgres: applying schema.pg.sql + seed…");
    const runFile = async (file: string) => {
      const text = readFileSync(join(ROOT, file), "utf8");
      const stmts = text.split(/;\s*\n/)
        .map((x) => x.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim())
        .filter((x) => x.length > 3);
      for (const st of stmts) {
        try { await pool.query(translate(st)); }
        catch (e) { console.error("PG statement failed:", st.slice(0, 140)); throw e; }
      }
    };
    await runFile("src/db/schema.pg.sql");
    await runFile("src/db/seed.sql");
    console.log("postgres seeded.");
  }
}

// --- short-TTL cache for hot public GET endpoints ---
const CACHEABLE = ["/api/stats", "/api/projects", "/api/courses", "/api/members", "/api/mentors", "/api/columns", "/api/partners", "/api/domains" ];
const cache = new Map<string, { exp: number; body: string; headers: Record<string, string> }>();
const CACHE_TTL = 10_000;
const cacheKey = (method: string, url: URL) => (method === "GET" && (CACHEABLE.includes(url.pathname) || url.pathname.startsWith("/api/projects?")) ? url.pathname + url.search : null);

const SEC_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net",
};

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith("/api/")) {
      const key = cacheKey(request.method, url);
      if (request.method !== "GET" && request.method !== "HEAD") cache.clear();
      const hit = key ? cache.get(key) : null;
      if (hit && hit.exp > Date.now()) return new Response(hit.body, { status: 200, headers: hit.headers });
      const resp = await app.fetch(request, { DB, COOKIE_SECURE: SECURE } as any, {} as any);
      if (key && resp.status === 200) {
        const body = await resp.text();
        const headers = { "Content-Type": "application/json; charset=utf-8" };
        cache.set(key, { exp: Date.now() + CACHE_TTL, body, headers });
        return new Response(body, { status: 200, headers: { ...headers, ...SEC_HEADERS } });
      }
      return resp;
    }
    const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(DIST, safe === "/" ? "index.html" : safe);
    if (!existsSync(file) || existsSync(join(file, "index.html"))) {
      const alt = join(file, "index.html");
      file = existsSync(alt) ? alt : join(DIST, "index.html");
    }
    const data = readFileSync(file);
    const type = MIME[extname(file)] ?? "application/octet-stream";
    const cacheHdr = extname(file) === ".html" ? "no-cache"
      : file.includes(`${DIST}/assets/`) || /\.(jpg|png|webp|woff2)$/.test(file) ? "public, max-age=31536000, immutable"
      : file.includes(`${DIST}/vendor/`) ? "no-cache"
      : "public, max-age=86400";
    const gz = /text|javascript|css|json|svg/.test(type) && (request.headers.get("accept-encoding") ?? "").includes("gzip") && data.length > 1024;
    const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": cacheHdr, Vary: "Accept-Encoding", ...SEC_HEADERS };
    if (gz) headers["Content-Encoding"] = "gzip";
    return new Response(gz ? gzipSync(data, { level: z.Z_BEST_SPEED }) : data, { status: 200, headers });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: SEC_HEADERS });
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon",
};

const isBun = typeof (globalThis as any).Bun !== "undefined";
if (isBun) {
  (globalThis as any).Bun.serve({ port: PORT, fetch: handle });
  console.log(`starisle (bun, fast path) on http://localhost:${PORT}`);
} else {
  const { createServer } = await import("node:http");
  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const body = req.method === "GET" || req.method === "HEAD" ? undefined
      : await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          let size = 0;
          req.on("data", (c) => { size += c.length; if (size > 1_048_576) { reject(new Error("payload too large")); req.destroy(); } else chunks.push(c); });
          req.on("end", () => resolve(Buffer.concat(chunks)));
        });
    const request = new Request(`http://local${url.pathname}${url.search}`, { method: req.method, headers: req.headers as any, body: body ? new Uint8Array(body) : undefined });
    try {
      const resp = await handle(request);
      const payload = Buffer.from(await resp.arrayBuffer());
      const headers = Object.fromEntries(resp.headers.entries());
      const gz = !headers["Content-Encoding"] && (req.headers["accept-encoding"] ?? "").includes("gzip") && payload.length > 1024 && (headers["Content-Type"] ?? "").includes("text");
      if (gz) headers["Content-Encoding"] = "gzip";
      res.writeHead(resp.status, headers);
      res.end(gz ? gzipSync(payload, { level: z.Z_BEST_SPEED }) : payload);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  }).listen(PORT, () => console.log(`starisle (node) on http://localhost:${PORT}`));
}
