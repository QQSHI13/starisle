export async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    ...opts,
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `request failed (${r.status})`);
  return data;
}
