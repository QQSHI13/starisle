import { useRef, useState } from "react";
import { Md } from "./Md";
import { I } from "./icons";

const BTNS: [string, string, string, string][] = [
  ["B", "**", "**", "pen"], ["I", "*", "*", "pen"], ["链接", "[标题](https://)", "", "link"],
  ["代码", "`", "`", "repo"], ["引用", "> ", "", "message"], ["列表", "\n- 项目", "", "file"], ["公式", "\n$$公式$$\n", "", "spark"], ["流程图", "\n```mermaid\nflowchart LR\n  A[开始] --> B[结束]\n```\n", "", "fork"],
];

export function Editor({ value, onChange, rows = 8, placeholder, preview = true }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; preview?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const insert = (snippet: string) => {
    const el = ref.current;
    const pos = el ? el.selectionStart : value.length;
    const next = value.slice(0, pos) + snippet + value.slice(el ? el.selectionEnd : pos);
    onChange(next);
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = pos + snippet.length; } });
  };
  const wrap = (pre: string, post: string) => {
    const el = ref.current;
    const a = el ? el.selectionStart : 0, b = el ? el.selectionEnd : 0;
    const inner = value.slice(a, b) || "文字";
    onChange(value.slice(0, a) + pre + inner + post + value.slice(b));
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = a + pre.length; el.selectionEnd = a + pre.length + inner.length; } });
  };
  return (
    <div className="editor">
      <div className="editor-bar">
        <div className="switch" style={{ marginBottom: 0, padding: 2 }}>
          <button type="button" className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}><I name="pen" size={13} /> 编辑</button>
          <button type="button" className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")} disabled={!preview}><I name="eye" size={13} /> 预览</button>
        </div>
        {tab === "write" && (
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {BTNS.map(([label, pre, post, icon]) => (
              <button key={label} type="button" className="btn small" style={{ padding: "3px 9px", fontSize: 12 }}
                onClick={() => (post ? wrap(pre, post) : insert(pre))}><I name={icon} size={13} /> {label}</button>
            ))}
          </span>
        )}
      </div>
      {tab === "write" ? (
        <textarea ref={ref} rows={rows} value={value} placeholder={placeholder ?? "支持 Markdown、KaTeX 公式、Mermaid 图…"}
          onChange={(e) => onChange(e.target.value)} style={{ fontSize: 14, lineHeight: 1.7 }} />
      ) : (
        <div className="editor-preview"><Md text={value || "（暂无可预览内容）"} /></div>
      )}
    </div>
  );
}
