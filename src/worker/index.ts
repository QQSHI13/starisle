import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { D1Database } from "@cloudflare/workers-types";

type Bindings = { DB: D1Database };
type Member = {
  id: number; username: string; display_name: string; email: string | null;
  bio: string | null; repo_url: string | null; avatar: string | null;
  role: string; status: string; created_at: string;
  password_hash: string; salt: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const SESSION_DAYS = 30;

// ---------- helpers ----------
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100_000, hash: "SHA-256" },
    key, 256
  );
  return hex(bits);
}

const newToken = () => crypto.randomUUID() + crypto.randomUUID();

// naive dev rate limiter
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string, max = 10): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  e.n++;
  return e.n > max;
}

async function currentUser(c: { req: any; env: Bindings }): Promise<Member | null> {
  const token = getCookie(c as any, "sid");
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND m.status = 'active'`
  ).bind(token).first<Member>();
  return row ?? null;
}

const err = (c: any, status: number, message: string) =>
  c.json({ error: message }, status);

const str = (v: unknown, max = 2000): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;

// ---------- public reads ----------
app.get("/api/stats", async (c) => {
  const members = await c.env.DB.prepare(
    `SELECT COUNT(*) n FROM members WHERE status='active'`).first<any>();
  const projects = await c.env.DB.prepare(
    `SELECT COUNT(*) n FROM projects WHERE status='approved'`).first<any>();
  const courses = await c.env.DB.prepare(
    `SELECT COUNT(*) n FROM courses WHERE status='published'`).first<any>();
  const activities = await c.env.DB.prepare(`SELECT COUNT(*) n FROM activities`).first<any>();
  return c.json({
    members: members?.n ?? 0, projects: projects?.n ?? 0,
    courses: courses?.n ?? 0, activities: activities?.n ?? 0,
  });
});

app.get("/api/domains", async (c) =>
  c.json({ domains: await c.env.DB.prepare(`SELECT * FROM domains ORDER BY name`).all().then(r => r.results) }));

const projectCard = `
  SELECT p.*, d.name AS domain_name, d.color AS domain_color,
    (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
    m.username AS owner_username, m.display_name AS owner_display
  FROM projects p
  LEFT JOIN domains d ON d.id = p.domain_id
  JOIN members m ON m.id = p.owner_id`;

app.get("/api/projects", async (c) => {
  const q = c.req.query("q")?.trim();
  const domain = c.req.query("domain")?.trim();
  let sql = projectCard + ` WHERE p.status = 'approved'`;
  const binds: string[] = [];
  if (q) { sql += ` AND (p.name LIKE ? OR p.tagline LIKE ?)`; binds.push(`%${q}%`, `%${q}%`); }
  if (domain) { sql += ` AND p.domain_id = ?`; binds.push(domain); }
  sql += ` ORDER BY p.updated_at DESC`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ projects: results });
});

app.get("/api/projects/:slug", async (c) => {
  const p = await c.env.DB.prepare(projectCard + ` WHERE p.slug = ? AND p.status = 'approved'`)
    .bind(c.req.param("slug")).first<any>();
  if (!p) return err(c, 404, "project not found");
  const members = await c.env.DB.prepare(
    `SELECT m.username, m.display_name, pm.role FROM project_members pm
     JOIN members m ON m.id = pm.member_id WHERE pm.project_id = ?`).bind(p.id).all();
  const gaps = await c.env.DB.prepare(
    `SELECT label FROM project_gaps WHERE project_id = ?`).bind(p.id).all();
  return c.json({ project: p, members: members.results, gaps: gaps.results.map((g: any) => g.label) });
});

app.get("/api/courses", async (c) =>
  c.json({ courses: (await c.env.DB.prepare(`SELECT * FROM courses WHERE status='published' ORDER BY featured DESC, title`).all()).results }));

app.get("/api/courses/:slug", async (c) => {
  const course = await c.env.DB.prepare(`SELECT * FROM courses WHERE slug = ? AND status='published'`)
    .bind(c.req.param("slug")).first();
  if (!course) return err(c, 404, "course not found");
  return c.json({ course });
});

app.get("/api/columns", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, column_label, title, subtitle, author, author_title, published_at FROM columns ORDER BY published_at DESC`).all();
  return c.json({ columns: results });
});

app.get("/api/columns/:slug", async (c) => {
  const column = await c.env.DB.prepare(`SELECT * FROM columns WHERE slug = ?`).bind(c.req.param("slug")).first();
  if (!column) return err(c, 404, "column not found");
  return c.json({ column });
});

app.get("/api/members", async (c) =>
  c.json({ members: (await c.env.DB.prepare(
    `SELECT m.username, m.display_name, m.bio, m.repo_url, m.avatar, m.created_at,
       (SELECT COUNT(*) FROM project_members pm JOIN projects p ON p.id = pm.project_id
         WHERE pm.member_id = m.id AND p.status='approved') AS project_count
     FROM members m WHERE m.status = 'active' ORDER BY m.created_at DESC`).all()).results }));

app.get("/api/members/:username", async (c) => {
  const m = await c.env.DB.prepare(
    `SELECT username, display_name, bio, repo_url, avatar, created_at FROM members
     WHERE username = ? AND status = 'active'`).bind(c.req.param("username")).first();
  if (!m) return err(c, 404, "member not found");
  const projects = await c.env.DB.prepare(
    `SELECT p.slug, p.name, p.tagline, pm.role FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     WHERE pm.member_id = (SELECT id FROM members WHERE username = ?) AND p.status='approved'`)
    .bind(c.req.param("username")).all();
  return c.json({ member: m, projects: projects.results });
});

app.get("/api/mentors", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM mentors ORDER BY name`).all();
  const courses = await c.env.DB.prepare(`SELECT * FROM mentor_courses`).all();
  const byMentor = new Map<number, any[]>();
  for (const mc of courses.results as any[]) {
    if (!byMentor.has(mc.mentor_id)) byMentor.set(mc.mentor_id, []);
    byMentor.get(mc.mentor_id)!.push(mc);
  }
  return c.json({ mentors: (results as any[]).map((m) => ({ ...m, courses: byMentor.get(m.id) ?? [] })) });
});

app.get("/api/activities", async (c) =>
  c.json({ activities: (await c.env.DB.prepare(`SELECT * FROM activities ORDER BY starts_at`).all()).results }));

app.get("/api/resources", async (c) =>
  c.json({ resources: (await c.env.DB.prepare(`SELECT * FROM resources`).all()).results }));

app.get("/api/partners", async (c) =>
  c.json({ partners: (await c.env.DB.prepare(`SELECT * FROM partners ORDER BY category, name`).all()).results }));

// ---------- auth ----------
app.post("/api/auth/register", async (c) => {
  if (rateLimited(c.req.header("CF-Connecting-IP") ?? "local")) return err(c, 429, "too many attempts, wait a minute");
  const b = await c.req.json().catch(() => null);
  if (!b) return err(c, 400, "invalid json");
  const username = str(b.username, 40);
  const display = str(b.display_name, 40);
  const email = str(b.email, 120);
  const password = typeof b.password === "string" ? b.password : "";
  const statement = str(b.statement, 2000);
  const repo = str(b.repo_url, 300);
  if (!username || !display || !email || !statement) return err(c, 400, "username, display name, email and statement are required");
  if (statement.length < 10) return err(c, 400, "statement must be at least 10 characters");
  if (password.length < 8 || password.length > 72) return err(c, 400, "password must be 8–72 characters");
  if (!b.consent_privacy || !b.consent_public) return err(c, 400, "both consent checkboxes are required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(c, 400, "invalid email");
  const taken = await c.env.DB.prepare(`SELECT 1 x FROM members WHERE username = ? UNION SELECT 1 FROM applications WHERE username = ?`)
    .bind(username, username).first();
  if (taken) return err(c, 409, "username already taken");
  const salt = newToken();
  const hash = await hashPassword(password, salt);
  const token = newToken();
  await c.env.DB.prepare(
    `INSERT INTO applications (username, display_name, email, repo_url, statement, password_hash, salt, token)
     VALUES (?,?,?,?,?,?,?,?)`)
    .bind(username, display, email, repo, statement, hash, salt, token).run();
  return c.json({ token, status: "pending" }, 201);
});

app.post("/api/auth/application/status", async (c) => {
  const b = await c.req.json().catch(() => null);
  const username = str(b?.username, 40);
  const password = typeof b?.password === "string" ? b.password : "";
  if (!username || !password) return err(c, 400, "username and password required");
  const a = await c.env.DB.prepare(`SELECT * FROM applications WHERE username = ?`).bind(username).first<any>();
  if (!a || (await hashPassword(password, a.salt)) !== a.password_hash) return err(c, 404, "no application found for this username and password");
  return c.json({ status: a.status, reason: a.reason, created_at: a.created_at });
});

async function createSession(c: any, memberId: number) {
  const token = newToken();
  await c.env.DB.prepare(`INSERT INTO sessions (token, member_id, expires_at) VALUES (?,?, datetime('now', '+${SESSION_DAYS} days'))`)
    .bind(token, memberId).run();
  setCookie(c, "sid", token, {
    httpOnly: true, sameSite: "Lax", path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

app.post("/api/auth/login", async (c) => {
  if (rateLimited(c.req.header("CF-Connecting-IP") ?? "local")) return err(c, 429, "too many attempts, wait a minute");
  const b = await c.req.json().catch(() => null);
  const username = str(b?.username, 40);
  const password = typeof b?.password === "string" ? b.password : "";
  if (!username || !password) return err(c, 400, "username and password required");
  const m = await c.env.DB.prepare(`SELECT * FROM members WHERE username = ? AND status = 'active'`).bind(username).first<any>();
  if (!m || (await hashPassword(password, m.salt)) !== m.password_hash) return err(c, 401, "wrong username or password");
  await createSession(c, m.id);
  const { password_hash, salt, ...safe } = m;
  return c.json({ member: safe });
});

app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, "sid");
  if (token) await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  deleteCookie(c, "sid", { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const { password_hash, salt, ...safe } = m;
  return c.json({ member: safe });
});

app.post("/api/auth/recovery-code", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  if ((await hashPassword(String(b?.password ?? ""), m.salt)) !== m.password_hash)
    return err(c, 403, "wrong password");
  const code = newToken().replaceAll("-", "").slice(0, 16);
  const codeHash = await hashPassword(code, m.salt);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE recovery_codes SET used = 1 WHERE member_id = ?`).bind(m.id),
    c.env.DB.prepare(`INSERT INTO recovery_codes (member_id, code_hash, expires_at) VALUES (?,?, datetime('now', '+90 days'))`)
      .bind(m.id, codeHash),
  ]);
  return c.json({ code });
});

app.post("/api/auth/recover", async (c) => {
  const b = await c.req.json().catch(() => null);
  const username = str(b?.username, 40);
  const code = str(b?.code, 64);
  const password = typeof b?.password === "string" ? b.password : "";
  if (!username || !code || password.length < 8 || password.length > 72)
    return err(c, 400, "username, recovery code and a new password (8–72 chars) are required");
  const m = await c.env.DB.prepare(`SELECT * FROM members WHERE username = ? AND status='active'`).bind(username).first<any>();
  if (!m) return err(c, 404, "no such member");
  const rc = await c.env.DB.prepare(
    `SELECT * FROM recovery_codes WHERE member_id = ? AND used = 0 AND expires_at > datetime('now')`)
    .bind(m.id).first<any>();
  if (!rc || (await hashPassword(code, m.salt)) !== rc.code_hash) return err(c, 403, "invalid or expired recovery code");
  const salt = newToken();
  const hash = await hashPassword(password, salt);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE recovery_codes SET used = 1 WHERE id = ?`).bind(rc.id),
    c.env.DB.prepare(`UPDATE members SET password_hash = ?, salt = ? WHERE id = ?`).bind(hash, salt, m.id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE member_id = ?`).bind(m.id),
  ]);
  return c.json({ ok: true });
});

// ---------- logged-in ----------
app.post("/api/my/mentor-requests", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const mentorId = Number(b?.mentor_id);
  const interest = str(b?.interest, 500);
  if (!mentorId || !interest) return err(c, 400, "mentor and interest are required");
  const mentor = await c.env.DB.prepare(`SELECT id FROM mentors WHERE id = ?`).bind(mentorId).first();
  if (!mentor) return err(c, 404, "mentor not found");
  await c.env.DB.prepare(
    `INSERT INTO mentor_requests (member_id, mentor_id, interest, background, questions) VALUES (?,?,?,?,?)`)
    .bind(m.id, mentorId, interest, str(b?.background, 1000), str(b?.questions, 1000)).run();
  return c.json({ ok: true }, 201);
});

app.post("/api/my/courses", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const courseId = Number(b?.course_id);
  const course = await c.env.DB.prepare(`SELECT id FROM courses WHERE id = ?`).bind(courseId).first();
  if (!course) return err(c, 404, "course not found");
  await c.env.DB.prepare(
    `INSERT INTO enrollments (member_id, course_id, status) VALUES (?,?, 'pending')
     ON CONFLICT (member_id, course_id) DO NOTHING`).bind(m.id, courseId).run();
  return c.json({ ok: true }, 201);
});

app.get("/api/my/courses", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const { results } = await c.env.DB.prepare(
    `SELECT e.status, e.created_at, cu.title, cu.slug, cu.subject FROM enrollments e
     JOIN courses cu ON cu.id = e.course_id WHERE e.member_id = ? ORDER BY e.created_at DESC`).bind(m.id).all();
  return c.json({ enrollments: results });
});

app.get("/api/my/projects", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
     FROM projects p WHERE p.owner_id = ? ORDER BY p.created_at DESC`).bind(m.id).all();
  return c.json({ projects: results });
});

app.get("/api/showcase", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, poster_url FROM projects WHERE status = 'approved' AND poster_url IS NOT NULL ORDER BY updated_at DESC`).all();
  return c.json({ posters: results });
});

const slugify = (name: string) =>
  (name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "") || "project") + "-" + Math.random().toString(36).slice(2, 8);

app.post("/api/my/projects", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const name = str(b?.name, 80);
  const tagline = str(b?.tagline, 200) ?? "";
  if (!name) return err(c, 400, "project name required");
  const slug = slugify(name);
  const r = await c.env.DB.prepare(
    `INSERT INTO projects (slug, name, tagline, body, repo_url, demo_url, poster_url, domain_id, status, owner_id)
     VALUES (?,?,?,?,?,?,?,'pending',?)`)
    .bind(slug, name, tagline, str(b?.body, 5000) ?? "", str(b?.repo_url, 300), str(b?.demo_url, 300), str(b?.poster_url, 300), str(b?.domain_id, 40), m.id).run();
  const id = r.meta.last_row_id;
  await c.env.DB.prepare(`INSERT INTO project_members (project_id, member_id, role) VALUES (?,?, 'owner')`).bind(id, m.id).run();
  return c.json({ slug, status: "pending" }, 201);
});

app.put("/api/my/projects/:slug", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const p = await c.env.DB.prepare(`SELECT * FROM projects WHERE slug = ?`).bind(c.req.param("slug")).first<any>();
  if (!p || p.owner_id !== m.id) return err(c, 404, "project not found");
  const b = await c.req.json().catch(() => null);
  await c.env.DB.prepare(
    `UPDATE projects SET name = ?, tagline = ?, body = ?, repo_url = ?, demo_url = ?, poster_url = ?, domain_id = ?,
       status = CASE WHEN status = 'rejected' THEN 'pending' ELSE status END, updated_at = datetime('now')
     WHERE id = ?`)
    .bind(str(b?.name, 80) ?? p.name, str(b?.tagline, 200) ?? p.tagline, str(b?.body, 5000) ?? p.body,
      b?.repo_url !== undefined ? str(b.repo_url, 300) : p.repo_url,
      b?.demo_url !== undefined ? str(b.demo_url, 300) : p.demo_url,
      b?.poster_url !== undefined ? str(b.poster_url, 300) : p.poster_url,
      b?.domain_id !== undefined ? str(b.domain_id, 40) : p.domain_id, p.id).run();
  return c.json({ ok: true });
});

app.delete("/api/my/projects/:slug", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const p = await c.env.DB.prepare(`SELECT * FROM projects WHERE slug = ?`).bind(c.req.param("slug")).first<any>();
  if (!p || p.owner_id !== m.id) return err(c, 404, "project not found");
  const others = await c.env.DB.prepare(
    `SELECT COUNT(*) n FROM project_members WHERE project_id = ? AND member_id != ?`).bind(p.id, m.id).first<any>();
  if ((others?.n ?? 0) > 0) return err(c, 409, "withdraw other members before deleting this project");
  await c.env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(p.id).run();
  return c.json({ ok: true });
});

app.get("/api/notifications", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE member_id = ? ORDER BY created_at DESC LIMIT 50`).bind(m.id).all();
  return c.json({ notifications: results });
});

app.post("/api/notifications/read", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE member_id = ?`).bind(m.id).run();
  return c.json({ ok: true });
});

app.put("/api/me", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  if (b?.username !== undefined && b.username !== m.username) {
    if ((await hashPassword(String(b?.password ?? ""), m.salt)) !== m.password_hash)
      return err(c, 403, "password required to change username");
    const taken = await c.env.DB.prepare(`SELECT 1 x FROM members WHERE username = ?`).bind(str(b.username, 40)).first();
    if (taken) return err(c, 409, "username already taken");
  }
  await c.env.DB.prepare(
    `UPDATE members SET display_name = ?, bio = ?, repo_url = ?,
       username = COALESCE(?, username) WHERE id = ?`)
    .bind(str(b?.display_name, 40) ?? m.display_name, str(b?.bio, 1000), str(b?.repo_url, 300),
      str(b?.username, 40), m.id).run();
  return c.json({ ok: true });
});

// ---------- admin ----------
app.get("/api/admin/applications", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT id, username, display_name, email, repo_url, statement, status, reason, created_at
     FROM applications ORDER BY created_at DESC`).all();
  return c.json({ applications: results });
});

app.post("/api/admin/applications/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const action = b?.action;
  if (action !== "approve" && action !== "reject") return err(c, 400, "action must be approve or reject");
  const a = await c.env.DB.prepare(`SELECT * FROM applications WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!a) return err(c, 404, "application not found");
  if (a.status !== "pending") return err(c, 409, "already reviewed");
  if (action === "approve") {
    const r = await c.env.DB.prepare(
      `INSERT INTO members (username, display_name, email, repo_url, bio, password_hash, salt)
       VALUES (?,?,?,?,?,?,?)`)
      .bind(a.username, a.display_name, a.email, a.repo_url, null, a.password_hash, a.salt).run();
    await c.env.DB.prepare(
      `INSERT INTO notifications (member_id, text) VALUES (?, ?)`)
      .bind(r.meta.last_row_id, "Your application has been approved. Welcome to Starisle.").run();
    await c.env.DB.prepare(`UPDATE applications SET status = 'approved' WHERE id = ?`).bind(a.id).run();
  } else {
    await c.env.DB.prepare(`UPDATE applications SET status = 'rejected', reason = ? WHERE id = ?`)
      .bind(str(b?.reason, 500) ?? "No reason given.", a.id).run();
  }
  return c.json({ ok: true });
});

app.get("/api/admin/projects", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, m.username AS owner_username FROM projects p JOIN members m ON m.id = p.owner_id
     WHERE p.status = 'pending' ORDER BY p.created_at`).all();
  return c.json({ projects: results });
});

app.post("/api/admin/projects/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const action = b?.action;
  if (!["approve", "reject", "changes"].includes(action)) return err(c, 400, "bad action");
  const p = await c.env.DB.prepare(`SELECT * FROM projects WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!p) return err(c, 404, "project not found");
  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
  await c.env.DB.prepare(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(status, p.id).run();
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text) VALUES (?, ?)`)
    .bind(p.owner_id, `Your project "${p.name}" was ${status}. ${str(b?.reason, 300) ?? ""}`.trim()).run();
  return c.json({ ok: true });
});

app.get("/api/admin/enrollments", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.status, m.username, m.display_name, cu.title FROM enrollments e
     JOIN members m ON m.id = e.member_id JOIN courses cu ON cu.id = e.course_id
     WHERE e.status = 'pending'`).all();
  return c.json({ enrollments: results });
});

app.post("/api/admin/enrollments/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const status = b?.action === "approve" ? "approved" : "rejected";
  const e = await c.env.DB.prepare(`SELECT * FROM enrollments WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!e) return err(c, 404, "not found");
  await c.env.DB.prepare(`UPDATE enrollments SET status = ? WHERE id = ?`).bind(status, e.id).run();
  return c.json({ ok: true });
});

export default app;
