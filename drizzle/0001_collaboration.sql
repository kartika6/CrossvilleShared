CREATE TABLE cv_projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  access_revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE cv_members (
  project_id TEXT NOT NULL REFERENCES cv_projects(id),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'reviewer', 'editor', 'viewer')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX cv_members_user ON cv_members(user_id);
CREATE TABLE cv_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES cv_projects(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('reviewer', 'editor', 'viewer')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_by TEXT,
  accepted_at TEXT,
  revoked_at TEXT
);
CREATE INDEX cv_invitations_project ON cv_invitations(project_id);
CREATE TABLE cv_user_settings (
  user_id TEXT PRIMARY KEY NOT NULL,
  active_project_id TEXT,
  csrf_token TEXT NOT NULL
);
