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
Two extra accounts: admin `施清荃` / `演示成员` (Demo Member). The admin can review applications, projects and course requests at `/admin`.

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
