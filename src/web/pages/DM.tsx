import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { api } from "../api";
import { useMe } from "../App";
import { Avatar } from "../Avatar";
import { I } from "../icons";

export default function DM() {
  const { lang } = useLang();
  const { me } = useMe();
  const [sp] = useSearchParams();
  const [withKey, setWithKey] = useState(sp.get("with") ?? "");
  const [convs, setConvs] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [other, setOther] = useState<any>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [to, setTo] = useState("");

  const loadConvs = () => api("/dm").then((d) => setConvs(d.conversations)).catch(() => {});
  const loadMsgs = (k: string) =>
    api(`/dm?with=${encodeURIComponent(k)}`).then((d) => { setMsgs(d.messages); setOther(d.with); setErr(null); })
      .catch((e) => setErr(String(e.message)));

  useEffect(() => { if (me) { loadConvs(); if (withKey) loadMsgs(withKey); } }, [me, withKey]);

  if (!me) return <div className="err-full">401</div>;
  const send = async (e: any) => {
    e.preventDefault();
    if (!text.trim() || !other) return;
    await api("/dm", { method: "POST", body: JSON.stringify({ to: String(other.id), text }) });
    setText("");
    loadMsgs(withKey); loadConvs();
  };
  return (
    <div className="wrap" style={{ padding: "48px 24px", display: "grid", gridTemplateColumns: "280px 1fr", gap: 28, minHeight: "60vh" }}>
      <div>
        <h3 style={{ margin: "0 0 14px" }}>{lang === "zh" ? "私信" : "Messages"}</h3>
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); if (to.trim()) { setWithKey(to.trim()); } }}>
          <input type="text" placeholder={lang === "zh" ? "对方用户名或ID" : "username or id"} value={to} onChange={(e: any) => setTo(e.target.value)} style={{ width: "100%" }} />
        </form>
        {convs.length === 0 && <p className="dim" style={{ fontSize: 13 }}>{lang === "zh" ? "暂无会话。私信需要至少一方是导师或管理员。" : "No conversations yet. A teacher or admin must be one side."}</p>}
        {convs.map((cv) => (
          <div key={cv.id} className="member-row" style={{ cursor: "pointer" }} onClick={() => setWithKey(String(cv.id))}>
            <Avatar name={cv.display_name} src={cv.avatar} size={26} />
            <span className="dname" style={{ fontSize: 15, minWidth: 0 }}>
              {cv.display_name}{cv.role !== "member" && <span className="pill gold" style={{ marginLeft: 6 }}>{cv.role === "admin" ? "管理" : "导师"}</span>}
              <span className="dim" style={{ display: "block", fontSize: 12, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{cv.last_text}</span>
            </span>
            {cv.unread > 0 && <span className="pill gold">{cv.unread}</span>}
          </div>
        ))}
      </div>
      <div>
        {!withKey && <div className="empty"><b>{lang === "zh" ? "选择一个会话" : "Pick a conversation"}</b>{lang === "zh" ? "输入用户名或 ID 发起私信。" : "Enter a username or id to start."}</div>}
        {err && <div className="error-box" role="alert">{err}</div>}
        {withKey && !err && (
          <>
            <h3 style={{ margin: "0 0 14px" }}>{other?.display_name}</h3>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, maxHeight: "50vh", overflowY: "auto", background: "var(--card)" }}>
              {msgs.map((msg) => (
                <div key={msg.id} style={{ textAlign: msg.from_id === me.id ? "right" : "left", margin: "8px 0" }}>
                  <span style={{ display: "inline-block", background: msg.from_id === me.id ? "var(--gold-soft)" : "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "7px 14px", maxWidth: "75%", textAlign: "left", fontSize: 14.5 }}>
                    {msg.text}<span className="dim" style={{ fontSize: 11, marginLeft: 8 }}>{msg.created_at.slice(11, 16)}</span>
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="text" required placeholder={lang === "zh" ? "说点什么…（审核适用）" : "Say something…"} value={text} onChange={(e: any) => setText(e.target.value)} style={{ flex: 1 }} />
              <button className="btn primary small"><I name="send" size={13} />{lang === "zh" ? "发送" : "Send"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
