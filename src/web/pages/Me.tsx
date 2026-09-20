import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../i18n";
import { api } from "../api";
import { useMe } from "../App";
import { useFetch } from "../hooks";
import { ProjectForm } from "./ProjectForm";
import { Avatar } from "../Avatar";

export default function Me() {
  const { t } = useLang();
  const nav = useNavigate();
  const { me, refresh, logout } = useMe();
  const { data: proj } = useFetch<{ projects: any[] }>(me ? "/my/projects" : null, [me?.id]);
  const { data: notif } = useFetch<{ notifications: any[] }>(me ? "/notifications" : null, [me?.id]);
  const { data: enroll } = useFetch<{ enrollments: any[] }>(me ? "/my/courses" : null, [me?.id]);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { if (me === null) nav("/login"); }, [me]);

  if (!me) return null;
  return (
    <div className="wrap" style={{ padding: "64px 24px" }}>
      <div className="page-head" style={{ padding: "0 0 28px" }}>
        <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={me.display_name} src={(me as any).avatar} size={52} /> {me.display_name}
          {me.role === "admin" && <Link className="btn small primary" style={{ marginLeft: "auto" }} to="/admin">管理后台 →</Link>}
          <button className="btn small" style={me.role === "admin" ? {} : { marginLeft: "auto" }} onClick={() => { logout(); location.href = "/"; }}>退出登录</button>
        </h1>
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
                <Link className="btn small" to={`/projects/${p.slug}?edit=1`}>{t.edit} →</Link>
              </div>
            </div>
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

      <JoinInbox />
      <ProfileForm me={me} onSaved={refresh} />
    </div>
  );
}

function JoinInbox() {
  const { t } = useLang();
  const { data, refresh } = useJ();
  const decide = async (id: number, action: string) => {
    await api(`/my/join-requests/${id}`, { method: "POST", body: JSON.stringify({ action }) });
    refresh();
  };
  const reqs = data?.requests ?? [];
  if (reqs.length === 0) return null;
  return (
    <section style={{ padding: "0 0 36px" }}>
      <div className="block-head"><h2>加入申请</h2></div>
      {reqs.map((r: any) => (
        <div className="member-row" key={r.id}>
          <span className="dname" style={{ fontSize: 15 }}>{r.requester_name}</span>
          <span className="bio">{r.name} — {r.message || "（无留言）"}</span>
          <button className="btn small primary" onClick={() => decide(r.id, "approve")}>{t.approve}</button>{" "}
          <button className="btn small danger" onClick={() => decide(r.id, "reject")}>{t.reject}</button>
        </div>
      ))}
    </section>
  );
}

function useJ() {
  const [tick, setTick] = useState(0);
  const res = useFetch<{ requests: any[] }>("/my/join-requests", [tick]);
  return { data: res.data, refresh: () => setTick((x) => x + 1) };
}

function ProfileForm({ me, onSaved }: { me: any; onSaved: () => void }) {
  const { t } = useLang();
  const [f, setF] = useState({ display_name: me.display_name, bio: me.bio ?? "", website_url: (me as any).website_url ?? "" });
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
      <label className="field"><span>个人网站 · Personal website</span>
        <input type="text" value={f.website_url} onChange={(e: any) => setF({ ...f, website_url: e.target.value })} /></label>
      <button className="btn" type="submit">{t.save}</button>
    </form>
  );
}
