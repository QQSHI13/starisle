// PostgreSQL adapter with a D1-compatible surface.
// Translates our SQLite-flavoured SQL at prepare() time:
//   ? -> $n, datetime('now'[,mods]) -> now() +/- intervals, date('now') -> current_date,
//   INSERT OR IGNORE -> ON CONFLICT DO NOTHING, the projects ORDER BY datetime(REPLACE(...)) -> plain column.
import pg from "pg";

let pool: pg.Pool | null = null;

export function pgPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

function translate(sql: string): string {
  let out = sql
    .replace(/datetime\(\s*'now'\s*(?:,\s*'([+-])(\d+)\s*(\w+)')?\s*\)/g, (_m, sign, n, unit) => {
      if (!sign) return "now()";
      const u = { minutes: "minutes", minute: "minutes", days: "days", day: "days", hours: "hours", months: "months", years: "years" }[unit as string] ?? "days";
      return `now() ${sign === "-" ? "-" : "+"} interval '${n} ${u}'`;
    })
    .replace(/date\(\s*'now'\s*(?:,\s*'([+-])(\d+)\s*(\w+)')?\s*\)/g, (_m, sign, n, unit) => {
      if (!sign) return "current_date";
      const u = { days: "days", day: "days", months: "months", years: "years" }[unit as string] ?? "days";
      return `(current_date ${sign === "-" ? "-" : "+"} interval '${n} ${u}')`;
    })
    .replace(/char\(10\)/g, "chr(10)")
    .replace(/datetime\(REPLACE\(REPLACE\(p\.updated_at,'T',' '\),'Z',''\)\)/g, "p.updated_at")
    .replace(/datetime\(REPLACE\(REPLACE\(([^)]+)\)\)\)/g, "$1")
    .replace(/strftime\('%Y-%m-%d %H:%M:%S','now'\)/g, "to_char(now(),'YYYY-MM-DD HH24:MI:SS')");
  // INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING (appended before any trailing semicolon)
  const m = out.match(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i);
  if (m) {
    out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
    out = /ON\s+CONFLICT/i.test(out) ? out : out.replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
  }
  // INSERTs need RETURNING so meta.last_row_id works; only some tables have an id column
  const ID_TABLES = new Set(["members","applications","projects","courses","columns","comments","activities","notifications","messages","project_updates","join_requests","homework","submissions","course_lessons","mentor_requests","reports","otp_codes","project_follows","member_follows","enrollments","rsvps","mentors","partners","resources","mentor_courses","project_gaps","project_stacks","project_milestones","recovery_codes","audit_log"]);
  if (/^\s*INSERT\s+INTO/i.test(out) && !/RETURNING/i.test(out)) {
    const tbl = (out.match(/^\s*INSERT\s+INTO\s+(\w+)/i) ?? [])[1]?.toLowerCase();
    out = out.replace(/;?\s*$/, ID_TABLES.has(tbl) ? " RETURNING id" : " RETURNING 1");
  }
  // ? placeholders -> $n
  let i = 0;
  out = out.replace(/\?/g, () => `$${++i}`);
  return out;
}

export function makePgDb() {
  const p = pgPool();
  return {
    prepare(sql: string) {
      const pgSql = translate(sql);
      return {
        bind: (...params: any[]) => {
          const args = params.map((x) => (x === undefined ? null : x));
          return {
            all: async () => ({ results: (await p.query(pgSql, args)).rows }),
            first: async () => (await p.query(pgSql, args)).rows[0] ?? null,
            run: async () => {
              const r = await p.query(pgSql, args);
              return { meta: { last_row_id: Number(r.rows[0]?.id ?? 0), changes: r.rowCount ?? 0 } };
            },
            _sql: pgSql, _args: args,
          };
        },
        all: async () => ({ results: (await p.query(pgSql)).rows }),
        first: async () => (await p.query(pgSql)).rows[0] ?? null,
        run: async () => {
          const r = await p.query(pgSql);
          return { meta: { last_row_id: Number(r.rows[0]?.id ?? 0), changes: r.rowCount ?? 0 } };
        },
      };
    },
    batch: async (stmts: any[]) => {
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        for (const s of stmts) await client.query(s._sql, s._args);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    _pool: p,
  };
}

export { translate };
