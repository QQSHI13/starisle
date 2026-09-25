import { useState } from "react";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { api } from "../api";
import { useMe } from "../App";
import { Avatar } from "../Avatar";
import { I } from "../icons";

export default function Mentors() {
  const { t } = useLang();
  const { me } = useMe();
  const { data } = useFetch<{ mentors: any[] }>("/mentors");
  const { data: courseData } = useFetch<{ courses: any[] }>("/courses");
  const [course, setCourse] = useState("");
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [form, setForm] = useState({ interest: "", background: "", questions: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const courseName = (title: string) =>
    courseData?.courses?.find((c) => c.title === title || c.subject === title)?.title ?? title;

  const submit = async (mentorId: number) => {
    setErr(null); setMsg(null);
    try {
      await api("/my/mentor-requests", { method: "POST", body: JSON.stringify({ mentor_id: mentorId, ...form }) });
      setMsg(t.submitted); setOpenFor(null); setForm({ interest: "", background: "", questions: "" });
    } catch (e: any) { setErr(String(e.message)); }
  };

  const mentors = (data?.mentors ?? []).filter((m) => {
    if (!course) return true;
    return (m.courses ?? []).some((mc: any) => courseName(mc.course_title ?? mc.title) === course || (mc.course_title ?? mc.title) === course);
  });

  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_mentors}</p>
        <h1>{t.mentors_title}</h1>
        <p className="sub">{t.mentors_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        <div className="toolbar">
          <select value={course} onChange={(e) => setCourse(e.target.value)} style={{ width: "auto" }} aria-label={t.nav_courses}>
            <option value="">{t.nav_courses} · ALL</option>
            {(courseData?.courses ?? []).map((c) => <option key={c.slug} value={c.title}>{c.title}</option>)}
          </select>
        </div>
        {err && <div className="error-box" role="alert">{err}</div>}
        {msg && <div className="notice" role="status">{msg}</div>}
        <div className="grid align-start">
          {mentors.map((m) => (
            <div className="card" key={m.id}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={m.name} /> {m.name}</h3>
              <span className="pill">{m.title}</span>
              <p className="tagline">{m.bio}</p>
              {me && (
                openFor === m.id ? (
                  <div style={{ marginTop: 8 }}>
                    <label className="field"><span>{t.your_interest}</span>
                      <input type="text" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} /></label>
                    <label className="field"><span>{t.your_background}</span>
                      <input type="text" value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} /></label>
                    <label className="field"><span>{t.your_questions}</span>
                      <textarea rows={2} value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} /></label>
                    <button className="btn primary small" onClick={() => submit(m.id)}><I name="send" size={13} />{t.submit}</button>
                    <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setOpenFor(null)}><I name="x" size={13} />×</button>
                  </div>
                ) : (
                  <button className="btn small" style={{ marginTop: "auto" }} onClick={() => setOpenFor(m.id)}><I name="spark" size={13} />{t.request_mentor}</button>
                )
              )}
            </div>
          ))}
        </div>
      </div></section>
    </>
  );
}
