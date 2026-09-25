import { useState } from "react";

const BTNS: [string, string, string][] = [
  ["B", "**", "**"], ["I", "*", "*"], ["链接", "[", "](https://)"],
  ["代码", "`", "`"], ["列表", "\n- ", ""], ["公式", "$$", "$$"], ["图", "```mermaid\nflowchart LR\n  A --> B\n```", ""],
];

export function MdToolbar({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const wrap = (pre: string, post: string) => {
    const el = document.getElementById("md-ta") as HTMLTextAreaElement;
    const [a, b] = sel;
    const next = value.slice(0, a) + pre + value.slice(a, b) + post + value.slice(b);
    onChange(next);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
        {BTNS.map(([label, pre, post]) => (
          <button key={label} type="button" className="btn small" style={{ padding: "3px 9px", fontSize: 12 }} onClick={() => wrap(pre, post)}>{label}</button>
        ))}
      </div>
      <textarea id="md-ta" rows={rows} value={value} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setSel([e.target.selectionStart, e.target.selectionEnd]); }}
        onSelect={(e: any) => setSel([e.target.selectionStart, e.target.selectionEnd])} />
    </div>
  );
}
