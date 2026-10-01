CREATE TRIGGER lesson_progress_revision_insert
BEFORE INSERT ON lesson_progress
WHEN (
  SELECT m.revision_id
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id
) != (
  SELECT e.revision_id FROM enrollments e WHERE e.id = NEW.enrollment_id
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress revision mismatch');
END;

CREATE TRIGGER lesson_progress_revision_update
BEFORE UPDATE OF enrollment_id, lesson_id ON lesson_progress
WHEN (
  SELECT m.revision_id
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id
) != (
  SELECT e.revision_id FROM enrollments e WHERE e.id = NEW.enrollment_id
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress revision mismatch');
END;

CREATE TRIGGER enrollment_revision_progress_update
BEFORE UPDATE OF revision_id ON enrollments
WHEN EXISTS (
  SELECT 1
  FROM lesson_progress p
  JOIN lessons l ON l.id = p.lesson_id
  JOIN modules m ON m.id = l.module_id
  WHERE p.enrollment_id = NEW.id AND m.revision_id != NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress revision mismatch');
END;

CREATE TRIGGER lesson_module_progress_update
BEFORE UPDATE OF module_id ON lessons
WHEN EXISTS (
  SELECT 1
  FROM lesson_progress p
  JOIN enrollments e ON e.id = p.enrollment_id
  JOIN modules m ON m.id = NEW.module_id
  WHERE p.lesson_id = NEW.id AND e.revision_id != m.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'lesson progress revision mismatch');
END;