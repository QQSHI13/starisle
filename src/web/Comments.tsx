import { useState, type FormEvent } from "react";
import { useLang } from "./i18n";
import { useFetch } from "./hooks";
import { api } from "./api";
import { useToast } from "./toast";
import { Editor } from "./Editor";
import { useMe } from "./App";
import { Avatar } from "./Avatar";
import { I } from "./icons";
import { LikeBtn } from "./LikeBtn";

// Shared moderated discussion thread — used under columns and projects.
export function Comments({ targetId, targetType = "column" }: { targetId: number; targetType?: "column" | "project" }) {
  const { lang } = useLang();
  const { me } = useMe();
  const [tick, setTick] = useState(0);
  const [text, setText] = useState("");
  const { data } = useFetch<{ comments: any[] }>(`/comments/list?target=${targetId}&type=${targetType}`, [tick, targetId, targetType]);
  const [note, setNote] = useState<string | null>(null);
  const toast = useToast();
  const items = data?.comments ?? [];
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    setNote(null);
    try {
      await api("/comments", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: targetId, text }) });
      setText(""); toast(lang === "zh" ? "评论已提交，审核后公开" : "Submitted"); setTick((x) => x + 1);
    } catch (e2: any) { setNote(String(e2.message)); }
  };
  return (
    <section style={{ maxWidth: 700, marginBottom: 60 }}>
      <h3 style={{ margin: "40px 0 18px" }}>{lang === "zh" ? "讨论" : "Discussion"} · {items.filter((x) => x.status === "approved").length}</h3>
      {items.map((cm: any) => (
        <div key={cm.id} className={`comment${cm.status === "pending" ? " pending" : ""}`}>
          <div className="who">
            <Avatar name={cm.display_name} size={26} />
            <b>{cm.display_name}</b>
            <span className="dim">{cm.created_at.slice(0, 16)}{cm.status === "pending" ? (lang === "zh" ? " · 审核中，仅你可见" : " · pending, only visible to you") : ""}</span>
            <span style={{ marginLeft: "auto" }}><LikeBtn targetType="comment" targetId={cm.id} initial={{ count: cm.likes_count ?? 0, liked: !!cm.liked }} /></span>
          </div>
          <div className="body">{cm.text}</div>
        </div>
      ))}
      {me ? (
        <form onSubmit={submit}>
          {note && <div className="notice" role="status">{note}</div>}
          <label className="field"><span>{lang === "zh" ? "写下你的想法（支持 Markdown、KaTeX 公式、Mermaid 图）" : "Your thoughts (Markdown, KaTeX, Mermaid supported)"}</span>
            <Editor value={text} onChange={setText} rows={3} /></label>
          <button className="btn primary small"><I name="message" size={13} />{lang === "zh" ? "发表评论" : "Comment"}</button>
          <button className="btn small" type="button" style={{ marginLeft: 8 }} onClick={() => { setText(""); setNote(null); }}><I name="x" size={13} />{lang === "zh" ? "取消" : "Cancel"}</button>
        </form>
      ) : <p className="dim">{lang === "zh" ? "登录后参与讨论。" : "Sign in to join the discussion."}</p>}
    </section>
  );
}
