import { useEffect, type RefObject } from "react";

const SKIP = "script,style,pre,code,.katex,.mermaid-host,mark,textarea,input,select";

// Highlights query terms in plain text nodes under the referenced element.
// DOM-walking (not string replacement on HTML), so it is safe inside
// dangerouslySetInnerHTML markdown and skips code blocks and rendered math.
export function useHighlight(ref: RefObject<HTMLElement | null>, q: string, also: unknown[] = []) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const terms = q.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return;
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      const text = node as Text;
      const parent = text.parentElement;
      if (parent && !parent.closest(SKIP) && pattern.test(text.nodeValue ?? "")) targets.push(text);
      pattern.lastIndex = 0;
      node = walker.nextNode();
    }
    for (const text of targets) {
      const frag = document.createDocumentFragment();
      for (const part of (text.nodeValue ?? "").split(pattern)) {
        if (!part) continue;
        if (terms.some((t) => part.toLowerCase() === t.toLowerCase())) {
          const mark = document.createElement("mark");
          mark.style.background = "var(--gold-soft)";
          mark.style.color = "var(--gold)";
          mark.style.borderRadius = "2px";
          mark.style.padding = "0 2px";
          mark.textContent = part;
          frag.appendChild(mark);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      }
      text.parentElement?.replaceChild(frag, text);
    }
  }, [ref, q, ...also]);
}
