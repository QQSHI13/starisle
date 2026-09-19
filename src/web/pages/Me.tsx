import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../i18n";
import { api } from "../api";
import { useMe } from "../App";
import { useFetch } from "../hooks";

export default function Me() {
  const { t } = useLang();
  const nav = useNavigate();
  const { me, refresh } = useMe();
  const { data: proj } = useFetch<{ projects: any[] }>(me ? "/my/projects" : null, [me?.id]);
  const { data: notif } = useFetch<{ notifications: any[] }>(me ? "/notifications" : null, [me?.id]);
  const { data: enroll } = useFetch<{ enrollments: any[] }>(me ? "/my/courses" : null, [me?.id]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { if (me === null) nav("/login"); }, [me]);

  if (!me) return null;
  return (
    <div className="wrap" style={{ padding: "64px 24px" }}>
      <div className="page-head" style={{ padding: "0 0 28px" }}>
        <h1 style={{ margin: 0 }}>{me.display_name}</h1>
        <p className="sub">@{me.username}{me.role === "admin" ? " · admin" : ""}</p>
      </div>

      <section style={{ padding: "36px 0" }}>
        <div className="block-head"><h2>{t.notifications}</h2></div>
        {(notif?.notifications ?? []).length === 0 && <p className="dim">—</p>}
        {(notif?.notifications ?? []).map((n) => (
          <div className="member-row" key={n.id}>
            <span className={n.read ? "bio" : "dname"} style={n.read ? {} : { fontSize: 14 }}>{n.text}</span>
            <span className="bio">{n.created_at}</span>
          </div>
        ))}
      </section>

      <section style={{ padding: "0 0 36px" }}>
        <div className="block-head">
          <h2>{t.my_projects}</h2>
          <button className="btn small" onClick={() => setShowNew(!showNew)}>{t.new_project}</button>
        </div>
        {showNew && <ProjectForm onDone={() => { setShowNew(false); location.reload(); }} />}
        {(proj?.projects ?? []).map((p) => (
          <div key={p.slug} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 18, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Link to={`/projects/${p.slug}`} className="serif" style={{ fontSize: 17 }}>{p.name}</Link>
                {p.status === "pending" && <span className="pill gold" style={{ marginLeft: 10 }}>{t.pending_review}</span>}
                <p className="dim" style={{ margin: "6px 0 0", fontSize: 13 }}>{p.tagline}</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <button className="btn small" onClick={() => setEditing(editing === p.slug ? null : p.slug)}>{t.edit}</button>
              </div>
            </div>
            {editing === p.slug && (
              <ProjectForm existing={p} onDone={() => { setEditing(null); location.reload(); }} />
            )}
          </div>
        ))}
      </section>

      <section style={{ padding: "0 0 36px" }}>
        <div className="block-head"><h2>{t.enrollments}</h2></div>
        {(enroll?.enrollments ?? []).length === 0 && <p className="dim">—</p>}
        {(enroll?.enrollments ?? []).map((e) => (
          <div className="member-row" key={e.slug + e.created_at}>
            <span className="dname" style={{ fontSize: 15 }}>{e.title}</span>
            <span className="pill">{e.status}</span>
          </div>
        ))}
      </section>

      <ProfileForm me={me} onSaved={refresh} />
    </div>
  );
}

function ProjectForm({ existing, onDone }: { existing?: any; onDone: () => void }) {
  const { t } = useLang();
  const [f, setF] = useState({
    name: existing?.name ?? "", tagline: existing?.tagline ?? "", body: existing?.body ?? "",
    repo_url: existing?.repo_url ?? "", demo_url: existing?.demo_url ?? "", poster_url: existing?.poster_url ?? "", domain_id: existing?.domain_id ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const { data: domData } = useFetch<{ domains: any[] }>("/domains");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      if (existing) await api(`/my/projects/${existing.slug}`, { method: "PUT", body: JSON.stringify(f) });
      else await api("/my/projects", { method: "POST", body: JSON.stringify(f) });
      onDone();
    } catch (e: any) { setErr(String(e.message)); }
  };
  const del = async () => {
    if (!existing || !confirm("Delete this project?")) return;
    try { await api(`/my/projects/${existing.slug}`, { method: "DELETE" }); onDone(); }
    catch (e: any) { setErr(String(e.message)); }
  };
  return (
    <form onSubmit={submit} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 20, margin: "14px 0" }}>
      {err && <div className="error-box" role="alert">{err}</div>}
      <label className="field"><span>{t.project_name}</span>
        <input type="text" required value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field"><span>{t.tagline}</span>
        <input type="text" value={f.tagline} onChange={(e: any) => setF({ ...f, tagline: e.target.value })} /></label>
      <label className="field"><span>{t.description}</span>
        <textarea rows={3} value={f.body} onChange={(e: any) => setF({ ...f, body: e.target.value })} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="field"><span>{t.repo}</span>
          <input type="text" value={f.repo_url} onChange={(e: any) => setF({ ...f, repo_url: e.target.value })} /></label>
        <label className="field"><span>{t.demo}</span>
          <input type="text" value={f.demo_url} onChange={(e: any) => setF({ ...f, demo_url: e.target.value })} /></label>
        <label className="field"><span>展板图片 URL · Poster image URL</span>
          <input type="text" value={f.poster_url} onChange={(e: any) => setF({ ...f, poster_url: e.target.value })} /></label>
      </div>
      <label className="field"><span>{t.all_domains}</span>
        <select value={f.domain_id} onChange={(e: any) => setF({ ...f, domain_id: e.target.value })}>
          <option value="">—</option>
          {(domData?.domains ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
      <button className="btn primary" type="submit">{t.save}</button>
      {existing && <button className="btn danger" type="button" style={{ marginLeft: 8 }} onClick={del}>{t.delete}</button>}
    </form>
  );
}

function ProfileForm({ me, onSaved }: { me: any; onSaved: () => void }) {
  const { t } = useLang();
  const [f, setF] = useState({ display_name: me.display_name, bio: me.bio ?? "", repo_url: me.repo_url ?? "" });
  const [msg, setMsg] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api("/me", { method: "PUT", body: JSON.stringify(f) });
    setMsg(true); onSaved();
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480 }}>
      <h3 style={{ fontFamily: "var(--serif)" }}>{t.me_title}</h3>
      {msg && <div className="notice" role="status">OK</div>}
      <label className="field"><span>{t.display_name}</span>
        <input type="text" value={f.display_name} onChange={(e: any) => setF({ ...f, display_name: e.target.value })} /></label>
      <label className="field"><span>Bio</span>
        <textarea rows={3} value={f.bio} onChange={(e: any) => setF({ ...f, bio: e.target.value })} /></label>
      <label className="field"><span>{t.repo_url}</span>
        <input type="text" value={f.repo_url} onChange={(e: any) => setF({ ...f, repo_url: e.target.value })} /></label>
      <button className="btn" type="submit">{t.save}</button>
    </form>
  );
}
