import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { Md } from "../Md";
import { api } from "../api";
import { useToast } from "../toast";
import { Editor } from "../Editor";
import { useMe } from "../App";
import { Avatar } from "../Avatar";
import { I } from "../icons";
import { useHighlight } from "../hl";
import { Comments } from "../Comments";
import { LikeBtn } from "../LikeBtn";
import { useRef, useState } from "react";

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
  const [sp] = useSearchParams();
  const hlRef = useRef<HTMLDivElement>(null);
  useHighlight(hlRef, sp.get("hl") ?? "", [data]);
  if (!data) return <div className="loading">{t.loading}</div>;
  const c = data.column;
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{c.column_label}</p>
        <h1>{c.title}</h1>
        {c.subtitle && <p className="sub">{c.subtitle}</p>}
        <p className="byline" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <b>{c.author}</b> · {c.author_title} · {c.published_at}
          <LikeBtn targetType="column" targetId={c.id} initial={{ count: (data as any).likes_count ?? 0, liked: !!(data as any).liked }} />
        </p>
      </div></div>
      <div className="wrap" ref={hlRef}>
        <div className="prose" style={{ paddingBottom: 24 }}>
          <Md text={c.text} />
        </div>
        <Comments targetId={c.id} />
      </div>
    </>
  );
}
