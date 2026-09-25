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
  useEffect(() => { api("/my/dashboard").then(setDash).catch(() => {}); }, []);
  if (!dash) return <div className="loading">{t.loading}</div>;
  const un = dash.notifications.filter((n: any) => !n.read).length;
  const section = (icon: string, title: string, children: any) => (
    <section className="block reveal"><div className="wrap">
      <div className="block-head"><h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><I name={icon} size={20} />{title}</h2></div>
      {children}
    </div></section>
  );
  return (<>
    <section className="hero" style={{ padding: "64px 0 40px" }}><div className="wrap">
      <p className="kicker">{lang === "zh" ? "指挥中心" : "Command center"}</p>
      <h1 style={{ fontSize: 40 }}>{lang === "zh" ? `欢迎回来，` : "Welcome back, "}{me?.display_name}。</h1>
      <div className="stats" style={{ marginTop: 34 }}>
        <div><b style={{ color: un ? "var(--gold)" : undefined }}>{un}</b><span><I name="bell" size={12} /> {lang === "zh" ? "未读消息" : "unread"}</span></div>
        <div><b>{dash.projects.filter((p: any) => p.status === "pending").length}</b><span>{lang === "zh" ? "审核中的项目" : "projects pending"}</span></div>
        <div><b>{dash.homework.pending.length}</b><span>{lang === "zh" ? "待交作业" : "homework due"}</span></div>
        <div><b>{dash.join_requests.length}</b><span>{lang === "zh" ? "加入申请" : "join requests"}</span></div>
      </div>
      <div className="cta" style={{ marginTop: 26 }}>
        <Link className="btn primary" to="/me">{lang === "zh" ? "个人中心" : "My account"}</Link>
        <Link className="btn" to="/stream">{lang === "zh" ? "社区动态" : "Stream"}</Link>
        <Link className="btn" to="/projects">{lang === "zh" ? "浏览项目" : "Projects"}</Link>
      </div>
    </div></section>
    {dash.followed_updates.length > 0 && section("trend", lang === "zh" ? "关注项目的最新动态" : "Followed projects", (
      <div className="grid">{dash.followed_updates.map((u: any, i: number) => (
        <Link className="card" key={i} to={`/projects/${u.slug}`}><span className="pill">{u.name}</span><p className="tagline" style={{ color: "var(--ink)" }}>{u.text}</p><div className="meta"><span>{u.author}</span><span>{u.created_at.slice(0, 16)}</span></div></Link>
      ))}</div>
    ))}
    {section("folder", t.my_projects, dash.projects.length === 0 ? <p className="dim">—</p> : dash.projects.map((p: any) => (
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
