CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  repo_url TEXT,
  website_url TEXT,
  avatar TEXT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  is_minor INTEGER NOT NULL DEFAULT 0,
  guardian_name TEXT,
  guardian_contact TEXT,
  real_name_public INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  repo_url TEXT,
  statement TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_minor INTEGER NOT NULL DEFAULT 0,
  guardian_name TEXT,
  guardian_contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  repo_url TEXT,
  demo_url TEXT,
  poster_url TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  domain_id TEXT REFERENCES domains(id),
  status TEXT NOT NULL DEFAULT 'pending',
  owner_id INTEGER NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id),
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, member_id)
);

CREATE TABLE IF NOT EXISTS project_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  track TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  instructors TEXT NOT NULL DEFAULT '',
  total_hours INTEGER,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  lesson_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, course_id)
);

CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  column_label TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  author_title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS mentors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mentor_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id INTEGER NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  course_title TEXT NOT NULL,
  hours INTEGER,
  level TEXT
);

CREATE TABLE IF NOT EXISTS mentor_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  mentor_id INTEGER NOT NULL REFERENCES mentors(id),
  interest TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT '',
  questions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TEXT,
  location TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'coming_soon'
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  monogram TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  read INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_member_read ON notifications(member_id, read);

CREATE TABLE IF NOT EXISTS project_stacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE (project_id, tag)
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repo_cache (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_member ON project_members(member_id);
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_notif_member ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_updates_project ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_joinreq_project ON join_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

CREATE TABLE IF NOT EXISTS project_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id),
  UNIQUE (project_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_pfollows_member ON project_follows(member_id);

CREATE TABLE IF NOT EXISTS member_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followee_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  follower_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE (followee_id, follower_id)
);
CREATE INDEX IF NOT EXISTS idx_mfollows_follower ON member_follows(follower_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES members(id),
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
