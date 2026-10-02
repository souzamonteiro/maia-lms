CREATE TRIGGER enrolled_revision_module_insert
BEFORE INSERT ON modules
WHEN EXISTS (
  SELECT 1 FROM enrollments e WHERE e.revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrolled revision structure is immutable');
END;

CREATE TRIGGER enrolled_revision_module_update
BEFORE UPDATE ON modules
WHEN EXISTS (
  SELECT 1 FROM enrollments e
  WHERE e.revision_id = OLD.revision_id OR e.revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrolled revision structure is immutable');
END;

CREATE TRIGGER enrolled_revision_module_delete
BEFORE DELETE ON modules
WHEN EXISTS (
  SELECT 1 FROM enrollments e WHERE e.revision_id = OLD.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrolled revision structure is immutable');
END;

CREATE TRIGGER enrolled_revision_lesson_insert
BEFORE INSERT ON lessons
WHEN EXISTS (
  SELECT 1
  FROM modules m
  JOIN enrollments e ON e.revision_id = m.revision_id
  WHERE m.id = NEW.module_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrolled revision structure is immutable');
END;

CREATE TRIGGER enrolled_revision_lesson_update
BEFORE UPDATE ON lessons
WHEN EXISTS (
  SELECT 1
  FROM modules m
  JOIN enrollments e ON e.revision_id = m.revision_id
  WHERE m.id = OLD.module_id OR m.id = NEW.module_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrolled revision structure is immutable');
END;

CREATE TRIGGER enrolled_revision_lesson_delete
BEFORE DELETE ON lessons
WHEN EXISTS (
  SELECT 1
  FROM modules m
  JOIN enrollments e ON e.revision_id = m.revision_id
  WHERE m.id = OLD.module_id
)
BEGIN
  SELECT RAISE(ABORT, 'enrolled revision structure is immutable');
END;