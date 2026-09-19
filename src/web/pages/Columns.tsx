import { Link, useParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";

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
        <article className="prose">
          {c.text.split(/\n{2,}/).map((para: string, i: number) => <p key={i}>{para}</p>)}
        </article>
      </div>
    </>
  );
}
