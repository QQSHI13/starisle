import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { ProjectCard } from "./Home";
import { I } from "../icons";
import { Avatar } from "../Avatar";
import { api } from "../api";
import { useMe } from "../App";
import { ProjectForm } from "./ProjectForm";
import { Md } from "../Md";
import { useToast } from "../toast";

export function Projects() {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (domain) p.set("domain", domain);
    const s = p.toString();
    return "/projects" + (s ? `?${s}` : "");
  }, [q, domain]);
  const { data, error, loading } = useFetch<{ projects: any[] }>(query, [query]);
  const { data: domData } = useFetch<{ domains: any[] }>("/domains");

  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_projects}</p>
        <h1>{t.all_projects}</h1>
      </div></div>
      <section className="block"><div className="wrap">
        <div className="toolbar">
          <input
            type="text" placeholder={t.search_placeholder} value={q}
            onChange={(e) => setQ(e.target.value)} aria-label={t.search_placeholder}
          />
          <select value={domain} onChange={(e) => setDomain(e.target.value)} style={{ width: "auto" }} aria-label={t.all_domains}>
            <option value="">{t.all_domains}</option>
            {(domData?.domains ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        {loading && <div className="grid">{[0,1,2,3,4,5].map((i) => <div key={i} className="skel skel-card" />)}</div>}
        <div className="grid">
          {(data?.projects ?? []).map((p) => <ProjectCard key={p.slug} p={p} />)}
        </div>
        {data && data.projects.length === 0 && <div className="empty"><b>∅</b>{t.no_items}</div>}
              </div></section>
    </>
  );
}

export function ProjectDetail() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const { data, error } = useFetch<{ project: any; members: any[]; gaps: string[]; stack: string[]; milestones: any[]; updates: any[]; repo_stats: any; followers: number; following: boolean }>(`/projects/${slug}`, [slug]);
  const { me, refresh } = useMe();
  const toast = useToast();
  const [sp] = useSearchParams();
  const editing = sp.get("edit") === "1";
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState<string | null>(null);
  if (error) return <div className="err-full">{error}</div>;
  if (!data) return <div className="loading">{t.loading}</div>;
  const p = data.project;
  const rs = data.repo_stats;
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{p.domain_name ?? t.nav_projects}</p>
        <h1 style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          {p.name}
          {me && me.username === p.owner_username && !editing && (
            <a className="btn small" href={`/projects/${p.slug}?edit=1`}>{t.edit} ↗</a>
          )}
        </h1>
        {p.tagline && <p className="sub">{p.tagline}</p>}
        {p.poster_url && <img className="detail-poster" src={p.poster_url} alt={`${p.name} 展板`} />}
      </div></div>
      {editing && me && me.username === p.owner_username && (
        <section className="block"><div className="wrap">
          <ProjectForm existing={p} onDone={() => location.assign(`/projects/${p.slug}`)} />
        </div></section>
      )}
      <section className="block"><div className="wrap"><div className="detail-grid"><div>
        {data.stack.length > 0 && (
          <p>{data.stack.map((s) => <span key={s} className="pill" style={{ marginRight: 8 }}>{s}</span>)}</p>
        )}
        <dl className="kv">
          <dt><I name="star" />{t.owner}</dt><dd>{p.owner_display}（{p.owner_username}）</dd>
          {p.repo_url && (<><dt><I name="repo" />{t.repo}</dt><dd><a href={p.repo_url} target="_blank" rel="noreferrer">{p.repo_url}</a></dd></>)}
          {p.demo_url && (<><dt><I name="play" />{t.demo}</dt><dd><a href={p.demo_url} target="_blank" rel="noreferrer">{p.demo_url}</a></dd></>)}
          <dt><I name="users" />{t.contributors}</dt>
          <dd style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {data.members.map((m) => (
              <span key={m.username} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Avatar name={m.display_name || m.username} size={24} />
                {m.display_name}{m.role === "owner" ? ` · ${t.owner}` : ""}
              </span>
            ))}
          </dd>
        </dl>
        {rs && !rs.error && (
          <>
            <h3>{lang === "zh" ? "仓库实况" : "Repository pulse"}</h3>
            <div className="stats" style={{ marginTop: 12 }}>
              <div><b>{rs.stars}</b><span><I name="star" size={12} /> {lang === "zh" ? "星标" : "stars"}</span></div>
              <div><b>{rs.forks}</b><span><I name="fork" size={12} /> {lang === "zh" ? "分支" : "forks"}</span></div>
              {rs.language && <div><b style={{ fontSize: 20 }}>{rs.language}</b><span>{lang === "zh" ? "主要语言" : "main language"}</span></div>}
              {rs.last_push && <div><b style={{ fontSize: 20 }}>{rs.last_push.slice(0, 10)}</b><span><I name="clock" size={12} /> {lang === "zh" ? "最近提交" : "last push"}</span></div>}
            </div>
          </>
        )}
        {data.milestones.length > 0 && (
          <>
            <h3 style={{ marginTop: 40 }}>{lang === "zh" ? "里程碑" : "Milestones"}</h3>
            <div>
              {data.milestones.map((m, i) => (
                <div key={i} className={`mstone${m.done ? " done" : ""}`}>
                  <I name={m.done ? "check" : "circle"} size={16} />
                  <span className="mtext">{m.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {data.gaps.length > 0 && (
          <>
            <h3>{t.gaps_title}</h3>
            <p>{data.gaps.map((g) => <span key={g} className="pill gap" style={{ marginRight: 8 }}>{g}</span>)}</p>
          </>
        )}
        {me && me.username !== p.owner_username && (
          <p>
            <button className="btn small" onClick={async () => {
              await api(`/projects/${slug}/follow`, { method: data.following ? "DELETE" : "POST" });
              toast(data.following ? "已取消关注" : "已关注"); setTimeout(() => location.reload(), 600);
            }}>{data.following ? (lang === "zh" ? "已关注 ✓" : "Following ✓") : (lang === "zh" ? "关注这个项目" : "Follow")}</button>
            <span className="dim" style={{ marginLeft: 10, fontSize: 13 }}>{data.followers} {lang === "zh" ? "人关注" : "followers"}</span>
          </p>
        )}
        {me && (
          <div style={{ margin: "26px 0" }}>
            {note && <div className="notice" role="status">{note}</div>}
            {data.members.some((mm: any) => mm.username === me.username) ? (
              <form onSubmit={async (e) => { e.preventDefault(); if (!msg.trim()) return;
                await api(`/projects/${slug}/updates`, { method: "POST", body: JSON.stringify({ text: msg }) });
                setMsg(""); location.reload(); }}>
                <label className="field"><span>{lang === "zh" ? "发布进展" : "Post an update"}</span>
                  <textarea rows={2} value={msg} onChange={(e: any) => setMsg(e.target.value)} /></label>
                <button className="btn small primary">{lang === "zh" ? "发布" : "Post"}</button>
              </form>
            ) : (
              <form onSubmit={async (e) => { e.preventDefault();
                await api(`/projects/${slug}/join`, { method: "POST", body: JSON.stringify({ message: msg }) });
                toast(lang === "zh" ? "加入申请已发送" : "Join request sent"); setMsg(""); }}>
                <label className="field"><span>{t.join_project}</span>
                  <textarea rows={2} placeholder={lang === "zh" ? "给项目发起人留言（选填）" : "Message for the owner (optional)"} value={msg} onChange={(e: any) => setMsg(e.target.value)} /></label>
                <button className="btn small primary">{t.join_project}</button>
              </form>
            )}
          </div>
        )}
        <p style={{ marginTop: 20 }}>
          <button className="btn small danger" onClick={async () => {
            if (!me) { location.href = "/login"; return; }
            const reason = prompt(lang === "zh" ? "举报原因（选填）" : "Reason (optional)") ?? "";
            await api("/reports", { method: "POST", body: JSON.stringify({ target_type: "project", target_id: data.project.id, reason }) });
            alert(lang === "zh" ? "已提交举报，管理员会尽快处理。" : "Report submitted.");
          }}>{lang === "zh" ? "举报此项目" : "Report"}</button>
        </p>
        {data.updates.length > 0 && (
          <>
            <h3>{lang === "zh" ? "项目动态" : "Updates"}</h3>
            {data.updates.map((u, i) => (
              <div key={i} className="mstone" style={{ borderBottom: "1px solid var(--line)" }}>
                <span className="mtext" style={{ color: "var(--ink)" }}>{u.text}</span>
                <span className="dim" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{u.author} · {u.created_at.slice(0, 16)}</span>
              </div>
            ))}
          </>
        )}
        {p.body && <div className="prose" style={{ padding: "24px 0" }}><Md text={p.body.replace(/\\n/g, "\n")} /></div>}
      </div>
      <aside className="aside-card">
        <h4>项目概览</h4>
        <div className="stat-row"><span>{t.owner}</span><b style={{fontSize:14}}>{p.owner_display}{p.owner_username ? `（${p.owner_username}）` : ""}</b></div>
        <div className="stat-row"><span>{t.contributors}</span><b>{data.members.length}</b></div>
        <div className="stat-row"><span>{lang === "zh" ? "关注者" : "Followers"}</span><b>{data.followers}</b></div>
        <div className="stat-row"><span>{t.repo}</span><b style={{fontSize:13, wordBreak:"break-all"}}>{rs && !rs.error ? `${rs.stars} ★ / ${rs.forks} ⑂` : "—"}</b></div>
        {p.repo_url && <a className="btn small" style={{width:"100%", textAlign:"center", marginTop:14}} href={p.repo_url} target="_blank" rel="noreferrer">{lang === "zh" ? "查看开源仓库" : "View repository"} →</a>}
        {p.demo_url && <a className="btn small" style={{width:"100%", textAlign:"center", marginTop:8}} href={p.demo_url} target="_blank" rel="noreferrer">{t.demo} →</a>}
        {me && me.username !== p.owner_username && (
          <button className="btn small primary" style={{width:"100%", marginTop:8}} onClick={async () => {
            await api(`/projects/${slug}/follow`, { method: data.following ? "DELETE" : "POST" });
            toast(data.following ? "已取消关注" : "已关注"); setTimeout(() => location.reload(), 600);
          }}>{data.following ? (lang === "zh" ? "已关注 ✓" : "Following ✓") : (lang === "zh" ? "关注这个项目" : "Follow")}</button>
        )}
        <button className="btn small danger" style={{width:"100%", marginTop:8}} onClick={async () => {
          if (!me) { location.href = "/login"; return; }
          const reason = prompt(lang === "zh" ? "举报原因（选填）" : "Reason (optional)") ?? "";
          await api("/reports", { method: "POST", body: JSON.stringify({ target_type: "project", target_id: data.project.id, reason }) });
          toast(lang === "zh" ? "已提交举报" : "Report submitted");
        }}>{lang === "zh" ? "举报此项目" : "Report"}</button>
      </aside>
      </div></div></section>
    </>
  );
}
