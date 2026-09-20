import { Link, useParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { Avatar } from "../Avatar";
import { api } from "../api";
import { useMe } from "../App";
import { useState } from "react";

export function Students() {
  const { t } = useLang();
  const { data } = useFetch<{ members: any[] }>("/members");
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_students}</p>
        <h1>{t.students_title}</h1>
        <p className="sub">{t.students_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        {(data?.members ?? []).map((m) => (
          <div className="member-row" key={m.username}>
            <Avatar name={m.display_name || m.username} src={m.avatar} />
            <span className="dname">{m.display_name}</span>
            <span className="uname">@{m.username}</span>
            <span className="bio">{m.bio ?? t.no_bio}</span>
            <Link className="go" to={`/u/${encodeURIComponent(m.username)}`}>{t.view_profile} →</Link>
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
  const { data, error } = useFetch<{ member: any; projects: any[] }>(`/members/${encodeURIComponent(username!)}`, [username]);
  if (error) return <div className="err-full">{error}</div>;
  if (!data) return <div className="loading">{t.loading}</div>;
  const m = data.member;
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">@{m.username}</p>
        <h1 style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={m.display_name || m.username} src={m.avatar} size={52} /> {m.display_name}
          {me && me.username !== m.username && (
            <button className="btn small" onClick={async () => {
              await api(`/members/${encodeURIComponent(m.username)}/follow`, { method: following ? "DELETE" : "POST" });
              setFollowing(!following);
            }}>{following ? "已关注 ✓" : "关注"}</button>
          )}
        </h1>
        {m.bio && <p className="sub">{m.bio}</p>}
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
    </>
  );
}
