import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Avatar } from "../Avatar";
import { I } from "../icons";

type DocsPayload = {
  language: string;
  fields: { name: string; boost: number }[];
  docs: { ref: string; title: string; text: string }[];
  meta: Record<string, { kind: string; href: string; sub?: string }>;
};

// Marz loads once per page: ~300 KB of WebAssembly, then the index is built
// in-browser from the public docs payload and every query runs offline.
let marzModule: Promise<any> | null = null;
const loadMarz = () => {
  if (!marzModule) {
    marzModule = (async () => {
      const base = location.origin + "/vendor/marz/pkg";
      const mod = await import(/* @vite-ignore */ `${base}/marz_wasm.js?v=1`);
      await mod.default({ module_or_path: `${base}/marz_wasm_bg.wasm?v=1` });
      return mod;
    })().catch((e) => { marzModule = null; throw e; });
  }
  return marzModule;
};

const Hi = ({ text, q }: { text?: string; q: string }) => {
  if (!text) return null;
  const terms = q.split(/\s+/).filter(Boolean);
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!pattern) return <>{text}</>;
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return <>{parts.map((part, i) => terms.some((t) => part.toLowerCase() === t.toLowerCase()) ? <mark key={i} style={{ background: "var(--gold-soft)", color: "var(--gold)", borderRadius: 2, padding: "0 2px" }}>{part}</mark> : part)}</>;
};

const KIND_LABEL: Record<string, string> = { project: "项目", column: "专栏", update: "项目动态", member: "成员" };

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const [payload, setPayload] = useState<DocsPayload | null>(null);
  const [index, setIndex] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [docs, mod] = await Promise.all([
          fetch("/api/search/docs").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<DocsPayload>; }),
          loadMarz(),
        ]);
        if (!live) return;
        setPayload(docs);
        const b = new mod.MarzBuilder(docs.language, "ref");
        for (const f of docs.fields) b.field(f.name, f.boost);
        for (const d of docs.docs) b.add({ ref: d.ref, title: d.title, text: d.text });
        const idx = mod.MarzIndex.load(b.build(), docs.language);
        if (live) setIndex(idx);
      } catch (e: any) {
        if (live) setErr(String(e?.message ?? e));
      }
    })();
    return () => { live = false; };
  }, []);

  const results = useMemo(() => {
    if (!index || !q.trim()) return [] as { hit: any; m: DocsPayload["meta"][string] }[];
    try {
      return ((index.search(q.trim(), 40) as any[])
        .map((h) => ({ hit: h, m: payload?.meta?.[h.ref] }))
        .filter((r): r is { hit: any; m: DocsPayload["meta"][string] } => !!r.m));
    } catch { return []; }
  }, [index, q, payload]);

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of results) { (g[r.m.kind] ??= []).push(r); }
    return g;
  }, [results]);

  const setQ = (v: string) => setSp(v ? { q: v } : {});

  return (
    <div className="wrap" style={{ padding: "48px 24px" }}>
      <h1 className="serif" style={{ fontSize: 30, display: "flex", alignItems: "center", gap: 10 }}><I name="search" size={22} />搜索</h1>
      <input
        type="text" value={q} autoFocus placeholder="搜索项目、专栏、成员、动态…"
        onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 480, marginBottom: 24 }}
        aria-label="搜索"
      />
      {err && <div className="error-box" role="alert">{err}</div>}
      {!index && !err && <p className="dim"><I name="refresh" size={13} /> 正在加载离线搜索引擎…</p>}
      {index && !q.trim() && <p className="dim">输入关键词，全部在本地完成——支持中文分词，断网也能搜。</p>}
      {index && q.trim() && (
        <>
          {(["project", "column", "update", "member"] as const).map((kind) => (
            (groups[kind]?.length ?? 0) > 0 && (
              <section key={kind}>
                <h3 style={{ marginTop: kind === "project" ? 0 : 30 }}>{KIND_LABEL[kind]}</h3>
                {groups[kind].map(({ hit, m }: any) => (
                  <div className="member-row" key={hit.ref}>
                    {kind === "member" && <Avatar name={payload?.docs.find((d) => d.ref === hit.ref)?.title ?? "?"} size={26} />}
                    <span className="dname" style={{ fontSize: 16 }}>
                      {m.href ? <Link to={{ pathname: m.href, search: q ? `?hl=${encodeURIComponent(q)}` : "" }}>{payload?.docs.find((d) => d.ref === hit.ref)?.title || m.sub}</Link> : payload?.docs.find((d) => d.ref === hit.ref)?.title}
                    </span>
                    <span className="bio"><Hi text={m.sub || payload?.docs.find((d) => d.ref === hit.ref)?.text} q={q} /></span>
                    <span className="pill" style={{ marginLeft: "auto" }}>{Math.round(hit.score)}</span>
                  </div>
                ))}
              </section>
            )
          ))}
          {results.length === 0 && <p className="dim">没有匹配结果。</p>}
        </>
      )}
      <p className="dim" style={{ marginTop: 40, fontSize: 12 }}><I name="spark" size={12} /> 由 marz 离线搜索引擎驱动 · 索引 {payload?.docs.length ?? 0} 条公开内容 · 查询不经过服务器</p>
    </div>
  );
}
