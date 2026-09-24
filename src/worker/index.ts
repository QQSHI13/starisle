import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";
import type { D1Database } from "@cloudflare/workers-types";

type Bindings = { DB: D1Database; ASSETS: Fetcher };
type Member = {
  id: number; username: string; display_name: string; email: string | null;
  bio: string | null; repo_url: string | null; avatar: string | null;
  role: string; status: string; created_at: string;
  password_hash: string; salt: string;
  is_minor?: number; real_name_public?: number; verified?: number;
};

const app = new Hono<{ Bindings: Bindings & { COOKIE_SECURE?: string } }>();
app.use(secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
  },
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  crossOriginResourcePolicy: false,
}));
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
    m.username AS owner_username, m.display_name AS owner_display, m.real_name_public AS owner_name_public
  FROM projects p
  LEFT JOIN domains d ON d.id = p.domain_id
  JOIN members m ON m.id = p.owner_id`;
const redactOwner = (rows: any[], isAdmin: boolean, meUsername: string | null) =>
  rows.map((r: any) => ({
    ...r,
    owner_username: r.owner_name_public || isAdmin || r.owner_username === meUsername ? r.owner_username : null,
    owner_name_public: undefined,
  }));

app.get("/api/projects", async (c) => {
  const q = c.req.query("q")?.trim();
  const domain = c.req.query("domain")?.trim();
  let sql = projectCard + ` WHERE p.status = 'approved'`;
  const binds: string[] = [];
  if (q) { sql += ` AND (p.name LIKE ? OR p.tagline LIKE ?)`; binds.push(`%${q}%`, `%${q}%`); }
  if (domain) { sql += ` AND p.domain_id = ?`; binds.push(domain); }
  sql += ` ORDER BY p.featured DESC, datetime(REPLACE(REPLACE(p.updated_at,'T',' '),'Z','')) DESC, p.id DESC`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  const viewer = await currentUser(c);
  return c.json({ projects: redactOwner(results as any[], viewer?.role === "admin", viewer?.username ?? null) });
});

app.get("/api/projects/:slug", async (c) => {
  const viewer = await currentUser(c);
  const raw = await c.env.DB.prepare(projectCard + ` WHERE p.slug = ? AND p.status = 'approved'`)
    .bind(c.req.param("slug")).first<any>();
  if (!raw) return err(c, 404, "project not found");
  const p = redactOwner([raw], viewer?.role === "admin", viewer?.username ?? null)[0];
  const members = await c.env.DB.prepare(
    `SELECT m.username, m.display_name, pm.role FROM project_members pm
     JOIN members m ON m.id = pm.member_id WHERE pm.project_id = ?`).bind(p.id).all();
  const gaps = await c.env.DB.prepare(
    `SELECT label FROM project_gaps WHERE project_id = ?`).bind(p.id).all();
  const stacks = await c.env.DB.prepare(
    `SELECT tag FROM project_stacks WHERE project_id = ? ORDER BY id`).bind(p.id).all();
  const milestones = await c.env.DB.prepare(
    `SELECT text, done FROM project_milestones WHERE project_id = ? ORDER BY sort, id`).bind(p.id).all();
  const followerCount = await c.env.DB.prepare(`SELECT COUNT(*) n FROM project_follows WHERE project_id = ?`).bind(p.id).first<any>();
  const following = viewer ? await c.env.DB.prepare(`SELECT 1 x FROM project_follows WHERE project_id = ? AND member_id = ?`).bind(p.id, viewer.id).first() : null;
  const isMember = viewer && await c.env.DB.prepare(`SELECT 1 x FROM project_members WHERE project_id = ? AND member_id = ?`).bind(p.id, viewer.id).first();
  const isAdmin2 = viewer && viewer.role === "admin";
  const updates = await c.env.DB.prepare(
    `SELECT u.id, u.text, u.status, u.created_at, m.display_name AS author, m.id AS author_id FROM project_updates u
     JOIN members m ON m.id = u.author_id WHERE u.project_id = ? ${isMember || isAdmin2 ? "" : "AND u.status = 'approved' "}
     ORDER BY u.created_at DESC LIMIT 20`).bind(p.id).all();
  const repo_stats = await repoStatsFor(c as any, p);
  return c.json({
    project: p, members: members.results,
    gaps: gaps.results.map((g: any) => g.label),
    stack: stacks.results.map((s: any) => s.tag),
    milestones: milestones.results,
    updates: updates.results,
    followers: followerCount?.n ?? 0,
    following: !!following,
    repo_stats,
  });
});

app.post("/api/projects/:slug/follow", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const p = await c.env.DB.prepare(`SELECT id, owner_id FROM projects WHERE slug = ? AND status='approved'`).bind(c.req.param("slug")).first<any>();
  if (!p) return err(c, 404, "project not found");
  if (p.owner_id === m.id) return err(c, 400, "you own this project");
  await c.env.DB.prepare(`INSERT OR IGNORE INTO project_follows (project_id, member_id) VALUES (?,?)`).bind(p.id, m.id).run();
  return c.json({ ok: true });
});

app.delete("/api/projects/:slug/follow", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const p = await c.env.DB.prepare(`SELECT id FROM projects WHERE slug = ?`).bind(c.req.param("slug")).first<any>();
  if (!p) return err(c, 404, "project not found");
  await c.env.DB.prepare(`DELETE FROM project_follows WHERE project_id = ? AND member_id = ?`).bind(p.id, m.id).run();
  return c.json({ ok: true });
});

app.post("/api/members/:username/follow", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const target = await c.env.DB.prepare(`SELECT id FROM members WHERE username = ? AND status='active'`).bind(c.req.param("username")).first<any>();
  if (!target) return err(c, 404, "member not found");
  if (target.id === m.id) return err(c, 400, "cannot follow yourself");
  await c.env.DB.prepare(`INSERT OR IGNORE INTO member_follows (followee_id, follower_id) VALUES (?,?)`).bind(target.id, m.id).run();
  return c.json({ ok: true });
});

app.delete("/api/members/:username/follow", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  await c.env.DB.prepare(
    `DELETE FROM member_follows WHERE followee_id = (SELECT id FROM members WHERE username = ?) AND follower_id = ?`)
    .bind(c.req.param("username"), m.id).run();
  return c.json({ ok: true });
});

app.post("/api/projects/:slug/updates", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const p = await c.env.DB.prepare(`SELECT id, status FROM projects WHERE slug = ?`).bind(c.req.param("slug")).first<any>();
  if (!p || p.status !== "approved") return err(c, 404, "project not found");
  const member = await c.env.DB.prepare(`SELECT 1 x FROM project_members WHERE project_id = ? AND member_id = ?`).bind(p.id, m.id).first();
  if (!member) return err(c, 403, "only project members can post updates");
  const b = await c.req.json().catch(() => null);
  const text = str(b?.text, 1000);
  if (!text) return err(c, 400, "update text required");
  await c.env.DB.prepare(`INSERT INTO project_updates (project_id, author_id, text, status) VALUES (?,?,?, 'pending')`).bind(p.id, m.id, text).run();
  return c.json({ ok: true, status: "pending" }, 201);
});

app.get("/api/admin/updates", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.text, u.status, u.created_at, p.name AS project_name, p.slug AS project_slug, mem.display_name AS author
     FROM project_updates u JOIN projects p ON p.id = u.project_id JOIN members mem ON mem.id = u.author_id
     WHERE u.status = 'pending' ORDER BY u.created_at`).all();
  return c.json({ updates: results });
});

app.post("/api/admin/updates/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const u = await c.env.DB.prepare(`SELECT * FROM project_updates WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!u) return err(c, 404, "not found");
  const action = b?.action === "approve" ? "approved" : "rejected";
  await c.env.DB.prepare(`UPDATE project_updates SET status = ? WHERE id = ?`).bind(action, u.id).run();
  await c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, ?, ?)`)
    .bind(m.id, `update:${action}`, `update ${u.id} on project ${u.project_id}`).run();
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, 'update')`)
    .bind(u.author_id, `Your project update was ${action}.`).run();
  if (action === "approved") {
    const p2 = await c.env.DB.prepare(`SELECT name FROM projects WHERE id = ?`).bind(u.project_id).first<any>();
    const author = await c.env.DB.prepare(`SELECT display_name FROM members WHERE id = ?`).bind(u.author_id).first<any>();
    await c.env.DB.prepare(
      `INSERT INTO notifications (member_id, text, type)
       SELECT DISTINCT f.member_id, ?, 'update' FROM project_follows f WHERE f.project_id = ? AND f.member_id != ?`)
      .bind(`${author?.display_name} posted an update on "${p2?.name}": ${u.text}`, u.project_id, u.author_id).run();
  }
  return c.json({ ok: true });
});

app.post("/api/projects/:slug/join", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const p = await c.env.DB.prepare(`SELECT * FROM projects WHERE slug = ? AND status = 'approved'`).bind(c.req.param("slug")).first<any>();
  if (!p) return err(c, 404, "project not found");
  const isMember = await c.env.DB.prepare(`SELECT 1 x FROM project_members WHERE project_id = ? AND member_id = ?`).bind(p.id, m.id).first();
  if (isMember) return err(c, 409, "already a member");
  const b = await c.req.json().catch(() => null);
  await c.env.DB.prepare(
    `INSERT INTO join_requests (project_id, member_id, message) VALUES (?,?,?)
     ON CONFLICT (project_id, member_id) DO UPDATE SET message = excluded.message, status = 'pending'`)
    .bind(p.id, m.id, str(b?.message, 500) ?? "").run();
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, ?)`)
    .bind(p.owner_id, `${m.display_name} requested to join "${p.name}". Review: /admin or project members.`, "join").run();
  return c.json({ ok: true }, 201);
});

app.get("/api/my/join-requests", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const { results } = await c.env.DB.prepare(
    `SELECT j.id, j.message, j.status, j.created_at, p.slug, p.name, p.owner_id,
       r.display_name AS requester_name, r.username AS requester_username
     FROM join_requests j JOIN projects p ON p.id = j.project_id JOIN members r ON r.id = j.member_id
     WHERE p.owner_id = ? AND j.status = 'pending' ORDER BY j.created_at DESC`).bind(m.id).all();
  return c.json({ requests: results });
});

app.post("/api/my/join-requests/:id", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const action = b?.action === "approve" ? "approved" : "rejected";
  const j = await c.env.DB.prepare(
    `SELECT j.*, p.owner_id, p.id AS pid, p.name FROM join_requests j JOIN projects p ON p.id = j.project_id WHERE j.id = ?`)
    .bind(Number(c.req.param("id"))).first<any>();
  if (!j || j.owner_id !== m.id) return err(c, 404, "not found");
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE join_requests SET status = ? WHERE id = ?`).bind(action, j.id),
    ...(action === "approved"
      ? [c.env.DB.prepare(`INSERT OR IGNORE INTO project_members (project_id, member_id, role) VALUES (?,?, 'member')`).bind(j.pid, j.member_id)]
      : []),
    c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, ?)`)
      .bind(j.member_id, `Your request to join "${j.name}" was ${action}.`, "join"),
  ]);
  return c.json({ ok: true });
});

app.get("/api/courses", async (c) =>
  c.json({ courses: (await c.env.DB.prepare(`SELECT * FROM courses WHERE status='published' ORDER BY featured DESC, title`).all()).results }));

app.get("/api/courses/:slug", async (c) => {
  const course: any = await c.env.DB.prepare(`SELECT * FROM courses WHERE slug = ? AND status='published'`)
    .bind(c.req.param("slug")).first();
  if (!course) return err(c, 404, "course not found");
  const me = await currentUser(c);
  const enrolled = me ? await c.env.DB.prepare(`SELECT status FROM enrollments WHERE course_id = ? AND member_id = ?`).bind(course.id, me.id).first<any>() : null;
  const canView = !!enrolled && enrolled.status === "approved";
  const isAdmin = me?.role === "admin";
  const lessons = await c.env.DB.prepare(
    `SELECT l.id, l.title, l.summary, l.sort, l.content FROM course_lessons l WHERE l.course_id = ? ORDER BY l.sort, l.id`).bind(course.id).all();
  const homework = await c.env.DB.prepare(
    `SELECT h.id, h.title, h.instructions, h.due_at, l.title AS lesson_title FROM homework h
     JOIN course_lessons l ON l.id = h.lesson_id WHERE l.course_id = ? ORDER BY h.due_at`).bind(course.id).all();
  const submissions = me ? (await c.env.DB.prepare(
    `SELECT s.* FROM submissions s JOIN homework h ON h.id = s.homework_id JOIN course_lessons l ON l.id = h.lesson_id
     WHERE l.course_id = ? AND s.member_id = ?`).bind(course.id, me.id).all()).results : [];
  return c.json({
    course,
    lessons: (lessons.results as any[]).map((l) => ({ ...l, content: canView || isAdmin ? l.content : null })),
    homework: homework.results,
    my_submissions: submissions,
    enrolled: canView,
  });
});

// --- lessons & homework (admin/teachers manage) ---
app.post("/api/admin/courses/:slug/lessons", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const course = await c.env.DB.prepare(`SELECT id FROM courses WHERE slug = ?`).bind(c.req.param("slug")).first<any>();
  if (!course) return err(c, 404, "course not found");
  const b = await c.req.json().catch(() => null);
  const title = str(b?.title, 120);
  if (!title) return err(c, 400, "title required");
  await c.env.DB.prepare(`INSERT INTO course_lessons (course_id, title, summary, content, sort) VALUES (?,?,?,?,?)`)
    .bind(course.id, title, str(b?.summary, 500) ?? "", str(b?.content, 20000) ?? "", Number(b?.sort) || 0).run();
  return c.json({ ok: true }, 201);
});

app.put("/api/admin/lessons/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  await c.env.DB.prepare(`UPDATE course_lessons SET title = ?, summary = ?, content = ?, sort = ? WHERE id = ?`)
    .bind(str(b?.title, 120) ?? "", str(b?.summary, 500) ?? "", str(b?.content, 20000) ?? "", Number(b?.sort) || 0, Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.delete("/api/admin/lessons/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  await c.env.DB.prepare(`DELETE FROM course_lessons WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.post("/api/admin/lessons/:id/homework", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const lesson = await c.env.DB.prepare(`SELECT id, course_id FROM course_lessons WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!lesson) return err(c, 404, "lesson not found");
  const b = await c.req.json().catch(() => null);
  const title = str(b?.title, 120);
  if (!title) return err(c, 400, "title required");
  await c.env.DB.prepare(`INSERT INTO homework (lesson_id, title, instructions, due_at) VALUES (?,?,?,?)`)
    .bind(lesson.id, title, str(b?.instructions, 2000) ?? "", str(b?.due_at, 40)).run();
  await c.env.DB.prepare(
    `INSERT INTO notifications (member_id, text, type)
     SELECT e.member_id, 'New homework in your course: ' || ? , 'course' FROM enrollments e WHERE e.course_id = ? AND e.status = 'approved'`)
    .bind(title, lesson.course_id).run();
  return c.json({ ok: true }, 201);
});

// member homework
app.get("/api/my/homework", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const pending = await c.env.DB.prepare(
    `SELECT h.id, h.title, h.instructions, h.due_at, l.title AS lesson_title, c.title AS course_title
     FROM homework h JOIN course_lessons l ON l.id = h.lesson_id JOIN courses c ON c.id = l.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.member_id = ? AND e.status = 'approved'
     WHERE h.id NOT IN (SELECT homework_id FROM submissions WHERE member_id = ?)
     ORDER BY h.due_at`).bind(m.id, m.id).all();
  const mine = await c.env.DB.prepare(
    `SELECT s.*, h.title AS homework_title, h.due_at, l.title AS lesson_title, c.title AS course_title
     FROM submissions s JOIN homework h ON h.id = s.homework_id JOIN course_lessons l ON l.id = h.lesson_id
     JOIN courses c ON c.id = l.course_id WHERE s.member_id = ? ORDER BY s.created_at DESC`).bind(m.id).all();
  return c.json({ pending: pending.results, mine: mine.results });
});

app.post("/api/my/homework/:id/submit", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const hw = await c.env.DB.prepare(
    `SELECT h.id, l.course_id FROM homework h JOIN course_lessons l ON l.id = h.lesson_id WHERE h.id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!hw) return err(c, 404, "homework not found");
  const enrolled = await c.env.DB.prepare(`SELECT 1 x FROM enrollments WHERE course_id = ? AND member_id = ? AND status = 'approved'`).bind(hw.course_id, m.id).first();
  if (!enrolled) return err(c, 403, "enrollment required to submit homework");
  const b = await c.req.json().catch(() => null);
  const repo = str(b?.repo_url, 300);
  if (!repo) return err(c, 400, "repo/submission link required");
  await c.env.DB.prepare(
    `INSERT INTO submissions (homework_id, member_id, repo_url, note) VALUES (?,?,?,?)
     ON CONFLICT (homework_id, member_id) DO UPDATE SET repo_url = excluded.repo_url, note = excluded.note, status = 'pending', created_at = datetime('now')`)
    .bind(hw.id, m.id, repo, str(b?.note, 1000) ?? "").run();
  return c.json({ ok: true }, 201);
});

// admin grading
app.get("/api/admin/submissions", async (c) => {
  const m = await currentUser(c);
  if (!isStaff(m)) return err(c, 403, "staff only");
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, mem.display_name, mem.username, h.title AS homework_title, l.title AS lesson_title, c.title AS course_title
     FROM submissions s JOIN members mem ON mem.id = s.member_id JOIN homework h ON h.id = s.homework_id
     JOIN course_lessons l ON l.id = h.lesson_id JOIN courses c ON c.id = l.course_id
     ORDER BY s.status = 'pending' DESC, s.created_at DESC LIMIT 100`).all();
  return c.json({ submissions: results });
});

app.post("/api/admin/submissions/:id", async (c) => {
  const m = await currentUser(c);
  if (!isStaff(m)) return err(c, 403, "staff only");
  const b = await c.req.json().catch(() => null);
  const s = await c.env.DB.prepare(`SELECT * FROM submissions WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!s) return err(c, 404, "not found");
  const action = b?.action === "approve" ? "approved" : "rejected";
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE submissions SET status = ?, feedback = ? WHERE id = ?`).bind(action, str(b?.feedback, 500) ?? "", s.id),
    c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, 'course')`).bind(s.member_id, `Your homework submission was ${action}${b?.feedback ? `: ${b.feedback}` : "."}`),
    c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'grade', ?)`).bind(m!.id, `submission ${s.id} -> ${action}`),
  ]);
  return c.json({ ok: true });
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

app.get("/api/members", async (c) => {
  const viewer = await currentUser(c);
  const showName = !!viewer && viewer.role === "admin";
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.username, m.display_name, m.bio, m.website_url, m.avatar, m.verified, m.real_name_public, m.created_at,
       (SELECT COUNT(*) FROM project_members pm JOIN projects p ON p.id = pm.project_id
         WHERE pm.member_id = m.id AND p.status='approved') AS project_count
     FROM members m WHERE m.status = 'active' ORDER BY m.created_at DESC`).all();
  return c.json({ members: (results as any[]).map((m) => ({ ...m, username: m.real_name_public || showName ? m.username : null })) });
});

app.get("/api/members/:username", async (c) => {
  const key = c.req.param("username");
  const viewer = await currentUser(c);
  const isAdmin = !!viewer && viewer.role === "admin";
  const m: any = await c.env.DB.prepare(
    `SELECT id, username, display_name, bio, website_url, avatar, verified, real_name_public, created_at FROM members
     WHERE (username = ? OR id = ?) AND status = 'active'`).bind(key, /^(\d+)$/.test(key) ? Number(key) : -1).first();
  if (!m) return err(c, 404, "member not found");
  if (!m.real_name_public && !isAdmin && (!viewer || viewer.username !== m.username)) m.username = null;
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
  const age = Number(b.age);
  if (!Number.isInteger(age) || age < 8 || age > 100) return err(c, 400, "please provide a valid age");
  const isMinor = age < 18 ? 1 : 0;
  const under14 = age < 14;
  const guardianName = str(b.guardian_name, 60);
  const guardianContact = str(b.guardian_contact, 120);
  if (under14 && (!guardianName || !guardianContact))
    return err(c, 400, "under 14 requires guardian name and contact for verification");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(c, 400, "invalid email");
  const emailOtp = String(b?.email_otp ?? "");
  if (!emailOtp || !(await checkOtp(c.env.DB, email, "register", emailOtp)))
    return err(c, 400, "a valid 6-digit email verification code is required (request one below the form)");
  const taken = await c.env.DB.prepare(`SELECT 1 x FROM members WHERE username = ? UNION SELECT 1 FROM applications WHERE username = ?`)
    .bind(username, username).first();
  if (taken) return err(c, 409, "username already taken");
  const salt = newToken();
  const hash = await hashPassword(password, salt);
  const token = newToken();
  await c.env.DB.prepare(
    `INSERT INTO applications (username, display_name, email, repo_url, statement, password_hash, salt, token, is_minor, guardian_name, guardian_contact)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(username, display, email, repo, statement, hash, salt, token, isMinor, guardianName, guardianContact).run();
  await c.env.DB.prepare(`UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = 'register'`).bind(email).run();
  await c.env.DB.prepare(`UPDATE applications SET email_verified = 1 WHERE username = ?`).bind(username).run();
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
    secure: c.env.COOKIE_SECURE !== "0",
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
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const ua = (c.req.header("User-Agent") ?? "").slice(0, 120);
  if (m.last_login_ip !== ip) {
    await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, 'security')`)
      .bind(m.id, `新的登录：来自 ${ip}${ua ? `（${ua}）` : ""}。如果不是你本人操作，请立即修改密码。`).run();
  }
  await c.env.DB.prepare(`UPDATE members SET last_login_ip = ?, last_login_at = datetime('now') WHERE id = ?`).bind(ip, m.id).run();
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
  if (!m) return c.json({ member: null });
  const { password_hash, salt, ...safe } = m;
  return c.json({ member: safe });
});

app.post("/api/me/deactivate", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  if ((await hashPassword(String(b?.password ?? ""), m.salt)) !== m.password_hash)
    return err(c, 403, "password required to deactivate");
  const owned = await c.env.DB.prepare(
    `SELECT COUNT(*) n FROM projects p JOIN project_members pm ON pm.project_id = p.id
     WHERE p.owner_id = ? AND pm.member_id != ?`).bind(m.id, m.id).first<any>();
  if ((owned?.n ?? 0) > 0) return err(c, 409, "withdraw other members from your projects first");
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sessions WHERE member_id = ?`).bind(m.id),
    c.env.DB.prepare(`UPDATE members SET status = 'deactivated', bio = NULL, website_url = NULL, avatar = NULL WHERE id = ?`).bind(m.id),
  ]);
  return c.json({ ok: true });
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

app.get("/api/comments/list", async (c) => {
  const target = Number(c.req.query("target"));
  if (!target) return err(c, 400, "target required");
  const me = await currentUser(c);
  const sql = me
    ? `SELECT cm.*, m.display_name, m.avatar FROM comments cm JOIN members m ON m.id = cm.author_id
       WHERE cm.target_type = 'column' AND cm.target_id = ? AND (cm.status = 'approved' OR cm.author_id = ?) ORDER BY cm.created_at`
    : `SELECT cm.*, m.display_name, m.avatar FROM comments cm JOIN members m ON m.id = cm.author_id
       WHERE cm.target_type = 'column' AND cm.target_id = ? AND cm.status = 'approved' ORDER BY cm.created_at`;
  const { results } = await c.env.DB.prepare(sql).bind(...(me ? [target, me.id] : [target])).all();
  return c.json({ comments: results });
});

app.post("/api/comments", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const text = str(b?.text, 2000);
  const targetId = Number(b?.target_id);
  if (!text || !targetId) return err(c, 400, "text and target required");
  await c.env.DB.prepare(`INSERT INTO comments (target_type, target_id, author_id, text) VALUES ('column',?,?,?)`)
    .bind(targetId, m.id, text).run();
  return c.json({ ok: true, status: "pending" }, 201);
});

app.get("/api/admin/comments", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT cm.*, mem.display_name AS author, col.title AS column_title FROM comments cm
     JOIN members mem ON mem.id = cm.author_id LEFT JOIN columns col ON col.id = cm.target_id
     WHERE cm.status = 'pending' ORDER BY cm.created_at`).all();
  return c.json({ comments: results });
});

app.post("/api/admin/comments/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const status = b?.action === "approve" ? "approved" : "rejected";
  const cm = await c.env.DB.prepare(`SELECT * FROM comments WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!cm) return err(c, 404, "not found");
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE comments SET status = ? WHERE id = ?`).bind(status, cm.id),
    c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, 'general')`)
      .bind(cm.author_id, `Your comment was ${status}.`),
    c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'comment', ?)`)
      .bind(m.id, `comment ${cm.id} -> ${status}`),
  ]);
  return c.json({ ok: true });
});

app.delete("/api/admin/columns/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  await c.env.DB.prepare(`DELETE FROM columns WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

const isStaff = (m: any): boolean => !!m && (m.role === "admin" || m.role === "teacher");

// ---------- DM (allowed only if at least one side is teacher/admin) ----------
app.get("/api/dm", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const withKey = c.req.query("with");
  if (withKey) {
    const other: any = await c.env.DB.prepare(`SELECT id, username, display_name, avatar, role FROM members WHERE (username = ? OR id = ?) AND status = 'active'`)
      .bind(withKey, /^\d+$/.test(withKey) ? Number(withKey) : -1).first();
    if (!other) return err(c, 404, "member not found");
    if (!isStaff(m) && !isStaff(other)) return err(c, 403, "messages require a teacher or admin on one side");
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY created_at LIMIT 200`)
      .bind(m.id, other.id, other.id, m.id).all();
    await c.env.DB.prepare(`UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ?`).bind(other.id, m.id).run();
    return c.json({ with: other, messages: results });
  }
  const { results } = await c.env.DB.prepare(
    `SELECT mem.id, mem.username, mem.display_name, mem.role,
       (SELECT text FROM messages x WHERE (x.from_id = mem.id AND x.to_id = ?) OR (x.from_id = ? AND x.to_id = mem.id) ORDER BY x.created_at DESC LIMIT 1) AS last_text,
       (SELECT created_at FROM messages x WHERE (x.from_id = mem.id AND x.to_id = ?) OR (x.from_id = ? AND x.to_id = mem.id) ORDER BY x.created_at DESC LIMIT 1) AS last_at,
       (SELECT COUNT(*) FROM messages x WHERE x.from_id = mem.id AND x.to_id = ? AND x.read = 0) AS unread
     FROM messages msg JOIN members mem ON mem.id = CASE WHEN msg.from_id = ? THEN msg.to_id ELSE msg.from_id END
     WHERE msg.from_id = ? OR msg.to_id = ?
     GROUP BY mem.id ORDER BY last_at DESC`).bind(m.id, m.id, m.id, m.id, m.id, m.id, m.id, m.id).all();
  return c.json({ conversations: results });
});

app.post("/api/dm", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const text = str(b?.text, 2000);
  const toUsername = str(b?.to, 60);
  if (!text || !toUsername) return err(c, 400, "to and text required");
  const other: any = await c.env.DB.prepare(`SELECT id, role, status FROM members WHERE (username = ? OR CAST(id AS TEXT) = ?) AND status = 'active'`)
    .bind(toUsername, toUsername).first();
  if (!other) return err(c, 404, "member not found");
  if (!isStaff(m) && !isStaff(other)) return err(c, 403, "messages require a teacher or admin on one side");
  await c.env.DB.prepare(`INSERT INTO messages (from_id, to_id, text) VALUES (?,?,?)`).bind(m.id, other.id, text).run();
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, 'dm')`)
    .bind(other.id, `${m.display_name} 给你发了一条私信。`).run();
  return c.json({ ok: true }, 201);
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

app.get("/api/feed", async (c) => {
  const updates = await c.env.DB.prepare(
    `SELECT u.text, u.created_at, m.display_name AS author, p.name AS project_name, p.slug AS project_slug
     FROM project_updates u JOIN projects p ON p.id = u.project_id AND p.status = 'approved'
     JOIN members m ON m.id = u.author_id WHERE u.status = 'approved'
     ORDER BY u.created_at DESC LIMIT 6`).all();
  const projects = await c.env.DB.prepare(
    `SELECT p.name, p.slug, p.tagline, m.display_name AS owner, p.created_at FROM projects p
     JOIN members m ON m.id = p.owner_id WHERE p.status = 'approved'
     ORDER BY p.created_at DESC LIMIT 3`).all();
  const events = await c.env.DB.prepare(
    `SELECT title, starts_at FROM activities WHERE starts_at >= datetime('now') ORDER BY starts_at LIMIT 2`).all();
  return c.json({ updates: updates.results, projects: projects.results, events: events.results });
});

app.get("/api/showcase", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, poster_url FROM projects WHERE status = 'approved' AND poster_url IS NOT NULL ORDER BY updated_at DESC`).all();
  return c.json({ posters: results });
});

// ---------- repository stats (server-side, cached 6h in D1) ----------
async function fetchRepoStats(repoUrl: string): Promise<Record<string, unknown> | null> {
  try {
    const u = new URL(repoUrl);
    let api: string | null = null;
    const gh = u.hostname === "github.com" && u.pathname.match(/^\/([^/]+)\/([^/]+)/);
    const gt = u.hostname === "gitee.com" && u.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (gh) api = `https://api.github.com/repos/${gh[1]}/${gh[2]}`;
    else if (gt) api = `https://gitee.com/api/v5/repos/${gt[1]}/${gt[2]}`;
    if (!api) return null;
    const r = await fetch(api, {
      headers: { "User-Agent": "starisle-demo", Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return { error: `upstream ${r.status}` };
    const d: any = await r.json();
    return {
      host: gh ? "github" : "gitee",
      stars: d.stargazers_count ?? d.stargazers ?? 0,
      forks: d.forks_count ?? d.forks ?? 0,
      open_issues: d.open_issues_count ?? 0,
      language: d.language ?? null,
      last_push: d.pushed_at ?? d.pushed_at ?? null,
      license: d.license?.spdx_id ?? d.license?.name ?? null,
      description: d.description ?? null,
    };
  } catch {
    return null;
  }
}

async function repoStatsFor(c: { env: Bindings; executionCtx?: ExecutionContext }, project: any) {
  if (!project.repo_url) return null;
  const cached = await c.env.DB.prepare(
    `SELECT data, fetched_at FROM repo_cache WHERE project_id = ?`).bind(project.id).first<any>();
  const fresh = cached && cached.fetched_at > new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 19).replace("T", " ");
  if (fresh) return JSON.parse(cached.data);
  // stale or missing: refresh in the background, serve what we have (never block the page on upstream)
  const refresh = (async () => {
    const stats = await fetchRepoStats(project.repo_url);
    if (stats && !stats.error) {
      await c.env.DB.prepare(
        `INSERT INTO repo_cache (project_id, data, fetched_at) VALUES (?,?, datetime('now'))
         ON CONFLICT (project_id) DO UPDATE SET data = excluded.data, fetched_at = datetime('now')`)
        .bind(project.id, JSON.stringify(stats)).run();
    }
  })();
  if (cached) c.executionCtx?.waitUntil(refresh);
  else await refresh;
  const after = await c.env.DB.prepare(`SELECT data FROM repo_cache WHERE project_id = ?`).bind(project.id).first<any>();
  return after ? JSON.parse(after.data) : null;
}

// --- email OTP ---
async function sendEmail(to: string, subject: string, text: string): Promise<{ dev?: string }> {
  const webhook = process_env.EMAIL_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, text }) });
    return {};
  }
  console.log(`[dev-email] to=${to} subject=${subject}\n${text}`);
  const m = text.match(/(\d{6})/);
  return { dev: m?.[1] };
}
const process_env: any = (globalThis as any).process?.env ?? {};

app.post("/api/auth/email-otp", async (c) => {
  if (rateLimited(c.req.header("CF-Connecting-IP") ?? "local")) return err(c, 429, "too many attempts, wait a minute");
  const b = await c.req.json().catch(() => null);
  const email = str(b?.email, 120);
  const purpose = b?.purpose === "reset" ? "reset" : "register";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(c, 400, "valid email required");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await hashPassword(code, "otp-static-salt");
  await c.env.DB.prepare(`UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = ?`).bind(email, purpose).run();
  await c.env.DB.prepare(`INSERT INTO otp_codes (email, purpose, code_hash, expires_at) VALUES (?,?,?, datetime('now', '+10 minutes'))`).bind(email, purpose, hash).run();
  const sent = await sendEmail(email, `Starisle ${purpose === "reset" ? "password reset" : "verification"} code: ${code}`, `Your code is ${code}. Valid 10 minutes.`);
  return c.json({ ok: true, ...sent });
});

async function checkOtp(DB: D1Database, email: string, purpose: string, code: string): Promise<boolean> {
  const row = await DB.prepare(`SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC`).bind(email, purpose).first<any>();
  return !!row && (await hashPassword(code, "otp-static-salt")) === row.code_hash;
}

app.post("/api/auth/recover-email", async (c) => {
  const b = await c.req.json().catch(() => null);
  const email = str(b?.email, 120);
  const code = String(b?.code ?? "");
  const password = typeof b?.password === "string" ? b.password : "";
  if (!email || !code || password.length < 8 || password.length > 72) return err(c, 400, "email, code and a new password (8–72) required");
  if (!(await checkOtp(c.env.DB, email, "reset", code))) return err(c, 403, "invalid or expired code");
  const m = await c.env.DB.prepare(`SELECT * FROM members WHERE email = ? AND status = 'active'`).bind(email).first<any>();
  if (!m) return err(c, 404, "no account with this email");
  const salt = newToken();
  const hash = await hashPassword(password, salt);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = 'reset'`).bind(email),
    c.env.DB.prepare(`UPDATE members SET password_hash = ?, salt = ? WHERE id = ?`).bind(hash, salt, m.id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE member_id = ?`).bind(m.id),
    c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, 'security')`).bind(m.id, "你的密码已通过邮箱验证码重置。"),
  ]);
  return c.json({ ok: true });
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
     VALUES (?,?,?,?,?,?,?,?,'pending',?)`)
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

app.post("/api/notifications/:id/save", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  await c.env.DB.prepare(`UPDATE notifications SET saved = 1 - saved WHERE id = ? AND member_id = ?`).bind(Number(c.req.param("id")), m.id).run();
  return c.json({ ok: true });
});

app.post("/api/notifications/:id/read", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  await c.env.DB.prepare(`UPDATE notifications SET read = 1 - read WHERE id = ? AND member_id = ?`).bind(Number(c.req.param("id")), m.id).run();
  return c.json({ ok: true });
});

app.delete("/api/notifications/:id", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  await c.env.DB.prepare(`DELETE FROM notifications WHERE id = ? AND member_id = ?`).bind(Number(c.req.param("id")), m.id).run();
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
  if (b?.real_name_public !== undefined && typeof b.real_name_public === "boolean") {
    if (m.is_minor && b.real_name_public) return err(c, 403, "minors cannot make their real name public");
    await c.env.DB.prepare(`UPDATE members SET real_name_public = ? WHERE id = ?`).bind(b.real_name_public ? 1 : 0, m.id).run();
  }
  await c.env.DB.prepare(
    `UPDATE members SET display_name = ?, bio = ?, repo_url = ?, website_url = ?,
       username = COALESCE(?, username) WHERE id = ?`)
    .bind(str(b?.display_name, 40) ?? m.display_name, str(b?.bio, 1000), str(b?.repo_url, 300),
      str(b?.website_url, 300) ?? null, str(b?.username, 40), m.id).run();
  return c.json({ ok: true });
});

// ---------- admin ----------
app.get("/api/admin/applications", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT id, username, display_name, email, repo_url, statement, status, reason, is_minor, guardian_name, guardian_contact, email_verified, created_at
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
  if (action === "approve" && !a.email_verified) return err(c, 409, "email not verified — ask the applicant to verify, or reject");
  if (action === "approve") {
    const r = await c.env.DB.prepare(
      `INSERT INTO members (username, display_name, email, repo_url, bio, password_hash, salt)
       VALUES (?,?,?,?,?,?,?)`)
      .bind(a.username, a.display_name, a.email, a.repo_url, null, a.password_hash, a.salt).run();
    await c.env.DB.prepare(`UPDATE members SET is_minor = ?, guardian_name = ?, guardian_contact = ? WHERE username = ?`)
      .bind(a.is_minor, a.guardian_name, a.guardian_contact, a.username).run();
    await c.env.DB.prepare(
      `INSERT INTO notifications (member_id, text, type) VALUES (?, ?, ?)`)
      .bind(r.meta.last_row_id, "Your application has been approved. Welcome to Starisle.", "application").run();
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
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, ?)`)
    .bind(p.owner_id, `Your project "${p.name}" was ${status}. ${str(b?.reason, 300) ?? ""}`.trim(), "project").run();
  return c.json({ ok: true });
});

app.post("/api/reports", async (c) => {
  const m = await currentUser(c);
  if (!m) return err(c, 401, "not logged in");
  const b = await c.req.json().catch(() => null);
  const type = str(b?.target_type, 20);
  const id = Number(b?.target_id);
  if (!type || !id) return err(c, 400, "target required");
  await c.env.DB.prepare(`INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?,?,?,?)`)
    .bind(m.id, type, id, str(b?.reason, 500) ?? "").run();
  return c.json({ ok: true }, 201);
});

app.get("/api/admin/reports", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, mem.display_name AS reporter FROM reports r JOIN members mem ON mem.id = r.reporter_id
     ORDER BY r.status = 'pending' DESC, r.created_at DESC`).all();
  return c.json({ reports: results });
});

app.post("/api/admin/reports/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const action = b?.action === "uphold" ? "upheld" : "dismissed";
  const r = await c.env.DB.prepare(`SELECT * FROM reports WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!r) return err(c, 404, "not found");
  let detail = `report ${r.id} (${r.target_type} ${r.target_id}): ${action}`;
  if (action === "upheld") {
    if (r.target_type === "update") await c.env.DB.prepare(`DELETE FROM project_updates WHERE id = ?`).bind(r.target_id).run();
    if (r.target_type === "project") await c.env.DB.prepare(`UPDATE projects SET status = 'rejected' WHERE id = ?`).bind(r.target_id).run();
    if (r.target_type === "member") await c.env.DB.prepare(`UPDATE members SET bio = NULL, avatar = NULL WHERE id = ?`).bind(r.target_id).run();
    detail += " — content removed";
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE reports SET status = ? WHERE id = ?`).bind(action, r.id),
    c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'report', ?)`).bind(m.id, detail),
  ]);
  return c.json({ ok: true });
});

app.post("/api/admin/members/:id/status", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const status = b?.status === "deactivated" ? "deactivated" : "active";
  const t = await c.env.DB.prepare(`SELECT id FROM members WHERE id = ? AND role != 'admin'`).bind(Number(c.req.param("id"))).first();
  if (!t) return err(c, 404, "not found (or is an admin)");
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE members SET status = ? WHERE id = ?`).bind(status, t.id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE member_id = ?`).bind(t.id),
    c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'member-status', ?)`).bind(m.id, `member ${t.id} -> ${status}`),
  ]);
  return c.json({ ok: true });
});

app.post("/api/admin/broadcast", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const text = str(b?.text, 500);
  if (!text) return err(c, 400, "text required");
  const audience = b?.audience === "minors" ? "AND is_minor = 1" : b?.audience === "adults" ? "AND is_minor = 0" : b?.audience === "verified" ? "AND verified = 1" : "";
  const r = await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) SELECT id, ?, 'announce' FROM members WHERE status = 'active' ${audience}`).bind(text).run();
  await c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'broadcast', ?)`).bind(m.id, `audience=${b?.audience ?? "all"} rows=${r.meta.changes}`).run();
  return c.json({ ok: true, notified: r.meta.changes });
});

app.get("/api/admin/export", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const grab = async (sql: string) => (await c.env.DB.prepare(sql).all()).results;
  const data = {
    exported_at: new Date().toISOString(),
    members: await grab(`SELECT id, username, display_name, email, role, status, is_minor, guardian_name, guardian_contact, verified, created_at FROM members`),
    projects: await grab(`SELECT p.*, m.username AS owner_username FROM projects p JOIN members m ON m.id = p.owner_id`),
    applications: await grab(`SELECT * FROM applications`),
    reports: await grab(`SELECT * FROM reports`),
    audit_log: await grab(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 500`),
  };
  await c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'export', 'full data export')`).bind(m.id).run();
  return c.json(data);
});

app.delete("/api/admin/applications/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  await c.env.DB.prepare(`DELETE FROM applications WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.get("/api/admin/members", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT mem.id, mem.username, mem.display_name, mem.email, mem.is_minor, mem.guardian_name,
       mem.guardian_contact, mem.verified, mem.status, mem.created_at,
       (SELECT COUNT(*) FROM project_members pm WHERE pm.member_id = mem.id) AS project_count
     FROM members mem ORDER BY mem.created_at DESC`).all();
  return c.json({ members: results });
});

app.get("/api/admin/audit", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, mem.display_name AS actor FROM audit_log a LEFT JOIN members mem ON mem.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT 100`).all();
  return c.json({ entries: results });
});

app.post("/api/admin/members/:id/role", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const role = ["member", "teacher", "admin"].includes(b?.role) ? b.role : null;
  if (!role) return err(c, 400, "role must be member/teacher/admin");
  const t = await c.env.DB.prepare(`SELECT id, role FROM members WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!t) return err(c, 404, "not found");
  if (t.role === "admin" && role !== "admin") return err(c, 409, "cannot demote an admin");
  await c.env.DB.prepare(`UPDATE members SET role = ? WHERE id = ?`).bind(role, t.id).run();
  await c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'role', ?)`).bind(m.id, `member ${t.id} -> ${role}`).run();
  return c.json({ ok: true });
});

app.post("/api/admin/members/:id/verify", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const t = await c.env.DB.prepare(`SELECT verified FROM members WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!t) return err(c, 404, "not found");
  await c.env.DB.prepare(`UPDATE members SET verified = ? WHERE id = ?`).bind(t.verified ? 0 : 1, Number(c.req.param("id"))).run();
  await c.env.DB.prepare(`INSERT INTO audit_log (actor_id, action, detail) VALUES (?, 'verify', ?)`)
    .bind(m.id, `member ${c.req.param("id")} verified=${t.verified ? 0 : 1}`).run();
  return c.json({ verified: t.verified ? 0 : 1 });
});

app.post("/api/admin/activities", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const title = str(b?.title, 120);
  if (!title) return err(c, 400, "title required");
  await c.env.DB.prepare(`INSERT INTO activities (title, description, starts_at, location) VALUES (?,?,?,?)`)
    .bind(title, str(b?.description, 1000) ?? "", str(b?.starts_at, 40), str(b?.location, 120)).run();
  return c.json({ ok: true }, 201);
});

app.delete("/api/admin/activities/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  await c.env.DB.prepare(`DELETE FROM activities WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.post("/api/admin/resources", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const name = str(b?.name, 120);
  if (!name) return err(c, 400, "name required");
  await c.env.DB.prepare(`INSERT INTO resources (name, description, status) VALUES (?,?, 'available')`)
    .bind(name, str(b?.description, 1000) ?? "").run();
  return c.json({ ok: true }, 201);
});

app.delete("/api/admin/resources/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  await c.env.DB.prepare(`DELETE FROM resources WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.post("/api/admin/projects/:id/feature", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const p = await c.env.DB.prepare(`SELECT featured FROM projects WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!p) return err(c, 404, "not found");
  await c.env.DB.prepare(`UPDATE projects SET featured = ? WHERE id = ?`).bind(p.featured ? 0 : 1, Number(c.req.param("id"))).run();
  return c.json({ featured: p.featured ? 0 : 1 });
});

app.post("/api/admin/columns", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const title = str(b?.title, 200);
  const text = str(b?.text, 20000);
  if (!title || !text) return err(c, 400, "title and text required");
  const slug = "col-" + Math.random().toString(36).slice(2, 8);
  await c.env.DB.prepare(
    `INSERT INTO columns (slug, column_label, title, subtitle, author, author_title, text) VALUES (?,?,?,?,?,?,?)`)
    .bind(slug, str(b?.column_label, 60) ?? "社区投稿", title, str(b?.subtitle, 300) ?? "", m.display_name, "", text).run();
  return c.json({ slug }, 201);
});

app.post("/api/admin/announce", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const text = str(b?.text, 500);
  if (!text) return err(c, 400, "text required");
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) SELECT id, ?, 'announce' FROM members WHERE status = 'active'`).bind(text).run();
  return c.json({ ok: true }, 201);
});

app.get("/api/admin/mentor-requests", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.interest, r.background, r.questions, r.status, r.created_at,
       mem.display_name AS member_name, mem.username AS member_username, mt.name AS mentor_name
     FROM mentor_requests r JOIN members mem ON mem.id = r.member_id JOIN mentors mt ON mt.id = r.mentor_id
     ORDER BY r.created_at DESC`).all();
  return c.json({ requests: results });
});

app.post("/api/admin/mentor-requests/:id", async (c) => {
  const m = await currentUser(c);
  if (!m || m.role !== "admin") return err(c, 403, "admin only");
  const b = await c.req.json().catch(() => null);
  const action = b?.action === "approve" ? "approved" : b?.action === "contacted" ? "contacted" : "rejected";
  const r = await c.env.DB.prepare(`SELECT * FROM mentor_requests WHERE id = ?`).bind(Number(c.req.param("id"))).first<any>();
  if (!r) return err(c, 404, "not found");
  await c.env.DB.prepare(`UPDATE mentor_requests SET status = ? WHERE id = ?`).bind(action, r.id).run();
  await c.env.DB.prepare(`INSERT INTO notifications (member_id, text, type) VALUES (?, ?, ?)`)
    .bind(r.member_id, `Your mentoring request was marked "${action}".`, "mentor").run();
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

// SPA fallback: non-API GET requests receive the app shell.
// (Asset requests for real files are served by the assets runtime before this runs.)
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api/")) return c.notFound();
  const index = await c.env.ASSETS.fetch(new URL("/index.html", c.req.url));
  return new Response(index.body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
