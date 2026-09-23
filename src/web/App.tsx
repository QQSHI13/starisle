import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useLang } from "./i18n";
import { api } from "./api";
import { Avatar } from "./Avatar";
import Home from "./pages/Home";
import { Projects, ProjectDetail } from "./pages/Projects";
import { Courses, CourseDetail } from "./pages/Courses";
import { Columns, ColumnDetail } from "./pages/Columns";
import { Students, Profile } from "./pages/Students";
import Mentors from "./pages/Mentors";
import { Activities, Resources, Privacy } from "./pages/Static";
import { Apply, ApplyQuery, Login, Recovery } from "./pages/Auth";
import Me from "./pages/Me";
import Admin from "./pages/Admin";

export type Member = {
  id: number; username: string; display_name: string; role: string;
  bio: string | null; repo_url: string | null; email?: string | null;
};

const MeCtx = createContext<{
  me: Member | null;
  refresh: () => void;
  logout: () => void;
}>({ me: null, refresh: () => {}, logout: () => {} });

export const useMe = () => useContext(MeCtx);

const Star = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.2 14.3 9.7 21.8 12 14.3 14.3 12 21.8 9.7 14.3 2.2 12 9.7 9.7Z" />
  </svg>
);

function UserMenu() {
  const { t } = useLang();
  const { me, logout } = useMe();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const refresh = () =>
    api("/notifications").then((d) => setItems(d.notifications)).catch(() => {});
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);
  const unread = items.filter((n) => !n.read).length;
  const markAll = async () => { await api("/notifications/read", { method: "POST" }); refresh(); };
  return (
    <div className="umenu">
      <button className="umenu-btn" aria-label={t.me} onClick={() => nav("/me")}>
        <Avatar name={me!.display_name} src={(me as any).avatar} size={30} />
        {unread > 0 && <span className="umenu-dot" aria-label={`${unread}`} />}
      </button>
      <div className="umenu-panel" role="menu">
        <div className="umenu-head">
          <span>{t.notifications}{unread > 0 ? ` · ${unread}` : ""}</span>
          {unread > 0 && <button className="umenu-link" onClick={markAll}>{t.mark_all_read}</button>}
        </div>
        {items.length === 0 && <div className="umenu-empty">—</div>}
        {items.slice(0, 5).map((n) => (
          <Link key={n.id} to="/me" className={`umenu-item${n.read ? " read" : ""}`}>
            {n.text}
          </Link>
        ))}
        <div className="umenu-foot">
          <Link to="/me" className="umenu-link">{t.me} →</Link>
          {me!.role === "admin" && <Link to="/admin" className="umenu-link">{t.admin}</Link>}
          <button className="umenu-link" onClick={() => { logout(); nav("/"); }}>{t.logout}</button>
        </div>
      </div>
    </div>
  );
}


function Layout({ children }: { children: ReactNode }) {
  const { t, toggle, toggleTheme, theme, lang } = useLang();
  const { me, logout } = useMe();
  const nav = useNavigate();
  const links = [
    ["/projects", t.nav_projects], ["/courses", t.nav_courses], ["/columns", t.nav_columns],
    ["/activities", t.nav_activities], ["/students", t.nav_students],
    ["/resources", t.nav_resources], ["/mentors", t.nav_mentors],
  ] as const;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content · 跳到主要内容</a>
      <header className="site">
        <div className="wrap">
          <Link to="/" className="brand">
            <Star /> 星屿 <small>STARISLE</small>
          </Link>
          <nav className="main" aria-label="main">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="hdr-actions">
            <button className="lang-toggle" onClick={toggleTheme} aria-pressed={theme === "dark"}>{theme === "light" ? t.theme_dark : t.theme_light}</button>
            <button className="lang-toggle" onClick={toggle} aria-pressed={lang === "en"}>{t.language}</button>
            {me ? (
              <UserMenu />
            ) : (
              <Link className="btn small primary" to="/apply">{t.apply}</Link>
            )}
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site">
        <div className="wrap">
          <div className="cols">
            <div>
              <span className="brand"><Star /> 星屿 <small>STARISLE</small></span>
              <p className="tag">{t.footer_tag}</p>
            </div>
            <nav aria-label="footer">
              <h4>{t.footer_browse}</h4>
              <Link to="/projects">{t.nav_projects}</Link>
              <Link to="/apply">{t.apply}</Link>
              <Link to="/login">{t.login}</Link>
              <Link to="/account-recovery">{t.recovery}</Link>
            </nav>
          </div>
          <div className="legal">
            <span>© 2026 星屿 Starisle</span>
            <Link to="/privacy">{t.privacy_title}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  const [me, setMe] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = () =>
    api("/auth/me").then((d) => setMe(d.member)).catch(() => setMe(null));
  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, []);
  if (!ready) return <div className="loading">…</div>;
  return (
    <MeCtx.Provider value={{ me, refresh, logout: () => api("/auth/logout", { method: "POST" }).then(() => setMe(null)) }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/columns" element={<Columns />} />
          <Route path="/columns/:slug" element={<ColumnDetail />} />
          <Route path="/students" element={<Students />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/mentors" element={<Mentors />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/apply/query" element={<ApplyQuery />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account-recovery" element={<Recovery />} />
          <Route path="/me" element={<Me />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </MeCtx.Provider>
  );
}

function NotFound() {
  const { t } = useLang();
  return (
    <div className="form-page" style={{ textAlign: "center", paddingTop: 120 }}>
      <p className="kicker">404</p>
      <h1 className="serif" style={{ fontSize: 72, margin: "10px 0 16px" }}>∅</h1>
      <p className="sub">{t.not_found}</p>
      <Link className="btn primary" to="/">{t.back_home}</Link>
    </div>
  );
}
