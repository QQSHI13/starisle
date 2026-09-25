import { Link } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { I } from "../icons";

export default function Stream() {
  const { lang } = useLang();
  const { data, loading } = useFetch<{ items: any[] }>("/stream");
  const items = data?.items ?? [];
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{lang === "zh" ? "全部动态" : "Stream"}</p>
        <h1>{lang === "zh" ? "社区时间线" : "Community timeline"}</h1>
        <p className="sub">{lang === "zh" ? "项目进展、新作品、专栏文章，按时间汇成一条河。" : "Updates, new projects and writing, in one flowing timeline."}</p>
      </div></div>
      <section className="block"><div className="wrap" style={{ maxWidth: 720 }}>
        {loading && [0,1,2,3].map((i) => <div key={i} className="skel" style={{ height: 64, marginBottom: 14 }} />)}
        {items.map((it, i) => (
          <div key={i} className="member-row" style={{ alignItems: "flex-start" }}>
            <span className="pill" style={{ flex: "none", marginTop: 3 }}>
              {it.kind === "update" ? "动态" : it.kind === "project" ? "新项目" : "专栏"}
            </span>
            <span style={{ flex: 1 }}>
              <Link to={it.kind === "column" ? `/columns/${it.slug}` : `/projects/${it.slug}`} className="serif" style={{ fontSize: 16.5, fontWeight: 600 }}>{it.subject}</Link>
              {it.body && <span className="dim" style={{ display: "block", fontSize: 13.5, marginTop: 3 }}>{it.body.slice(0, 140)}</span>}
              <span className="dim" style={{ fontSize: 12 }}><I name="users" size={11} /> {it.author} · {String(it.created_at).slice(0, 16)}</span>
            </span>
          </div>
        ))}
      </div></section>
    </>
  );
}
