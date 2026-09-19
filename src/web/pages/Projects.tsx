import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { ProjectCard } from "./Home";

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
  const { data: showcase } = useFetch<{ posters: any[] }>("/showcase");

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
        {showcase && showcase.posters.length > 0 && (
          <>
            <h3 style={{ margin: "56px 0 20px" }}>2026 {lang === "zh" ? "届结业项目展板" : "Graduation Showcase"}</h3>
            <div className="showcase">
              {showcase.posters.map((p) => (
                <figure key={p.slug}>
                  <a href={p.poster_url} target="_blank" rel="noreferrer">
                    <img src={p.poster_url} alt={p.name} loading="lazy" />
                  </a>
                  <figcaption>{p.name}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </div></section>
    </>
  );
}

export function ProjectDetail() {
  const { slug } = useParams();
  const { t } = useLang();
  const { data, error } = useFetch<{ project: any; members: any[]; gaps: string[] }>(`/projects/${slug}`, [slug]);
  if (error) return <div className="err-full">{error}</div>;
  if (!data) return <div className="loading">{t.loading}</div>;
  const p = data.project;
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{p.domain_name ?? t.nav_projects}</p>
        <h1>{p.name}</h1>
        {p.tagline && <p className="sub">{p.tagline}</p>}
      </div></div>
      <section className="block"><div className="wrap">
        <dl className="kv">
          <dt>{t.owner}</dt><dd>{p.owner_display}（{p.owner_username}）</dd>
          {p.repo_url && (<><dt>{t.repo}</dt><dd><a href={p.repo_url} target="_blank" rel="noreferrer">{p.repo_url}</a></dd></>)}
          {p.demo_url && (<><dt>{t.demo}</dt><dd><a href={p.demo_url} target="_blank" rel="noreferrer">{p.demo_url}</a></dd></>)}
          <dt>{t.contributors}</dt>
          <dd>{data.members.map((m) => m.display_name).join("、") || "—"}</dd>
        </dl>
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
