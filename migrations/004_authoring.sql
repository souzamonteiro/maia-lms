-- Keep current_revision_id as the editable revision for compatibility.
-- Never infer a new publication for an old DRAFT or ARCHIVED course.
ALTER TABLE courses ADD COLUMN published_revision_id TEXT REFERENCES course_revisions(id);
UPDATE courses SET published_revision_id = current_revision_id
WHERE status IN ('PUBLISHED', 'ARCHIVED') AND EXISTS (
  SELECT 1 FROM course_revisions r WHERE r.id = courses.current_revision_id AND r.published_at IS NOT NULL
);
ALTER TABLE course_revisions ADD COLUMN slug TEXT;
ALTER TABLE course_revisions ADD COLUMN access_mode TEXT CHECK (access_mode IN ('OPEN_FREE', 'ENROLLED_FREE', 'PAID'));
ALTER TABLE course_revisions ADD COLUMN locale TEXT;
UPDATE course_revisions SET
  slug = (SELECT slug FROM courses WHERE id = course_id),
  access_mode = (SELECT access_mode FROM courses WHERE id = course_id),
  locale = (SELECT locale FROM courses WHERE id = course_id);
-- Existing content must stay literal text after migration.
ALTER TABLE lessons ADD COLUMN content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown'));
CREATE TABLE home_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO home_settings (id) VALUES (1);
CREATE INDEX idx_promotions_slot_dates ON promotions(slot, starts_at, ends_at, priority);
