import { Link, useParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { Md } from "../Md";
import { api } from "../api";
import { useMe } from "../App";
import { Avatar } from "../Avatar";
import { useState } from "react";

function Comments({ targetId }: { targetId: number }) {
  const { t, lang } = useLang();
  const { me } = useMe();
  const [tick, setTick] = useState(0);
  const [text, setText] = useState("");
  const { data } = useFetch<{ comments: any[] }>(`/comments/list?target=${targetId}`, [tick, targetId]);
  const [note, setNote] = useState<string | null>(null);
  const items = data?.comments ?? [];
  return (
    <section style={{ maxWidth: 700, marginBottom: 60 }}>
      <h3 style={{ margin: "40px 0 18px" }}>{lang === "zh" ? "讨论" : "Discussion"} · {items.filter((x) => x.status === "approved").length}</h3>
      {items.map((cm: any) => (
        <div key={cm.id} className={`comment${cm.status === "pending" ? " pending" : ""}`}>
          <div className="who">
            <Avatar name={cm.display_name} size={26} />
            <b>{cm.display_name}</b>
            <span className="dim">{cm.created_at.slice(0, 16)}{cm.status === "pending" ? (lang === "zh" ? " · 审核中，仅你可见" : " · pending, only visible to you") : ""}</span>
          </div>
          <div className="body">{cm.text}</div>
        </div>
      ))}
      {me ? (
        <form onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return;
          setNote(null);
          try { await api("/comments", { method: "POST", body: JSON.stringify({ target_type: "column", target_id: targetId, text }) }); setText(""); setNote(lang === "zh" ? "已提交，审核通过后公开。" : "Submitted — visible after review."); setTick((x) => x + 1); }
          catch (e2: any) { setNote(String(e2.message)); } }}>
          {note && <div className="notice" role="status">{note}</div>}
          <label className="field"><span>{lang === "zh" ? "写下你的想法（支持 Markdown、KaTeX 公式、Mermaid 图）" : "Your thoughts (Markdown, KaTeX, Mermaid supported)"}</span>
            <textarea rows={3} value={text} onChange={(e: any) => setText(e.target.value)} required /></label>
          <button className="btn primary small">{lang === "zh" ? "发表评论" : "Comment"}</button>
        </form>
      ) : <p className="dim">{lang === "zh" ? "登录后参与讨论。" : "Sign in to join the discussion."}</p>}
    </section>
  );
}

export function Columns() {
  const { t } = useLang();
  const { data } = useFetch<{ columns: any[] }>("/columns");
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_columns}</p>
        <h1>{t.columns_title}</h1>
        <p className="sub">{t.columns_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        <div className="grid">
          {(data?.columns ?? []).map((c) => (
            <Link className="card" key={c.slug} to={`/columns/${c.slug}`}>
              {c.title !== c.column_label && <span className="pill gold">{c.column_label}</span>}
              <h3>{c.title}</h3>
              <p className="tagline">{c.subtitle}</p>
              <div className="meta"><span>{c.author}</span><span>{c.published_at}</span></div>
            </Link>
          ))}
        </div>
      </div></section>
    </>
  );
}

export function ColumnDetail() {
  const { slug } = useParams();
  const { t } = useLang();
  const { data } = useFetch<{ column: any }>(`/columns/${slug}`, [slug]);
  if (!data) return <div className="loading">{t.loading}</div>;
  const c = data.column;
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{c.column_label}</p>
        <h1>{c.title}</h1>
        {c.subtitle && <p className="sub">{c.subtitle}</p>}
        <p className="byline"><b>{c.author}</b> · {c.author_title} · {c.published_at}</p>
      </div></div>
      <div className="wrap">
        <div className="prose" style={{ paddingBottom: 24 }}>
          <Md text={c.text} />
        </div>
        <Comments targetId={c.id} />
      </div>
    </>
  );
}
