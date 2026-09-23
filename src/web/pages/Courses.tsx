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
  const fetchRes = useFetch<{ course: any; lessons: any[]; homework: any[]; my_submissions: any[]; enrolled: boolean }>(`/courses/${slug}`, [slug]);
  const data = fetchRes.data;
  const [repo, setRepo] = useState("");
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
        {(data?.lessons ?? []).length > 0 && (<>
          <h3 style={{ marginTop: 30 }}>课程大纲 · {data!.lessons.length} 节</h3>
          {data!.lessons.map((l) => (
            <div key={l.id} className="mstone">
              <span className="pill">{l.sort || "—"}</span>
              <span className="mtext"><b>{l.title}</b>{l.summary ? ` — ${l.summary}` : ""}
                {l.content ? <span className="dim" style={{ display: "block", fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{l.content}</span> : <span className="dim" style={{ fontSize: 12 }}>（报名开通后可见课件内容）</span>}
              </span>
            </div>
          ))}
        </>)}
        {(data?.homework ?? []).length > 0 && (<>
          <h3 style={{ marginTop: 30 }}>作业</h3>
          {data!.homework.map((h) => {
            const sub = (data!.my_submissions ?? []).find((x: any) => x.homework_id === h.id);
            return (
              <div key={h.id} className="mstone">
                <span className="mtext"><b>{h.title}</b> <span className="dim">({h.lesson_title}{h.due_at ? ` · 截止 ${h.due_at.slice(0, 16)}` : ""})</span>
                  {h.instructions && <span className="dim" style={{ display: "block", fontSize: 13 }}>{h.instructions}</span>}
                  {sub ? <span className="pill" style={{ marginTop: 4 }}>{sub.status === "approved" ? "已通过" : sub.status === "rejected" ? "需修改" : "待批改"}{sub.feedback ? ` · ${sub.feedback}` : ""}</span> : data!.enrolled ? (
                    <form onSubmit={async (e) => { e.preventDefault(); await api(`/my/homework/${h.id}/submit`, { method: "POST", body: JSON.stringify({ repo_url: repo }) }); setRepo(""); refresh(); location.reload(); }} style={{ marginTop: 6, display: "flex", gap: 6 }}>
                      <input type="text" required placeholder="提交仓库/作品链接" value={repo} onChange={(e: any) => setRepo(e.target.value)} style={{ width: 320 }} />
                      <button className="btn small primary">提交</button>
                    </form>
                  ) : <span className="dim" style={{ fontSize: 12 }}>（报名开通后可提交）</span>}
                </span>
              </div>
            );
          })}
        </>)}
        {me && <button className="btn primary" onClick={apply} style={{ marginTop: 8 }}>{t.apply_course}</button>}
      </div></section>
    </>
  );
}
