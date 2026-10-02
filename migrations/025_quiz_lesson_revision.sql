CREATE TRIGGER quiz_lesson_revision_insert
BEFORE INSERT ON quizzes
WHEN NEW.lesson_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id AND m.revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'quiz lesson revision mismatch');
END;

CREATE TRIGGER quiz_lesson_revision_update
BEFORE UPDATE OF revision_id, lesson_id ON quizzes
WHEN NEW.lesson_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id AND m.revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'quiz lesson revision mismatch');
END;

CREATE TRIGGER quiz_module_revision_update
BEFORE UPDATE OF revision_id ON modules
WHEN EXISTS (
  SELECT 1
  FROM lessons l
  JOIN quizzes q ON q.lesson_id = l.id
  WHERE l.module_id = OLD.id AND q.revision_id != NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'quiz lesson revision mismatch');
END;

CREATE TRIGGER quiz_lesson_module_update
BEFORE UPDATE OF module_id ON lessons
WHEN EXISTS (
  SELECT 1 FROM quizzes q
  JOIN modules m ON m.id = NEW.module_id
  WHERE q.lesson_id = OLD.id AND q.revision_id != m.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'quiz lesson revision mismatch');
END;