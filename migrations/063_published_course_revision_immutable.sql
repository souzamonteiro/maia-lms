CREATE TRIGGER published_course_revision_insert
BEFORE INSERT ON course_revisions
WHEN NEW.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_course_revision_update
BEFORE UPDATE ON course_revisions
WHEN OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_course_revision_snapshot_update
BEFORE UPDATE ON course_revisions
WHEN OLD.published_at IS NULL
  AND (
    NEW.published_at IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM courses c WHERE c.published_revision_id = OLD.id
    )
  )
  AND (
    NEW.id IS NOT OLD.id OR NEW.course_id IS NOT OLD.course_id
    OR NEW.title IS NOT OLD.title OR NEW.summary IS NOT OLD.summary
    OR NEW.learning_outcomes IS NOT OLD.learning_outcomes
    OR NEW.image_alt IS NOT OLD.image_alt OR NEW.image_key IS NOT OLD.image_key
    OR NEW.trailer_media_id IS NOT OLD.trailer_media_id OR NEW.level IS NOT OLD.level
    OR NEW.duration_minutes IS NOT OLD.duration_minutes
    OR NEW.policy_json IS NOT OLD.policy_json OR NEW.created_at IS NOT OLD.created_at
    OR NEW.slug IS NOT OLD.slug OR NEW.access_mode IS NOT OLD.access_mode
    OR NEW.locale IS NOT OLD.locale OR NEW.cover_file_id IS NOT OLD.cover_file_id
    OR NEW.cover_alt IS NOT OLD.cover_alt OR NEW.prerequisites IS NOT OLD.prerequisites
    OR NEW.instructor_name IS NOT OLD.instructor_name
    OR NEW.instructor_bio IS NOT OLD.instructor_bio
    OR NEW.access_terms IS NOT OLD.access_terms
    OR NEW.certificate_terms IS NOT OLD.certificate_terms
    OR NEW.trailer_video_id IS NOT OLD.trailer_video_id
  )
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_course_revision_delete
BEFORE DELETE ON course_revisions
WHEN OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;