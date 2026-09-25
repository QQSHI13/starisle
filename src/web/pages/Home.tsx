import { Link } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch, timeAgo, useReveal } from "../hooks";
import { I } from "../icons";
import { useMe } from "../App";
import { api } from "../api";
import { useEffect, useState } from "react";

type Project = {
  slug: string; name: string; tagline: string; domain_name: string | null;
  domain_color: string | null; member_count: number; updated_at: string;
  owner_display: string; gaps?: string[];
};

export function ProjectCard({ p }: { p: Project }) {
  const { t, lang } = useLang();
  return (
    <Link className="card" to={`/projects/${p.slug}`}>
      {(p as any).poster_url && <img className="card-poster" src={(p as any).poster_url} alt="" loading="lazy" />}
      <h3>{p.name}</h3>
      {p.tagline && <p className="tagline">{p.tagline}</p>}
      <div className="meta">
        {p.domain_name && <span className="pill">{p.domain_name}</span>}
        <span>{p.owner_display}</span>
        <span><I name="users" size={12} /> {p.member_count} {t.members_n}</span>
        <span><I name="clock" size={12} /> {timeAgo(p.updated_at, lang)}</span>
        {p.gaps?.map((g) => <span key={g} className="pill gap">{t.open_role} · {g}</span>)}
      </div>
    </Link>
  );
}

function CommandCenter() {
  const { t, lang } = useLang();
  const { me } = useMe();
  const [dash, setDash] = useState<any>(null);
  const [site, setSite] = useState<any>(null);
  useEffect(() => { api("/my/dashboard").then(setDash).catch(() => {}); }, []);
  useEffect(() => {
    if (me && me.role !== "member") api("/stats").then(setSite).catch(() => {});
  }, [me]);
  if (!dash) return <div className="loading">{t.loading}</div>;
  const zh = lang === "zh";
  const un = dash.notifications.filter((n: any) => !n.read).length;
  const stats = [
    { icon: "bell", n: un, label: zh ? "未读消息" : "Unread", hot: un > 0 },
    { icon: "folder", n: dash.projects.filter((p: any) => p.status === "pending").length, label: zh ? "审核中的项目" : "Projects pending", hot: false },
    { icon: "cap", n: dash.homework.pending.length, label: zh ? "待交作业" : "Homework due", hot: dash.homework.pending.length > 0 },
    { icon: "inbox", n: dash.join_requests.length, label: zh ? "加入申请" : "Join requests", hot: dash.join_requests.length > 0 },
  ];
  const community = site ? [
    { icon: "users", n: site.members, label: zh ? "社区成员" : "Members" },
    { icon: "folder", n: site.projects, label: zh ? "进行中的项目" : "Projects" },
    { icon: "book", n: site.courses, label: zh ? "门课程" : "Courses" },
    { icon: "calendar", n: site.activities, label: zh ? "场活动" : "Events" },
  ] : null;
  const quicks = [
    { icon: "user", to: "/me", label: zh ? "个人中心" : "My account", sub: zh ? "资料、消息与通知" : "Profile & messages" },
    { icon: "trend", to: "/stream", label: zh ? "社区动态" : "Stream", sub: zh ? "项目进展与专栏" : "Updates & columns" },
    { icon: "folder", to: "/projects", label: zh ? "浏览项目" : "Projects", sub: zh ? "成员们的开源作品" : "Open-source work" },
    { icon: "book", to: "/courses", label: zh ? "我的课程" : "Courses", sub: zh ? "课节与作业" : "Lessons & homework" },
  ];
  const section = (icon: string, title: string, children: any) => (
    <section className="block reveal"><div className="wrap">
      <div className="block-head"><h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><I name={icon} size={20} />{title}</h2></div>
      {children}
    </div></section>
  );
  return (<>
    <section className="hero" style={{ padding: "64px 0 48px" }}><div className="wrap">
      <p className="kicker">{zh ? "指挥中心" : "Command center"}</p>
      <h1 style={{ fontSize: 40 }}>{zh ? `欢迎回来，` : "Welcome back, "}{me?.display_name}。</h1>
      <div className="stat-cards">
        {stats.map((s) => (
          <div className={`stat-card${s.hot ? " hot" : ""}`} key={s.label}>
            <I name={s.icon} size={16} />
            <b>{s.n}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      {community && (
        <div className="stat-cards community">
          {community.map((s) => (
            <div className="stat-card" key={s.label}>
              <I name={s.icon} size={16} />
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="quick-grid">
        {quicks.map((q) => (
          <Link className="quick" to={q.to} key={q.to}>
            <I name={q.icon} size={18} />
            <span className="qt"><b>{q.label}</b><small>{q.sub}</small></span>
            <span className="qgo">→</span>
          </Link>
        ))}
      </div>
    </div></section>
    {(dash.feed ?? []).length > 0 && section("trend", zh ? "动态" : "Your feed", (
      <div className="feed-list">
        {dash.feed.map((f: any, i: number) => (
          <div className="feed-item" key={i}>
            <I name={f.kind === "project" ? "folder" : "trend"} size={15} />
            <span className="feed-body">
              <b>{f.actor}</b>{" "}
              {f.kind === "project" ? (zh ? "发起了项目" : "started") : (zh ? "发布了进展" : "posted an update")}{" "}
              <Link to={`/projects/${f.slug}`} className="feed-subject">{f.subject}</Link>
              {f.text ? <span className="feed-text">{f.text.length > 120 ? f.text.slice(0, 120) + "…" : f.text}</span> : null}
            </span>
            <span className="feed-time">{String(f.at).slice(0, 16)}</span>
          </div>
        ))}
      </div>
    ))}
    {section("folder", t.my_projects, dash.projects.length === 0 ? (
      <div className="empty"><b>{zh ? "还没有项目" : "No projects yet"}</b>{zh ? "去项目广场看看同龄人在做什么，或从个人中心发起第一个项目。" : "Browse what others are building, or start your first project from your account page."}<br /><Link className="btn small" style={{ marginTop: 14 }} to="/projects">{zh ? "浏览项目" : "Browse projects"} →</Link></div>
    ) : dash.projects.map((p: any) => (
      <div className="member-row" key={p.slug}><span className="dname" style={{ fontSize: 16 }}><Link to={`/projects/${p.slug}`}>{p.name}</Link></span>
        {p.status === "pending" && <span className="pill gold">{t.pending_review}</span>}<span className="bio">{p.tagline}</span></div>
    )))}
    {dash.homework.pending.length > 0 && section("cap", lang === "zh" ? "待交作业" : "Homework due", dash.homework.pending.map((h: any) => (
      <div className="member-row" key={h.id}><span className="pill gold">{lang === "zh" ? "待提交" : "due"}</span><span className="bio" style={{ flex: 1 }}><b>{h.title}</b> · {h.course_title}（{h.due_at?.slice(0, 10) ?? "—"}）</span></div>
    )))}
    {dash.join_requests.length > 0 && section("inbox", lang === "zh" ? "待处理的加入申请" : "Join requests", dash.join_requests.map((r: any) => (
      <div className="member-row" key={r.id}><span className="dname" style={{ fontSize: 15 }}>{r.requester_name}</span><span className="bio" style={{ flex: 1 }}>{r.name} — {r.message || "（无留言）"}</span>
        <button className="btn small primary" onClick={async () => { await api(`/my/join-requests/${r.id}`, { method: "POST", body: JSON.stringify({ action: "approve" }) }); location.reload(); }}>{t.approve}</button>{" "}
        <button className="btn small danger" onClick={async () => { await api(`/my/join-requests/${r.id}`, { method: "POST", body: JSON.stringify({ action: "reject" }) }); location.reload(); }}>{t.reject}</button></div>
    )))}
  </>);
}

export default function Home() {
  const { me } = useMe();
  if (me) return <CommandCenter />;
  const { t, lang } = useLang();
  const { data: stats } = useFetch<{ members: number; projects: number; courses: number; activities: number }>("/stats");
  const { data: proj } = useFetch<{ projects: Project[] }>("/projects");
  const { data: courseData } = useFetch<{ courses: any[] }>("/courses");
  const { data: colData } = useFetch<{ columns: any[] }>("/columns");
  const { data: feed } = useFetch<{ updates: any[]; projects: any[]; events: any[] }>("/feed");
  const featured = proj?.projects?.slice(0, 4) ?? [];
  useReveal();
  const statItems = [
    [stats?.members, t.stat_members], [stats?.projects, t.stat_projects],
    [stats?.courses, t.stat_courses], [stats?.activities, t.stat_activities],
  ].filter(([n]) => typeof n === "number" && n > 0) as [number, string][];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="masthead">
            <span>星屿院刊 · STARISLE JOURNAL</span>
            <span>{new Date().toISOString().slice(0, 10)} · 第 1 期</span>
          </div>
          <p className="kicker" style={{ marginTop: 26 }}>{t.hero_kicker}</p>
          <div className="hero-grid">
            <div>
              <h1>{t.hero_title_a}<br /><em>{t.hero_title_b}</em></h1>
              <p className="lede">{t.hero_body}</p>
              <div className="cta">
                <Link className="btn primary" to="/projects">{t.hero_cta_projects}</Link>
                <Link className="btn" to="/apply">{t.hero_cta_apply}</Link>
              </div>
              <div className="trust">
                <span><Star />{t.trust_repo}</span>
                <span><Star />{t.trust_scope}</span>
                <span><Star />{t.trust_review}</span>
              </div>
            </div>
            {statItems.length > 0 && (
              <div className="hero-stats">
                {statItems.map(([n, label]) => (
                  <div key={label}><b>{n}</b><span>{label}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="block reveal">
        <div className="wrap">
          <div className="block-head">
            <h2><span className="sec-num">01</span><I name="folder" size={19} /> {t.featured}</h2>
            <Link className="more" to="/projects">{t.all_projects} →</Link>
          </div>
          <div className="grid">
            {featured.map((p) => <ProjectCard key={p.slug} p={p} />)}
          </div>
        </div>
      </section>

      <section className="block reveal">
        <div className="wrap">
          <div className="block-head">
            <h2><span className="sec-num">02</span><I name="cap" size={19} /> {t.courses_title}</h2>
            <Link className="more" to="/courses">{t.all_projects} →</Link>
          </div>
          <div className="grid">
            {(courseData?.courses ?? []).slice(0, 3).map((c) => (
              <Link className="card" key={c.slug} to={`/courses/${c.slug}`}>
                <h3>{c.title}</h3>
                <p className="tagline">{c.summary}</p>
                <div className="meta">
                  {!!c.featured && <span className="pill gold">{t.featured_badge}</span>}
                  <span>{c.instructors}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="block reveal">
        <div className="wrap">
          <div className="block-head"><h2><span className="sec-num">03</span><I name="trend" size={19} /> {lang === "zh" ? "社区动态" : "Community pulse"}</h2></div>
          <div className="grid">
            {(feed?.updates ?? []).map((u, i) => (
              <Link className="card" key={i} to={`/projects/${u.project_slug}`}>
                <span className="pill">{u.project_name}</span>
                <p className="tagline" style={{ color: "var(--ink)", fontSize: 14.5 }}>{u.text}</p>
                <div className="meta"><span>{u.author}</span><span>{u.created_at.slice(0, 16)}</span></div>
              </Link>
            ))}
            {(feed?.projects ?? []).map((pr) => (
              <Link className="card" key={pr.slug} to={`/projects/${pr.slug}`}>
                <span className="pill gold">{lang === "zh" ? "新项目" : "New project"}</span>
                <h3>{pr.name}</h3>
                <div className="meta"><span>{pr.owner}</span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="block reveal">
        <div className="wrap">
          <div className="block-head">
            <h2><span className="sec-num">04</span><I name="pen" size={19} /> {t.columns_title}</h2>
            <Link className="more" to="/columns">{t.all_projects} →</Link>
          </div>
          <div className="grid">
            {(colData?.columns ?? []).map((c) => (
              <Link className="card" key={c.slug} to={`/columns/${c.slug}`}>
                <span className="pill gold">{c.slug === "dean-letter-2026" ? "刊首语" : c.column_label}</span>
                <h3>{c.title}</h3>
                <p className="tagline">{c.subtitle}</p>
                <div className="meta"><span>{c.author}</span><span>{c.published_at}</span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

const Star = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2 14.3 9.7 21.8 12 14.3 14.3 12 21.8 9.7 14.3 2.2 12 9.7 9.7Z" /></svg>
);

