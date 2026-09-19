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
