import {
  Star, CodeXml, Users, Clock, GitFork, Check, Circle, ArrowRight,
  ExternalLink, Play, Link2, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  star: Star,
  repo: CodeXml,
  users: Users,
  clock: Clock,
  fork: GitFork,
  check: Check,
  circle: Circle,
  arrow: ArrowRight,
  ext: ExternalLink,
  play: Play,
  link: Link2,
};

export function I({ name, size = 14 }: { name: keyof typeof MAP | string; size?: number }) {
  const Cmp = MAP[name] ?? Star;
  return <Cmp size={size} strokeWidth={2} aria-hidden="true" />;
}
