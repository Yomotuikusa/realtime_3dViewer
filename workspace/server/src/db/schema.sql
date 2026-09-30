CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  owner_id TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_room_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  display_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id, last_opened_at);

CREATE TABLE IF NOT EXISTS model_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  number INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, number)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT NOT NULL REFERENCES model_versions(id),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  anchor_json TEXT NOT NULL,
  camera_json TEXT NOT NULL,
  strokes_json TEXT NOT NULL,
  playback_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('open','resolved')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  author_id TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id, created_at);
