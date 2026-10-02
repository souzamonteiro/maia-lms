CREATE TRIGGER enrollment_course_revision_insert
BEFORE INSERT ON enrollments
WHEN NOT EXISTS (
  SELECT 1
  FROM course_revisions r
  WHERE r.id = NEW.revision_id AND r.course_id = NEW.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrollment course revision mismatch');
END;

CREATE TRIGGER enrollment_course_revision_update
BEFORE UPDATE OF course_id, revision_id ON enrollments
WHEN NOT EXISTS (
  SELECT 1
  FROM course_revisions r
  WHERE r.id = NEW.revision_id AND r.course_id = NEW.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrollment course revision mismatch');
END;

CREATE TRIGGER course_revision_enrollment_course_update
BEFORE UPDATE OF course_id ON course_revisions
WHEN EXISTS (
  SELECT 1
  FROM enrollments e
  WHERE e.revision_id = OLD.id AND e.course_id != NEW.course_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrollment course revision mismatch');
END;