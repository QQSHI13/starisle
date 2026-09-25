import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../i18n";
import { api } from "../api";
import { useMe } from "../App";
import { useFetch } from "../hooks";
import { ProjectForm } from "./ProjectForm";
import { Modal } from "../Modal";

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
        <NotificationManager />
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

      <section style={{ padding: "0 0 36px" }}>
        <div className="block-head"><h2>私信</h2><Link className="btn small" to="/dm">打开私信页 →</Link></div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}><MiniDM /></div>
      </section>
      <HomeworkInbox />
      <JoinInbox />
      <ProfileForm me={me} onSaved={refresh} />
      <Deactivate />
    </div>
  );
}

function NotificationManager() {
  const { t } = useLang();
  const [view, setView] = useState<"inbox" | "saved" | "done">("inbox");
  const [typeFilter, setTypeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ notifications: any[] }>("/notifications", [tick]);
  const all = data?.notifications ?? [];
  const refresh = () => setTick((x) => x + 1);
  const unread = all.filter((n) => !n.read).length;
  const TYPE_LABEL: Record<string, [string, string]> = {
    update: ["项目动态", "project updates"], join: ["加入", "joins"], application: ["申请", "applications"],
    project: ["项目审核", "project review"], course: ["课程", "courses"], mentor: ["导师", "mentoring"],
    announce: ["公告", "announcements"], general: ["其他", "other"],
  };
  const typeLabel = (k: string) => (TYPE_LABEL[k] ?? TYPE_LABEL.general)[t.language === "中文" ? 1 : 0];
  const types = [...new Set(all.map((n) => n.type))];
  let items = view === "inbox" ? all.filter((n) => !n.read) : view === "saved" ? all.filter((n) => n.saved) : all.filter((n) => n.read && !n.saved);
  if (typeFilter !== "all") items = items.filter((n) => n.type === typeFilter);
  if (q.trim()) items = items.filter((n) => n.text.toLowerCase().includes(q.trim().toLowerCase()));
  const counts = { inbox: unread, saved: all.filter((n) => n.saved).length, done: all.filter((n) => n.read).length };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 32, alignItems: "start" }}>
      <nav aria-label="notification views" style={{ position: "sticky", top: 90 }}>
        {([["inbox", "收件箱"], ["saved", "已保存"], ["done", "已完成"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{
            display: "flex", width: "100%", justifyContent: "space-between", padding: "8px 12px",
            background: view === k ? "var(--gold-soft)" : "none", border: 0, borderRadius: 4,
            cursor: "pointer", fontSize: 14, fontWeight: view === k ? 600 : 400, color: "var(--ink)",
          }}>
            <span>{label}</span><span className="dim">{counts[k]}</span>
          </button>
        ))}
        <div className="dim" style={{ fontSize: 11, letterSpacing: "0.1em", margin: "14px 0 4px", textTransform: "uppercase" }}>筛选</div>
        <button onClick={() => setTypeFilter("all")} className="dim" style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 12px", background: "none", border: 0, cursor: "pointer", fontSize: 13, color: typeFilter === "all" ? "var(--gold)" : undefined, fontWeight: typeFilter === "all" ? 600 : 400 }}>全部类型</button>
        {types.map((ty) => (
          <button key={ty} onClick={() => setTypeFilter(ty)} style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 12px", background: "none", border: 0, cursor: "pointer", fontSize: 13, color: typeFilter === ty ? "var(--gold)" : "var(--ink-2)", fontWeight: typeFilter === ty ? 600 : 400 }}>{typeLabel(ty)}</button>
        ))}
      </nav>
      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="搜索消息…" value={q} onChange={(e: any) => setQ(e.target.value)} style={{ width: 220 }} aria-label="搜索消息" />
          {unread > 0 && <button className="btn small" onClick={async () => { await api("/notifications/read", { method: "POST" }); refresh(); }}>{t.mark_all_read}</button>}
        </div>
        {items.length === 0 && <p className="dim">{view === "inbox" ? "没有未读消息 — 全处理完了。" : view === "saved" ? "没有已保存的消息。" : "没有已完成的消息。"}</p>}
        {items.map((n) => (
          <div key={n.id} className="member-row" style={{ gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "transparent" : "var(--gold)", flex: "none", alignSelf: "center" }} />
            <span className="pill" style={{ flex: "none" }}>{typeLabel(n.type)}</span>
            <span style={n.read ? { color: "var(--ink-3)" } : { fontWeight: 600 }}>{n.text}</span>
            <span className="bio">{n.created_at.slice(0, 16)}</span>
            <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              {!n.read && <button className="btn small" title="完成" onClick={async () => { await api(`/notifications/${n.id}/read`, { method: "POST" }); refresh(); }}>✓</button>}
              <button className="btn small" title={n.saved ? "取消保存" : "保存"} onClick={async () => { await api(`/notifications/${n.id}/save`, { method: "POST" }); refresh(); }}>{n.saved ? "★" : "☆"}</button>
              <button className="btn small danger" onClick={async () => { await api(`/notifications/${n.id}`, { method: "DELETE" }); refresh(); }}>🗑</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeworkInbox() {
  const { data, refresh } = useH();
  const pending = data?.pending ?? [];
  const mine = data?.mine ?? [];
  if (pending.length === 0 && mine.length === 0) return null;
  return (
    <section style={{ padding: "0 0 36px" }}>
      <div className="block-head"><h2>我的作业</h2></div>
      {pending.map((h: any) => (
        <div className="member-row" key={h.id}>
          <span className="pill gold">待提交</span>
          <span className="bio" style={{ flex: 1 }}><b>{h.title}</b> · {h.course_title}（截止 {h.due_at?.slice(0, 10) ?? "—"}）</span>
          <Link className="btn small" to={`/courses/${encodeURIComponent(h.course_slug ?? "")}`}>去课程页提交 →</Link>
        </div>
      ))}
      {mine.slice(0, 5).map((s: any) => (
        <div className="member-row" key={s.id}>
          <span className="pill">{s.status === "approved" ? "已通过" : s.status === "rejected" ? "需修改" : "待批改"}</span>
          <span className="bio" style={{ flex: 1 }}>{s.homework_title} · {s.course_title}{s.feedback ? ` · 反馈：${s.feedback}` : ""}</span>
          <a className="btn small" href={s.repo_url} target="_blank" rel="noreferrer">查看提交</a>
        </div>
      ))}
    </section>
  );
}

function useH() {
  const [tick, setTick] = useState(0);
  const res = useFetch<{ pending: any[]; mine: any[] }>("/my/homework", [tick]);
  return { data: res.data, refresh: () => setTick((x) => x + 1) };
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

function MiniDM() {
  const [convs, setConvs] = useState<any[]>([]);
  useEffect(() => { api("/dm").then((d) => setConvs(d.conversations.slice(0, 4))).catch(() => {}); }, []);
  if (convs.length === 0) return <p className="dim" style={{ padding: "14px 16px", margin: 0, fontSize: 13.5 }}>暂无会话。</p>;
  return (<>{convs.map((cv) => (
    <Link to={`/dm?with=${cv.id}`} key={cv.id} className="member-row" style={{ textDecoration: "none" }}>
      <span className="dname" style={{ fontSize: 15 }}>{cv.display_name}{cv.role !== "member" && <span className="pill gold" style={{ marginLeft: 6 }}>{cv.role === "admin" ? "管理" : "导师"}</span>}</span>
      <span className="bio" style={{ flex: 1 }}>{cv.last_text}</span>
      {cv.unread > 0 && <span className="pill gold">{cv.unread}</span>}
    </Link>
  ))}</>);
}

function Deactivate() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  return (
    <section style={{ padding: "0 0 36px", maxWidth: 480 }}>
      <button className="btn small danger" onClick={() => setShow(!show)}>注销账号 · Deactivate account</button>
      {show && (
        <form onSubmit={async (e) => { e.preventDefault(); setMsg(null);
          try { await api("/me/deactivate", { method: "POST", body: JSON.stringify({ password: pw }) }); location.href = "/"; }
          catch (e2: any) { setMsg(String(e2.message)); } }}>
          {msg && <div className="error-box" role="alert">{msg}</div>}
          <p className="dim" style={{ fontSize: 13 }}>验证密码后账号将停用，个人资料会被清除。项目和历史记录按隐私政策保留。</p>
          <label className="field"><span>密码 · Password</span>
            <input type="password" required value={pw} onChange={(e: any) => setPw(e.target.value)} /></label>
          <button className="btn small danger" type="submit">确认注销</button>
        </form>
      )}
    </section>
  );
}

function ProfileForm({ me, onSaved }: { me: any; onSaved: () => void }) {
  const { t } = useLang();
  const initial = { display_name: me.display_name, bio: me.bio ?? "", website_url: (me as any).website_url ?? "" };
  const [f, setF] = useState(initial);
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
      <label className="check">
        <input type="checkbox" checked={!!(me as any).real_name_public} disabled={!!(me as any).is_minor}
          onChange={async (e: any) => { await api("/me", { method: "PUT", body: JSON.stringify({ real_name_public: e.target.checked }) }); onSaved(); }} />
        <span>公开我的真实姓名（{(me as any).is_minor ? "未成年人不可公开" : "默认不公开"}）· Make my real name public</span>
      </label>
      <button className="btn" type="submit">{t.save}</button>
      <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={() => { setF(initial); setMsg(false); }}>{t.cancel}</button>
    </form>
  );
}
