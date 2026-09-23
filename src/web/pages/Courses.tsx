import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { api } from "../api";
import { useMe } from "../App";

export function Courses() {
  const { t } = useLang();
  const { data } = useFetch<{ courses: any[] }>("/courses");
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_courses}</p>
        <h1>{t.courses_title}</h1>
        <p className="sub">{t.courses_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        <div className="grid">
          {(data?.courses ?? []).map((c) => (
            <Link className="card" key={c.slug} to={`/courses/${c.slug}`}>
              <div>
                {!!c.featured && <span className="pill gold" style={{ marginRight: 8 }}>{t.featured_badge}</span>}
                <span className="pill">{c.subject}</span>
              </div>
              <h3>{c.title}</h3>
              <p className="tagline">{c.summary}</p>
              <div className="meta">
                <span>{c.instructors}</span>
                <span>{c.total_hours ? `${c.total_hours} ${t.hours}` : "—"} · {c.lesson_count} {t.lessons}</span>
              </div>
            </Link>
          ))}
        </div>
      </div></section>
    </>
  );
}

export function CourseDetail() {
  const { slug } = useParams();
  const { t } = useLang();
  const { me, refresh } = useMe();
  const { data } = useFetch<{ course: any }>(`/courses/${slug}`, [slug]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <div className="loading">{t.loading}</div>;
  const c = data.course;
  const apply = async () => {
    setErr(null); setMsg(null);
    try {
      await api("/my/courses", { method: "POST", body: JSON.stringify({ course_id: c.id }) });
      setMsg(t.submitted); refresh();
    } catch (e: any) { setErr(String(e.message)); }
  };
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{c.subject}</p>
        <h1>{c.title}</h1>
        <p className="sub">{c.summary}</p>
      </div></div>
      <section className="block"><div className="wrap">
        <dl className="kv">
          <dt>{t.nav_mentors}</dt><dd>{c.instructors}</dd>
          <dt>{t.courses_title}</dt>
          <dd>{c.total_hours ? `${c.total_hours} ${t.hours}` : "—"} · {c.lesson_count} {t.lessons}</dd>
        </dl>
        {err && <div className="error-box" role="alert">{err}</div>}
        {msg && <div className="notice" role="status">{msg}</div>}
        <h3 style={{ marginTop: 30 }}>{t.nav_courses} · {c.lesson_count} {t.lessons}</h3>
        <p className="dim" style={{ fontSize: 14 }}>课程大纲对所有人可见；报名并开通后可在站内查看各节内容与课件安排。</p>
        {me && <button className="btn primary" onClick={apply} style={{ marginTop: 8 }}>{t.apply_course}</button>}
      </div></section>
    </>
  );
}
