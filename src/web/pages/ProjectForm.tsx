import { useState, type FormEvent } from "react";
import { useLang } from "../i18n";
import { api } from "../api";
import { useFetch } from "../hooks";
import { Modal } from "../Modal";
import { I } from "../icons";

export function ProjectForm({ existing, onDone }: { existing?: any; onDone: () => void }) {
  const { t } = useLang();
  const [f, setF] = useState({
    name: existing?.name ?? "", tagline: existing?.tagline ?? "", body: existing?.body ?? "",
    repo_url: existing?.repo_url ?? "", demo_url: existing?.demo_url ?? "", poster_url: existing?.poster_url ?? "", domain_id: existing?.domain_id ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
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
    if (!existing) return;
    try { await api(`/my/projects/${existing.slug}`, { method: "DELETE" }); setDelOpen(false); onDone(); }
    catch (e: any) { setErr(String(e.message)); setDelOpen(false); }
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
      <button className="btn primary" type="submit"><I name="save" size={15} />{t.save}</button>
      <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={onDone}><I name="x" size={15} />{t.cancel}</button>
      {existing && <button className="btn danger" type="button" style={{ marginLeft: 8 }} onClick={() => setDelOpen(true)}><I name="trash" size={15} />{t.delete}</button>}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t.delete}>
        <p style={{ fontSize: 14.5, color: "var(--ink-2)", marginTop: 0 }}>{t.delete_project_warn}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn small danger" onClick={del}><I name="trash" size={13} />{t.confirm_delete}</button>
          <button className="btn small" onClick={() => setDelOpen(false)}><I name="x" size={13} />{t.cancel}</button>
        </div>
      </Modal>
    </form>
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
          <button className="btn small primary" onClick={() => decide(r.id, "approve")}><I name="check" size={13} />{t.approve}</button>{" "}
          <button className="btn small danger" onClick={() => decide(r.id, "reject")}><I name="ban" size={13} />{t.reject}</button>
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

