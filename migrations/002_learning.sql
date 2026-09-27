ALTER TABLE lessons ADD COLUMN title TEXT NOT NULL DEFAULT 'Aula';
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE http_sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_http_sessions_expiry ON http_sessions(expires_at);
