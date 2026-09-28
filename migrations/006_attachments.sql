ALTER TABLE video_uploads ADD COLUMN media_kind TEXT NOT NULL DEFAULT 'video' CHECK(media_kind IN ('video','attachment'));
CREATE TABLE course_attachments (
 id TEXT PRIMARY KEY,
 revision_id TEXT NOT NULL REFERENCES course_revisions(id),
 lesson_id TEXT REFERENCES lessons(id),
 upload_id TEXT NOT NULL REFERENCES video_uploads(id),
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 sort_order INTEGER NOT NULL CHECK(sort_order >= 0)
);
CREATE INDEX attachments_revision ON course_attachments(revision_id, lesson_id, sort_order);
