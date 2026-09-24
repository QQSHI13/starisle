import { useEffect, useRef, useState } from "react";
import { marked } from "marked";

// Lazy loaders — heavy libraries load from CDN only when content needs them.
let katexLoading: Promise<any> | null = null;
const loadKatex = () => {
  if (!katexLoading) {
    katexLoading = Promise.all([
      // @ts-ignore CDN import
      import("https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.mjs"),
      new Promise((res) => {
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
        l.onload = res;
        document.head.appendChild(l);
      }),
    ]);
  }
  return katexLoading;
};
let mermaidLoading: Promise<any> | null = null;
const loadMermaid = () => {
  if (!mermaidLoading) {
    // @ts-ignore CDN import
    mermaidLoading = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs").then((m) => {
      m.default.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral" });
      return m.default;
    });
  }
  return mermaidLoading;
};

export function Md({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  const hasMath = /\$\$[^$]+\$\$|\$[^$\n]+\$/.test(text);
  const hasMermaid = /```mermaid/.test(text);

  useEffect(() => {
    let live = true;
    (async () => {
      if (hasMath) await loadKatex();
      if (hasMermaid) await loadMermaid();
      if (live) setReady((x) => x + 1);
    })();
  }, [text, hasMath, hasMermaid]);

  useEffect(() => {
    if (!ref.current || ready === 0) return;
    (async () => {
      if (hasMath) {
        const katex = (await loadKatex())[0].default;
        ref.current!.querySelectorAll(".math-block, .math-inline").forEach((el) => {
          if ((el as any).dataset.done) return;
          try {
            katex.render(el.textContent ?? "", el, { displayMode: el.classList.contains("math-block"), throwOnError: false });
            (el as any).dataset.done = "1";
          } catch { /* leave raw */ }
        });
      }
      if (hasMermaid) {
        const mermaid = await loadMermaid();
        const nodes = [...ref.current!.querySelectorAll("pre code.language-mermaid")];
        for (const [i, node] of nodes.entries()) {
          if ((node.parentElement as any)?.dataset.done) continue;
          const host = document.createElement("div");
          host.className = "mermaid-host";
          try {
            const { svg } = await mermaid.render(`mmd-${Date.now()}-${i}`, node.textContent ?? "");
            host.innerHTML = svg;
            node.parentElement!.replaceWith(host);
            (host as any).dataset.done = "1";
          } catch { /* leave code */ }
        }
      }
    })();
  }, [ready, text]);

  const html = (() => {
    let t = text;
    if (hasMath) {
      t = t.replace(/\$\$([^$]+)\$\$/g, (_, m) => `<div class="math-block">${m}</div>`);
      t = t.replace(/\$([^$\n]+)\$/g, (_, m) => `<span class="math-inline">${m}</span>`);
    }
    return marked.parse(t, { async: false, gfm: true, breaks: true }) as string;
  })();

  return <div className="md" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
