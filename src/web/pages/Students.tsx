import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { Avatar } from "../Avatar";
import { api } from "../api";
import { useMe } from "../App";
import { useHighlight } from "../hl";
import { useRef, useState } from "react";
import { I } from "../icons";

export function Students() {
  const { t } = useLang();
  const { data, loading } = useFetch<{ members: any[] }>("/members");
  const [q, setQ] = useState("");
  const members = (data?.members ?? []).filter((m) =>
    !q.trim() || (m.display_name + (m.username ?? "") + (m.bio ?? "")).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_students}</p>
        <h1>{t.students_title}</h1>
        <p className="sub">{t.students_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        {loading && [0,1,2,3,4].map((i) => <div key={i} className="skel" style={{ height: 40, marginBottom: 10 }} />)}
        <div className="toolbar">
          <input type="text" placeholder="搜索成员…" value={q} onChange={(e: any) => setQ(e.target.value)} style={{ width: 260 }} aria-label="搜索成员" />
        </div>
        {members.map((m) => (
          <div className="member-row" key={m.id ?? m.username}>
            <Avatar name={m.display_name || m.username} src={m.avatar} />
            <span className="dname">{m.display_name}</span>
            {m.username && <span className="uname">@{m.username}</span>}{!!m.verified && <span className="pill gold" style={{ marginLeft: 4 }}>已认证</span>}
            <span className="bio">{m.bio ?? t.no_bio}</span>
            <Link className="go" to={`/u/${m.id}`}>{t.view_profile} →</Link>
          </div>
        ))}
      </div></section>
    </>
  );
}

export function Profile() {
  const { username } = useParams();
  const { me } = useMe();
  const [following, setFollowing] = useState(false);
  const { t } = useLang();
  const { data, error } = useFetch<{ member: any; projects: any[]; followers?: any[]; following?: any[]; activity?: any[] }>(`/members/${encodeURIComponent(username!)}`, [username]);
  const [sp] = useSearchParams();
  const hlRef = useRef<HTMLDivElement>(null);
  useHighlight(hlRef, sp.get("hl") ?? "", [data]);
  if (error) return <div className="err-full">{error}</div>;
  if (!data) return <div className="loading">{t.loading}</div>;
  const m = data.member;
  return (
    <>
      <div className="page-head"><div className="wrap" ref={hlRef}>
        <p className="kicker">@{m.username}</p>
        <div className="profile-head">
          <Avatar name={m.display_name || m.username} src={m.avatar} size={76} />
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 14, margin: 0 }}>
              {m.display_name}
          {me && me.username !== m.username && (
            <button className="btn small" onClick={async () => {
              await api(`/members/${encodeURIComponent(m.username)}/follow`, { method: following ? "DELETE" : "POST" });
              setFollowing(!following);
            }}><I name="heart" size={13} /> {following ? "已关注 ✓" : "关注"}</button>
          )}
            </h1>
            <div className="profile-stats">
              <div><b>{data.projects.length}</b><span>参与项目</span></div>
              <div><b>{data.followers?.length ?? 0}</b><span>关注者</span></div>
              <div><b>{data.following?.length ?? 0}</b><span>正在关注</span></div>
              <div><b>{(m.created_at ?? "—").slice(0, 10)}</b><span>加入时间</span></div>
              <div><b>{m.verified ? "已认证" : "成员"}</b><span>状态</span></div>
            </div>
          </div>
        </div>
        {m.bio && <p className="sub" style={{ marginTop: 18 }}>{m.bio}</p>}
        <p style={{ marginTop: 10 }}>
          {data.projects.length > 0 && <span className="pill gold">项目成员</span>}{" "}
          {data.projects.length >= 2 && <span className="pill gold">多项目玩家</span>}{" "}
          {m.verified ? <span className="pill gold">已认证</span> : null}
        </p>
        {m.website_url && <p className="sub"><a href={m.website_url} target="_blank" rel="noreferrer">{m.website_url}</a></p>}

      </div></div>
      <section className="block"><div className="wrap">
        <h3>{t.projects_of}</h3>
        {data.projects.length === 0 && <p className="dim">—</p>}
        {data.projects.map((p) => (
          <div className="member-row" key={p.slug}>
            <span className="dname">{p.name}</span>
            <span className="bio">{p.tagline}</span>
            <Link className="go" to={`/projects/${p.slug}`}>{t.view_profile} →</Link>
          </div>
        ))}
      </div></section>
      {(data.activity?.length || data.followers?.length || data.following?.length) ? (
        <section className="block"><div className="wrap">
          {data.activity && data.activity.length > 0 && (<>
            <h3><I name="trend" size={18} /> TA 的动态</h3>
            {data.activity.map((a: any, i: number) => (
              <div className="mstone" key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                <span className="mtext" style={{ color: "var(--ink)" }}>{a.text}</span>
                <span className="dim" style={{ fontSize: 12, whiteSpace: "nowrap" }}><Link to={`/projects/${a.slug}`}>{a.name}</Link> · {a.created_at.slice(0, 16)}</span>
              </div>
            ))}
          </>)}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32, marginTop: 24 }}>
            <div>
              <h3 style={{ fontSize: 17 }}><I name="users" size={15} /> 关注者 · {data.followers?.length ?? 0}</h3>
              {(data.followers ?? []).map((f: any) => (
                <div className="member-row" key={f.id}>
                  <Avatar name={f.display_name} src={f.avatar} size={26} />
                  <span className="dname" style={{ fontSize: 15 }}><Link to={`/u/${f.id}`}>{f.display_name}</Link></span>
                </div>
              ))}
              {(data.followers ?? []).length === 0 && <p className="dim">—</p>}
            </div>
            <div>
              <h3 style={{ fontSize: 17 }}><I name="user" size={15} /> 正在关注 · {data.following?.length ?? 0}</h3>
              {(data.following ?? []).map((f: any) => (
                <div className="member-row" key={f.id}>
                  <Avatar name={f.display_name} src={f.avatar} size={26} />
                  <span className="dname" style={{ fontSize: 15 }}><Link to={`/u/${f.id}`}>{f.display_name}</Link></span>
                </div>
              ))}
              {(data.following ?? []).length === 0 && <p className="dim">—</p>}
            </div>
          </div>
        </div></section>
      ) : null}
    </>
  );
}
