import { useEffect, useState } from "react";

export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setError(null);
    setLoading(true);
    fetch("/api" + path)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as any).error || r.statusText);
        return r.json() as Promise<T>;
      })
      .then((d: any) => live && setData(d))
      .catch((e) => live && setError(String(e.message ?? e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return { data, error, loading };
}

export function timeAgo(iso: string, lang: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const zh = lang !== "en";
  if (s < 3600) return zh ? "刚刚" : "just now";
  if (s < 86400) return zh ? `${Math.floor(s / 3600)} 小时前` : `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return zh ? `${Math.floor(s / 86400)} 天前` : `${Math.floor(s / 86400)}d ago`;
  return iso.slice(0, 10);
}
