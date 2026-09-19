const PALETTE = ["#a5751a", "#6d5a3f", "#4f6d5a", "#5a4f6d", "#6d3f3f", "#3f5a6d", "#7a621f", "#59422c"];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) | 0;
  const color = PALETTE[Math.abs(h) % PALETTE.length];
  const initial = [...name.trim()][0] ?? "?";
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size, height: size, background: color, fontSize: size * 0.44,
      }}
    >
      {initial}
    </span>
  );
}
