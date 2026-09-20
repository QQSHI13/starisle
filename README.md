# 星屿 Starisle — full rebuild

A from-scratch replacement for https://forum.aiyf.org.cn: one Cloudflare Worker (Hono) serving a JSON API and a React SPA, backed by D1 SQLite, seeded with the community's real data (projects, courses, members, mentors, partners, the dean's letter).

No UI kits, no Tailwind, no gradients. Hand-written CSS with a light/dark theme, real zh/en i18n for all chrome, and honest empty states.

## Run it

```bash
npm install
npm run demo        # reset DB → seed → build → serve on http://localhost:8787
```

or step by step:

```bash
npm run seed        # fetch real data from the legacy site into src/db/seed.sql
npm run db:reset    # apply schema + seed to the local D1
npm run build       # build the SPA into dist/
npx wrangler dev    # serve API + SPA on :8787
```

`npm run dev` runs only the Vite dev server on :5173 with `/api` proxied to :8787 (start `wrangler dev` too).

## Demo accounts

All seeded accounts (including every imported member) use the dev password **`starisle-dev`**.
Demo accounts: admin `演示管理员` (Demo Admin, role=admin — reviews applications/projects/course requests at `/admin`),
and `演示成员` (Demo Member). Imported members keep their real names/roles (no admin rights).

## Features

- Public: projects (search/domain filter/open roles/showcase posters), courses, columns (full dean's letter), students directory + profiles, mentors (+ request form), events & resources with honest empty states, partners, stats.
- Auth: apply (with minor/guardian consent + public-data consent), application status query, login, one-time recovery codes (90-day) as the only reset path, sessions in D1.
- Member: start/edit projects (human review), course requests, mentor requests, notifications, profile editing, username change gated on password.
- Admin: review queues for applications / projects / enrollments with reject reasons; every decision notifies the member.
- i18n: every UI string in zh + en; theme + language persist, `lang` attribute follows.

## Layout

```
src/worker/     Hono API (auth, projects, courses, admin, …)
src/db/         schema.sql + generated seed.sql
src/web/        React SPA (pages, i18n dictionary, hand-written CSS)
scripts/        fetch-seed.mjs (harvests legacy API), hash-passwords.mjs
wrangler.toml   worker + D1 + static assets config
```

Not deployed on purpose — `wrangler deploy` when ready.

## Integrating with the original site

This rebuild is designed to be adopted piecemeal by the original team:

- **Mount under a path**: `BASE_PATH=/v2 npm run build` makes the SPA run at `https://forum.aiyf.org.cn/v2/` (router basename + asset base adjust automatically). Deploy the worker on the same Cloudflare account and add a `forum.aiyf.org.cn/v2/*` route.
- **API prefix**: all endpoints live under `/api/*`; set the worker's `API_PREFIX` var (default `/api`) if the original site needs `/api/v2/*` during a transition window. The frontend calls same-origin paths only, so a proxy rule on the origin is enough — no CORS changes needed.
- **Data migration**: `npm run seed` re-harvests everything from the legacy API into D1; run it once against production D1 to import live data, then point the frontend at the new worker.
- **Session coexistence**: the session cookie is named `sid` and is path-scoped; it won't collide with the original site's cookie.
