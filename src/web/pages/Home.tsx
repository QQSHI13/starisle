import { Link } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch, timeAgo } from "../hooks";
import { I } from "../icons";

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

export default function Home() {
  const { t, lang } = useLang();
  const { data: stats } = useFetch<{ members: number; projects: number; courses: number; activities: number }>("/stats");
  const { data: proj } = useFetch<{ projects: Project[] }>("/projects");
  const { data: courseData } = useFetch<{ courses: any[] }>("/courses");
  const { data: colData } = useFetch<{ columns: any[] }>("/columns");
  const featured = proj?.projects?.slice(0, 4) ?? [];
  const statItems = [
    [stats?.members, t.stat_members], [stats?.projects, t.stat_projects],
    [stats?.courses, t.stat_courses], [stats?.activities, t.stat_activities],
  ].filter(([n]) => typeof n === "number" && n > 0) as [number, string][];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="kicker">{t.hero_kicker}</p>
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

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <h2><span className="sec-num">01</span>{t.featured}</h2>
            <Link className="more" to="/projects">{t.all_projects} →</Link>
          </div>
          <div className="grid">
            {featured.map((p) => <ProjectCard key={p.slug} p={p} />)}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <h2><span className="sec-num">02</span>{t.courses_title}</h2>
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

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <h2><span className="sec-num">03</span>{t.columns_title}</h2>
            <Link className="more" to="/columns">{t.all_projects} →</Link>
          </div>
          <div className="grid">
            {(colData?.columns ?? []).map((c) => (
              <Link className="card" key={c.slug} to={`/columns/${c.slug}`}>
                {c.title !== c.column_label && <span className="pill gold">{c.column_label}</span>}
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
