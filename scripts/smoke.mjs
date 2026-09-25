// End-to-end API smoke test. Usage: BASE=http://localhost:3000 bun scripts/smoke.mjs
// Covers public reads, detail payloads, the auth funnel, and member actions
// (likes, comments). Exits non-zero on the first failed assertion group.

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
let failures = 0;

const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};
const get = (path, opts) => fetch(BASE + path, opts).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const run = async () => {
  console.log(`smoke against ${BASE}\n[public reads]`);

  const health = await get("/api/health");
  ok("GET /api/health", health.status === 200 && health.body?.ok === true);

  const home = await fetch(BASE + "/");
  ok("GET / serves the SPA", home.status === 200 && (await home.text()).includes("星屿"));

  const stats = await get("/api/stats");
  ok("GET /api/stats", stats.status === 200 && typeof stats.body?.members === "number");

  const projects = await get("/api/projects");
  const p0 = projects.body?.projects?.[0];
  ok("GET /api/projects", projects.status === 200 && !!p0?.slug);

  const pd = await get(`/api/projects/${p0.slug}`);
  ok("GET /api/projects/:slug", pd.status === 200 && !!pd.body?.project && Array.isArray(pd.body.updates)
    && typeof pd.body.likes_count === "number", `likes_count=${pd.body?.likes_count}`);

  const courses = await get("/api/courses");
  ok("GET /api/courses", courses.status === 200 && Array.isArray(courses.body?.courses));

  const columns = await get("/api/columns");
  const c0 = columns.body?.columns?.[0];
  ok("GET /api/columns", columns.status === 200 && !!c0?.slug);

  const cd = await get(`/api/columns/${c0.slug}`);
  ok("GET /api/columns/:slug", cd.status === 200 && !!cd.body?.column && typeof cd.body.likes_count === "number");

  const members = await get("/api/members");
  ok("GET /api/members", members.status === 200 && Array.isArray(members.body?.members));

  const profile = await get(`/api/members/${encodeURIComponent("林小满")}`);
  ok("GET /api/members/:username (profile)", profile.status === 200
    && Array.isArray(profile.body?.followers) && Array.isArray(profile.body?.activity));

  for (const ep of ["/api/mentors", "/api/activities", "/api/resources", "/api/feed", "/api/stream"]) {
    const r = await get(ep);
    ok(`GET ${ep}`, r.status === 200 && r.body !== null);
  }

  const docs = await get("/api/search/docs");
  ok("GET /api/search/docs", docs.status === 200 && Array.isArray(docs.body?.docs)
    && docs.body.docs.length > 0 && docs.body.docs.length === Object.keys(docs.body.meta ?? {}).length,
    `${docs.body?.docs?.length} docs`);

  const search = await get(`/api/search?q=${encodeURIComponent("河")}`);
  ok("GET /api/search?q=河", search.status === 200 && Array.isArray(search.body?.projects));

  console.log("\n[auth funnel]");
  const email = `ci-${Date.now()}@example.com`;
  const otp = await get("/api/auth/email-otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, purpose: "register" }) });
  const code = otp.body?.dev;
  ok("POST /api/auth/email-otp (dev code)", otp.status === 200 && /^\d{6}$/.test(code ?? ""));
  const uname = `ci-${Date.now().toString(36)}`;
  const reg = await get("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: uname, password: "ci-password-123", display_name: "CI", email, statement: "automated smoke test application", age: 16, email_otp: code, consent_privacy: true, consent_public: true }) });
  ok("POST /api/auth/register", reg.status === 201 && !!reg.body?.token);
  const status = await get("/api/auth/application/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: uname, password: "ci-password-123" }) });
  ok("POST /api/auth/application/status", status.status === 200 && status.body?.status === "pending");

  console.log("\n[member actions]");
  const login = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "林小满", password: "starisle-dev" }) });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  ok("POST /api/auth/login (demo member)", login.status === 200 && cookie.includes("sid="));
  const authed = (path, opts = {}) => get(path, { ...opts, headers: { "content-type": "application/json", cookie, ...(opts.headers ?? {}) } });

  const dash = await authed("/api/my/dashboard");
  ok("GET /api/my/dashboard", dash.status === 200 && Array.isArray(dash.body?.feed) && Array.isArray(dash.body?.notifications));

  const like1 = await authed("/api/likes/toggle", { method: "POST", body: JSON.stringify({ target_type: "project", target_id: pd.body.project.id }) });
  const like2 = await authed("/api/likes/toggle", { method: "POST", body: JSON.stringify({ target_type: "project", target_id: pd.body.project.id }) });
  ok("POST /api/likes/toggle on+off", like1.status === 200 && like1.body?.liked === true
    && like2.status === 200 && like2.body?.liked === false && like2.body.count === like1.body.count - 1);

  const comment = await authed("/api/comments", { method: "POST", body: JSON.stringify({ target_type: "project", target_id: pd.body.project.id, text: "smoke test comment" }) });
  ok("POST /api/comments (project)", comment.status === 201 && comment.body?.status === "pending");
  const clist = await authed(`/api/comments/list?target=${pd.body.project.id}&type=project`);
  ok("GET /api/comments/list (project)", clist.status === 200
    && clist.body.comments.some((cm) => cm.text === "smoke test comment" && typeof cm.likes_count === "number"));

  const homework = await authed("/api/my/homework");
  ok("GET /api/my/homework", homework.status === 200 && Array.isArray(homework.body?.pending));

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
