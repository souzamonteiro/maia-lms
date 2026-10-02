CREATE TABLE instructor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  bio TEXT NOT NULL DEFAULT '' CHECK (length(bio) <= 5000),
  website_url TEXT,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_instructor_profiles_public ON instructor_profiles(is_public, slug);