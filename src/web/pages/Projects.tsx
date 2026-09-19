import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { ProjectCard } from "./Home";
import { I } from "../icons";
import { Avatar } from "../Avatar";

export function Projects() {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (domain) p.set("domain", domain);
    const s = p.toString();
    return "/projects" + (s ? `?${s}` : "");
  }, [q, domain]);
  const { data, error } = useFetch<{ projects: any[] }>(query, [query]);
  const { data: domData } = useFetch<{ domains: any[] }>("/domains");

  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_projects}</p>
        <h1>{t.all_projects}</h1>
      </div></div>
      <section className="block"><div className="wrap">
        <div className="toolbar">
          <input
            type="text" placeholder={t.search_placeholder} value={q}
            onChange={(e) => setQ(e.target.value)} aria-label={t.search_placeholder}
          />
          <select value={domain} onChange={(e) => setDomain(e.target.value)} style={{ width: "auto" }} aria-label={t.all_domains}>
            <option value="">{t.all_domains}</option>
            {(domData?.domains ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="grid">
          {(data?.projects ?? []).map((p) => <ProjectCard key={p.slug} p={p} />)}
        </div>
        {data && data.projects.length === 0 && <div className="empty"><b>∅</b>{t.no_items}</div>}
              </div></section>
    </>
  );
}

export function ProjectDetail() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const { data, error } = useFetch<{ project: any; members: any[]; gaps: string[]; stack: string[]; milestones: any[]; repo_stats: any }>(`/projects/${slug}`, [slug]);
  if (error) return <div className="err-full">{error}</div>;
  if (!data) return <div className="loading">{t.loading}</div>;
  const p = data.project;
  const rs = data.repo_stats;
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{p.domain_name ?? t.nav_projects}</p>
        <h1>{p.name}</h1>
        {p.tagline && <p className="sub">{p.tagline}</p>}
        {p.poster_url && <img className="detail-poster" src={p.poster_url} alt={`${p.name} 展板`} />}
      </div></div>
      <section className="block"><div className="wrap">
        {data.stack.length > 0 && (
          <p>{data.stack.map((s) => <span key={s} className="pill" style={{ marginRight: 8 }}>{s}</span>)}</p>
        )}
        <dl className="kv">
          <dt><I name="star" />{t.owner}</dt><dd>{p.owner_display}（{p.owner_username}）</dd>
          {p.repo_url && (<><dt><I name="repo" />{t.repo}</dt><dd><a href={p.repo_url} target="_blank" rel="noreferrer">{p.repo_url}</a></dd></>)}
          {p.demo_url && (<><dt><I name="play" />{t.demo}</dt><dd><a href={p.demo_url} target="_blank" rel="noreferrer">{p.demo_url}</a></dd></>)}
          <dt><I name="users" />{t.contributors}</dt>
          <dd style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {data.members.map((m) => (
              <span key={m.username} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Avatar name={m.display_name || m.username} size={24} />
                {m.display_name}{m.role === "owner" ? ` · ${t.owner}` : ""}
              </span>
            ))}
          </dd>
        </dl>
        {rs && !rs.error && (
          <>
            <h3>{lang === "zh" ? "仓库实况" : "Repository pulse"}</h3>
            <div className="stats" style={{ marginTop: 12 }}>
              <div><b>{rs.stars}</b><span><I name="star" size={12} /> {lang === "zh" ? "星标" : "stars"}</span></div>
              <div><b>{rs.forks}</b><span><I name="fork" size={12} /> {lang === "zh" ? "分支" : "forks"}</span></div>
              {rs.language && <div><b style={{ fontSize: 20 }}>{rs.language}</b><span>{lang === "zh" ? "主要语言" : "main language"}</span></div>}
              {rs.last_push && <div><b style={{ fontSize: 20 }}>{rs.last_push.slice(0, 10)}</b><span><I name="clock" size={12} /> {lang === "zh" ? "最近提交" : "last push"}</span></div>}
            </div>
          </>
        )}
        {data.milestones.length > 0 && (
          <>
            <h3 style={{ marginTop: 40 }}>{lang === "zh" ? "里程碑" : "Milestones"}</h3>
            <div>
              {data.milestones.map((m, i) => (
                <div key={i} className={`mstone${m.done ? " done" : ""}`}>
                  <I name={m.done ? "check" : "circle"} size={16} />
                  <span className="mtext">{m.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {data.gaps.length > 0 && (
          <>
            <h3>{t.gaps_title}</h3>
            <p>{data.gaps.map((g) => <span key={g} className="pill gap" style={{ marginRight: 8 }}>{g}</span>)}</p>
          </>
        )}
        {p.body && <div className="prose" style={{ padding: "24px 0" }}><p>{p.body}</p></div>}
      </div></section>
    </>
  );
}
