import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../hooks";
import { Avatar } from "../Avatar";

export default function Search() {
  const [sp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const { data } = useFetch<{ projects?: any[]; columns?: any[]; members?: any[] }>(`/search?q=${encodeURIComponent(q)}`, [q]);
  if (!q) return <div className="err-full">输入关键词搜索项目、专栏、成员。</div>;
  return (
    <div className="wrap" style={{ padding: "48px 24px" }}>
      <h1 className="serif" style={{ fontSize: 30 }}>搜索：{q}</h1>
      <h3>项目</h3>
      {(data?.projects ?? []).map((p) => <div className="member-row" key={p.slug}><span className="dname" style={{ fontSize: 16 }}><Link to={`/projects/${p.slug}`}>{p.name}</Link></span><span className="bio">{p.tagline}</span></div>)}
      <h3 style={{ marginTop: 30 }}>专栏</h3>
      {(data?.columns ?? []).map((c) => <div className="member-row" key={c.slug}><span className="dname" style={{ fontSize: 16 }}><Link to={`/columns/${c.slug}`}>{c.title}</Link></span><span className="bio">{c.subtitle} {c.topics}</span></div>)}
      <h3 style={{ marginTop: 30 }}>成员</h3>
      {(data?.members ?? []).map((m) => <div className="member-row" key={m.id}><Avatar name={m.display_name} size={26} /><span className="dname" style={{ fontSize: 16 }}>{m.display_name}</span><span className="bio">{m.bio}</span></div>)}
      {data && !(data.projects?.length || data.columns?.length || data.members?.length) && <p className="dim">没有匹配结果。</p>}
    </div>
  );
}
