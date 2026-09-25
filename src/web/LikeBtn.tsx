import { useState } from "react";
import { api } from "./api";
import { useMe } from "./App";

// Heart toggle for projects, columns, updates and comments.
export function LikeBtn({ targetType, targetId, initial }: {
  targetType: "project" | "column" | "update" | "comment";
  targetId: number;
  initial: { count: number; liked: boolean };
}) {
  const { me } = useMe();
  const [state, setState] = useState(initial);
  const toggle = async () => {
    if (!me) { location.href = "/login"; return; }
    setState((s) => ({ count: s.count + (s.liked ? -1 : 1), liked: !s.liked }));
    try {
      const d = await api("/likes/toggle", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: targetId }) });
      setState({ count: d.count, liked: d.liked });
    } catch { setState(initial); }
  };
  return (
    <button
      className={`like-btn${state.liked ? " liked" : ""}`}
      onClick={toggle}
      aria-pressed={state.liked}
      title={state.liked ? "取消点赞" : "点赞"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={state.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      {state.count > 0 && <span>{state.count}</span>}
    </button>
  );
}
