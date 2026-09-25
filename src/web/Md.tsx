import { useEffect, useRef, useState } from "react";
import { marked } from "marked";

// Lazy loaders — heavy libraries load from CDN only when content needs them.
const CDN = ["https://cdn.jsdelivr.net/npm", "https://unpkg.com", "https://cdnjs.cloudflare.com/ajax"];
const tryImport = async (paths: string[]) => {
  for (const p of paths) {
    const url = p.startsWith("http") || p.startsWith("/") ? p : `${CDN[0]}/${p}`;
    try { return await import(/* @vite-ignore */ url); } catch { /* try next CDN form */ }
  }
  for (const base of CDN) {
    for (const p of paths) {
      if (p.startsWith("http") || p.startsWith("/")) continue;
      try { return await import(/* @vite-ignore */ `${base}/${p}`); } catch { /* next */ }
    }
  }
  throw new Error("all sources unreachable");
};
let katexLoading: Promise<any> | null = null;
const loadKatex = () => {
  if (!katexLoading) {
    katexLoading = Promise.all([
      tryImport(["/vendor/katex/katex.min.mjs", "katex@0.16.11/dist/katex.min.mjs"]).then((m) => m.default ?? m),
      new Promise<void>((res) => {
        let i = 0;
        const HREFS = ["/vendor/katex/katex.min.css", ...CDN.map((b) => `${b}/katex@0.16.11/dist/katex.min.css`)];
        const attempt = () => {
          if (i >= HREFS.length) return res();
          const l = document.createElement("link");
          l.rel = "stylesheet";
          l.href = HREFS[i];
          i++;
          l.onload = () => res();
          l.onerror = () => attempt();
          document.head.appendChild(l);
        };
        attempt();
      }),
    ]).catch(() => null);
  }
  return katexLoading;
};
let mermaidLoading: Promise<any> | null = null;
const loadMermaid = () => {
  if (!mermaidLoading) {
    mermaidLoading = tryImport(["/vendor/mermaid/mermaid.esm.min.mjs", "mermaid@11/dist/mermaid.esm.min.mjs"])
      .then((m) => {
        const lib = m.default ?? m;
        lib.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral" });
        return lib;
      }).catch(() => null);
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
        const k = await loadKatex();
        if (!k) return;
        const katex = k[0];
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
        if (!mermaid) return;
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
