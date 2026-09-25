import { useEffect, useRef, useState } from "react";
import { marked } from "marked";

// Markdown is rendered for member-submitted content (project bodies, columns,
// comments-in-waiting), so raw HTML is escaped and only safe URL schemes kept.
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SAFE_URL = /^(https?:|mailto:|\/|#)/i;
marked.use({
  renderer: {
    html({ raw, text }: any) {
      return escapeHtml(String(raw ?? text ?? ""));
    },
    link({ href, title, tokens }: any) {
      const inner = (this as any).parser.parseInline(tokens);
      const h = String(href ?? "");
      if (!SAFE_URL.test(h)) return inner;
      const t = title ? ` title="${escapeHtml(String(title))}"` : "";
      return `<a href="${escapeHtml(h)}"${t} target="_blank" rel="noreferrer noopener">${inner}</a>`;
    },
    image({ href, title, text }: any) {
      const h = String(href ?? "");
      if (!SAFE_URL.test(h)) return escapeHtml(String(text ?? ""));
      const t = title ? ` title="${escapeHtml(String(title))}"` : "";
      return `<img src="${escapeHtml(h)}" alt="${escapeHtml(String(text ?? ""))}"${t} loading="lazy" />`;
    },
  },
} as any);

// Lazy loaders — heavy libraries load from local vendor files, falling back to CDNs.
// Root-relative paths are expanded to full origin URLs so Vite's dev import-analysis
// leaves them alone (importing /public files from source triggers a dev-server error).
const CDN = ["https://cdn.jsdelivr.net/npm", "https://unpkg.com", "https://cdnjs.cloudflare.com/ajax"];
const abs = (p: string) => (p.startsWith("/") ? location.origin + p : p);
const tryImport = async (paths: string[]) => {
  for (const p of paths) {
    const url = p.startsWith("http") ? p : p.startsWith("/") ? abs(p) : `${CDN[0]}/${p}`;
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
        lib.initialize({ startOnLoad: false, securityLevel: "strict", theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral" });
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
    const stash: string[] = [];
    const held = hasMath
      ? text
          .replace(/\$\$([^$]+)\$\$/g, (_, m) => {
            stash.push(`<div class="math-block">${escapeHtml(m)}</div>`);
            return `\n\nZXMATHX${stash.length - 1}XZ\n\n`;
          })
          .replace(/\$([^$\n]+)\$/g, (_, m) => {
            stash.push(`<span class="math-inline">${escapeHtml(m)}</span>`);
            return `ZXMATHX${stash.length - 1}XZ`;
          })
      : text;
    const out = marked.parse(held, { async: false, gfm: true, breaks: true }) as string;
    return stash.length ? out.replace(/ZXMATHX(\d+)XZ/g, (_, i) => stash[Number(i)]) : out;
  })();

  return <div className="md" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
