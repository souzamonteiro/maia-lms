-- Global taxonomy with revision-scoped course assignments.
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE TABLE course_revision_categories (
  revision_id TEXT NOT NULL REFERENCES course_revisions(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (revision_id, category_id)
);
CREATE INDEX idx_revision_categories_category ON course_revision_categories(category_id, revision_id);
