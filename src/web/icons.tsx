import {
  Star, CodeXml, Users, Clock, GitFork, Check, Circle, ArrowRight,
  ExternalLink, Play, Link2, Home, BookOpen, PenLine, CalendarDays,
  GraduationCap, FolderKanban, Inbox, ShieldCheck, MessageSquare,
  FileText, Sparkles, TrendingUp, Bell, type LucideIcon,
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
  home: Home, book: BookOpen, pen: PenLine, calendar: CalendarDays,
  cap: GraduationCap, folder: FolderKanban, inbox: Inbox, shield: ShieldCheck,
  message: MessageSquare, file: FileText, spark: Sparkles, trend: TrendingUp, bell: Bell,
};

export function I({ name, size = 14 }: { name: keyof typeof MAP | string; size?: number }) {
  const Cmp = MAP[name] ?? Star;
  return <Cmp size={size} strokeWidth={2} aria-hidden="true" />;
}
