# 星屿 Starisle

A full rebuild of the community platform at https://forum.aiyf.org.cn — invite-only, human-reviewed, minors-first.
One codebase runs anywhere: **Bun + SQLite** (self-contained, no Docker, no Cloudflare required) or **Cloudflare Workers + D1**.

No UI kits, no Tailwind, no gradients. Hand-written CSS with light/dark themes, real zh/en i18n, honest empty states.

## Quick start (Bun)

```bash
bun install
bun run demo      # fresh everything: re-harvest data → build → serve on http://localhost:3000
```

The server creates `data/starisle.db` on first boot and auto-applies schema + seed.

## Scripts

| Command | What it does |
|---|---|
| `bun run start` | self-contained server (Bun fast path, API cache, gzip, security headers) |
| `bun run demo` | nuke `data/` + `dist/`, re-seed, rebuild, serve — the one-command demo |
| `bun run dev` | Vite dev server on :5173 (`/api` proxied to :8790) |
| `bun run dev:api` | Cloudflare-mode API on :8790 (pair with `bun run dev`) |
| `bun run build` | build the SPA into `dist/` |
| `bun run check` | typecheck |
| `bun run seed` | re-harvest real data from the legacy site into `src/db/seed.sql` |
| `bun run deploy` | deploy to Cloudflare Workers (also runs automatically via CI on push) |

Node ≥ 22.13 works as a drop-in for the server (`node src/server/node.ts`), but Bun is the default and the fast path.

## Demo accounts

Every seeded account (including all imported members) uses the dev password **`starisle-dev`**.
Admin: `演示管理员` (dashboard at `/admin`). Imported members keep their real names with normal member rights.

## Features

**Public** — projects (search, domain filter, open roles, real poster boards, live GitHub/Gitee repo stats), courses, columns (incl. the dean's letter), students directory (+ search, verified badges), mentors, events & resources with honest empty states, partners (logos self-hosted), community pulse feed on the homepage.

**Accounts** — application with age + real guardian consent (under-14 requires guardian name/contact, verified by admins), application status query, login, one-time recovery codes as the only reset path.

**Members** — start/edit projects (human review), dev-log updates (moderated), follow projects & people with notification fan-out, join requests with owner inbox, course requests, mentor requests, profile + personal website, real-name visibility toggle (default private; minors locked private), account deactivation with data cleanup.

**Notifications (GitHub-style)** — inbox/saved/done views, type filters (项目动态/加入/申请/审核/导师/公告), search, per-item done/save/delete, 20s polling + refresh on tab focus.

**Admin** (`/admin`) — queues for applications (with guardian info), pending projects, course requests, update moderation, mentor requests, and reports; site operations (publish events/resources/columns, broadcast notices); audit log of every admin action.

**Safety (minors-first)** — real-name private by default, guardian records, all UGC moderated, one-click reports with takedown + audit trail, verified-teacher flag, secure headers everywhere, payload caps, rate-limited auth.

**Performance** — Bun.serve fast path, 10s TTL cache on public endpoints, gzip, immutable asset caching, DB indexes, background repo-stat refresh. Comfortably serves 400 concurrent users on a 2-core/4G box with ~25× headroom.

## Deploy

**Any VPS (the simple way)** — the whole app is one process:

```bash
bun install && bun run build
bun src/server/node.ts        # :3000, auto-creates + seeds the SQLite file data/starisle.db
```

**PostgreSQL (team deployments)** — set `DATABASE_URL` and the same server speaks Postgres:

```bash
# e.g. docker run -d -e POSTGRES_DB=starisle -e POSTGRES_USER=starisle -e POSTGRES_PASSWORD=... -p 5432:5432 postgres:18-alpine
# (verified against PostgreSQL 17/18; any version >= 12 works — the app pins nothing)
DATABASE_URL=postgres://starisle:pass@localhost:5432/starisle bun src/server/node.ts
# first boot auto-applies src/db/schema.pg.sql + seed.sql
```

One codebase, one SQL dialect family: SQLite file by default (zero config), Cloudflare D1 via wrangler, or full PostgreSQL via `DATABASE_URL`. Without `DATABASE_URL` nothing changes — the file DB is still the demo default. (`bun run seed:demo` storyline is SQLite-only for now.)

Behind nginx (`proxy_pass http://127.0.0.1:3000`) with a systemd unit (`Restart=always`). Backups = copy `data/starisle.db` (add a daily cron).

**Cloudflare** — push to `main`; CI (typecheck → build → API smoke → deploy) ships it automatically. Requires repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

## Layout

```
src/worker/     Hono API (auth, projects, courses, admin, moderation, …)
src/server/     self-contained Bun/Node server (SQLite shim, statics, cache)
src/db/         schema.sql + generated seed.sql
src/web/        React SPA (pages, i18n dictionary, hand-written CSS)
scripts/        fetch-seed.mjs (harvests legacy API), hash-passwords.mjs
wrangler.toml   Cloudflare worker + D1 config (optional path)
```

## Integrating with the original site

- **Mount under a path**: `BASE_PATH=/v2 bun run build` serves the SPA from `https://forum.aiyf.org.cn/v2/` (router basename + asset base adjust automatically).
- **API prefix**: all endpoints live under `/api/*`; a same-origin proxy rule on the origin is enough — no CORS changes.
- **Data migration**: `bun run seed` re-harvests everything from the legacy API; run once, point the frontend at the new deployment.
- **Sessions**: cookie is named `sid`, path-scoped — no collision with the original site's cookie.
