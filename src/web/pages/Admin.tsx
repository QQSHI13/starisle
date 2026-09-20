import { useState } from "react";
import { useLang } from "../i18n";
import { api } from "../api";
import { useMe } from "../App";
import { useFetch } from "../hooks";

export default function Admin() {
  const { t } = useLang();
  const { me } = useMe();
  const { data: apps, refresh } = useFetchData<any[]>("/admin/applications", me?.role === "admin");
  const { data: projs, refresh: refreshP } = useFetchData<any[]>("/admin/projects", me?.role === "admin");
  const { data: enrolls, refresh: refreshE } = useFetchData<any[]>("/admin/enrollments", me?.role === "admin");

  if (me?.role !== "admin") return <div className="err-full">403</div>;

  const decide = async (path: string, id: number, action: string, reason?: string) => {
    await api(`${path}/${id}`, { method: "POST", body: JSON.stringify({ action, reason }) });
    refresh(); refreshP(); refreshE();
  };

  return (
    <div className="wrap" style={{ padding: "64px 24px" }}>
      <h1 className="serif" style={{ fontSize: 32 }}>{t.admin}</h1>

      <section style={{ padding: "28px 0" }}>
        <h3>{t.admin_apps}</h3>
        <table className="list">
          <thead><tr><th>{t.username}</th><th>{t.display_name}</th><th>{t.email}</th><th>Statement</th><th></th></tr></thead>
          <tbody>
            {(apps ?? []).filter((a: any) => a.status === "pending") .map((a: any) => (
              <tr key={a.id}>
                <td>{a.username}</td><td>{a.display_name}</td><td>{a.email}</td>
                <td className="dim" style={{ maxWidth: 320 }}>{a.statement}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn small primary" onClick={() => decide("/admin/applications", a.id, "approve")}>{t.approve}</button>{" "}
                  <Reject onOk={(reason) => decide("/admin/applications", a.id, "reject", reason)} label={t.reject} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps && !apps.some((a: any) => a.status === "pending") && <p className="dim">{t.no_items}</p>}
      </section>

      <section style={{ padding: "0 0 28px" }}>
        <h3>{t.admin_projects}</h3>
        {(projs ?? []) .map((p: any) => (
          <div className="member-row" key={p.id}>
            <span className="dname" style={{ fontSize: 15 }}>{p.name}</span>
            <span className="bio">{p.owner_username} — {p.tagline}</span>
            <button className="btn small primary" onClick={() => decide("/admin/projects", p.id, "approve")}>{t.approve}</button>{" "}
            <Reject onOk={(reason) => decide("/admin/projects", p.id, "reject", reason)} label={t.reject} />
          </div>
        ))}
        {projs && projs.length === 0 && <p className="dim">{t.no_items}</p>}
      </section>

      <MentorQueue />
      <AdminTools />
      <section style={{ padding: "0 0 28px" }}>
        <h3>{t.admin_enroll}</h3>
        {(enrolls ?? []) .map((e: any) => (
          <div className="member-row" key={e.id}>
            <span className="dname" style={{ fontSize: 15 }}>{e.display_name ?? e.username}</span>
            <span className="bio">{e.title}</span>
            <button className="btn small primary" onClick={() => decide("/admin/enrollments", e.id, "approve")}>{t.approve}</button>{" "}
            <button className="btn small danger" onClick={() => decide("/admin/enrollments", e.id, "reject")}>{t.reject}</button>
          </div>
        ))}
        {enrolls && enrolls.length === 0 && <p className="dim">{t.no_items}</p>}
      </section>
    </div>
  );
}

function useFetchData<T>(path: string | null, enabled: boolean) {
  const [tick, setTick] = useState(0);
  const res = useFetch<{ [k: string]: T }>(enabled && path ? path : null, [tick, enabled]);
  const key = path?.split("/").pop() ?? "";
  return { data: res.data ? (res.data as any)[key === "applications" ? "applications" : key === "projects" ? "projects" : "enrollments"] : null, refresh: () => setTick(tick + 1) };
}

function MentorQueue() {
  const { t } = useLang();
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ requests: any[] }>("/admin/mentor-requests", [tick]);
  const reqs = (data?.requests ?? []).filter((r: any) => r.status === "pending");
  const decide = async (id: number, action: string) => {
    await api(`/admin/mentor-requests/${id}`, { method: "POST", body: JSON.stringify({ action }) });
    setTick((x) => x + 1);
  };
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3>指导申请 · Mentor requests</h3>
      {reqs.length === 0 && <p className="dim">{t.no_items}</p>}
      {reqs.map((r: any) => (
        <div className="member-row" key={r.id}>
          <span className="dname" style={{ fontSize: 15 }}>{r.member_name}</span>
          <span className="bio">想跟 {r.mentor_name} 做:{r.interest}{r.questions ? ` · 问:${r.questions}` : ""}</span>
          <button className="btn small primary" onClick={() => decide(r.id, "approve")}>通过</button>{" "}
          <button className="btn small" onClick={() => decide(r.id, "contacted")}>已对接</button>{" "}
          <button className="btn small danger" onClick={() => decide(r.id, "reject")}>{t.reject}</button>
        </div>
      ))}
    </section>
  );
}

function AdminTools() {
  const { t } = useLang();
  const [msg, setMsg] = useState<string | null>(null);
  const post = (path: string, body: any, ok: string) => async (e: any) => {
    e.preventDefault();
    setMsg(null);
    try { await api(path, { method: "POST", body: JSON.stringify(body) }); setMsg(ok); } catch (e: any) { setMsg(String(e.message)); }
  };
  const [aTitle, setATitle] = useState(""); const [aDesc, setADesc] = useState(""); const [aWhen, setAWhen] = useState("");
  const [rName, setRName] = useState(""); const [rDesc, setRDesc] = useState("");
  const [cTitle, setCTitle] = useState(""); const [cText, setCText] = useState("");
  const [ann, setAnn] = useState("");
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3>站点运营 · Site operations</h3>
      {msg && <div className="notice" role="status">{msg}</div>}
      <form onSubmit={post("/admin/activities", { title: aTitle, description: aDesc, starts_at: aWhen }, "活动已发布")} style={{ marginBottom: 22 }}>
        <b>发布活动</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="text" placeholder="标题" value={aTitle} onChange={(e: any) => setATitle(e.target.value)} style={{ width: 180 }} required />
          <input type="text" placeholder="时间，如 2026-10-01 14:00" value={aWhen} onChange={(e: any) => setAWhen(e.target.value)} style={{ width: 200 }} />
          <input type="text" placeholder="说明" value={aDesc} onChange={(e: any) => setADesc(e.target.value)} style={{ width: 260 }} />
          <button className="btn small primary">发布</button>
        </div>
      </form>
      <form onSubmit={post("/admin/resources", { name: rName, description: rDesc }, "资源已上架")} style={{ marginBottom: 22 }}>
        <b>上架资源</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="text" placeholder="名称" value={rName} onChange={(e: any) => setRName(e.target.value)} style={{ width: 180 }} required />
          <input type="text" placeholder="说明" value={rDesc} onChange={(e: any) => setRDesc(e.target.value)} style={{ width: 320 }} />
          <button className="btn small primary">上架</button>
        </div>
      </form>
      <form onSubmit={post("/admin/columns", { title: cTitle, text: cText }, "专栏已发布")} style={{ marginBottom: 22 }}>
        <b>发布专栏</b>
        <div style={{ marginTop: 8, maxWidth: 560 }}>
          <input type="text" placeholder="标题" value={cTitle} onChange={(e: any) => setCTitle(e.target.value)} required style={{ marginBottom: 8 }} />
          <textarea rows={4} placeholder="正文" value={cText} onChange={(e: any) => setCText(e.target.value)} required />
          <button className="btn small primary" style={{ marginTop: 8 }}>发布</button>
        </div>
      </form>
      <form onSubmit={post("/admin/announce", { text: ann }, "已广播给全体成员")}>
        <b>全员通知</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="text" placeholder="通知内容" value={ann} onChange={(e: any) => setAnn(e.target.value)} style={{ width: 420 }} required />
          <button className="btn small primary">发送</button>
        </div>
      </form>
    </section>
  );
}

function Reject({ onOk, label }: { onOk: (reason: string) => void; label: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button className="btn small danger" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, marginLeft: 6 }}>
      <input type="text" placeholder={t.reason} value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: 180 }} />
      <button className="btn small danger" onClick={() => { onOk(reason); setOpen(false); }}>OK</button>
    </span>
  );
}
