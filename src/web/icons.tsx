import {
  Star, CodeXml, Users, Clock, GitFork, Check, Circle, ArrowRight,
  ExternalLink, Play, Link2, Home, BookOpen, PenLine, CalendarDays,
  GraduationCap, FolderKanban, Inbox, ShieldCheck, MessageSquare,
  FileText, Sparkles, TrendingUp, Bell, User, Save, X, Plus, Trash2,
  Send, Search, Eye, LogOut, Download, Upload, Flag, Ban, Heart,
  Settings, RotateCw, SquarePen, type LucideIcon,
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
  message: MessageSquare, file: FileText, spark: Sparkles, trend: TrendingUp, bell: Bell, user: User,
  save: Save, x: X, plus: Plus, trash: Trash2, send: Send, search: Search,
  eye: Eye, logout: LogOut, download: Download, upload: Upload, flag: Flag,
  ban: Ban, heart: Heart, settings: Settings, refresh: RotateCw, edit: SquarePen,
};

export function I({ name, size = 14 }: { name: keyof typeof MAP | string; size?: number }) {
  const Cmp = MAP[name] ?? Star;
  return <Cmp size={size} strokeWidth={2} aria-hidden="true" />;
}
