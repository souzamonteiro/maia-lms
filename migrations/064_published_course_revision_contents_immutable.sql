CREATE TRIGGER published_revision_module_insert
BEFORE INSERT ON modules
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_module_update
BEFORE UPDATE ON modules
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id IN (OLD.revision_id, NEW.revision_id) AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id IN (OLD.revision_id, NEW.revision_id)
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_module_delete
BEFORE DELETE ON modules
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = OLD.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = OLD.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_lesson_insert
BEFORE INSERT ON lessons
WHEN EXISTS (
  SELECT 1 FROM modules m JOIN course_revisions r ON r.id = m.revision_id
  WHERE m.id = NEW.module_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM modules m JOIN courses c ON c.published_revision_id = m.revision_id
  WHERE m.id = NEW.module_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_lesson_update
BEFORE UPDATE ON lessons
WHEN EXISTS (
  SELECT 1 FROM modules m JOIN course_revisions r ON r.id = m.revision_id
  WHERE m.id IN (OLD.module_id, NEW.module_id) AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM modules m JOIN courses c ON c.published_revision_id = m.revision_id
  WHERE m.id IN (OLD.module_id, NEW.module_id)
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_lesson_delete
BEFORE DELETE ON lessons
WHEN EXISTS (
  SELECT 1 FROM modules m JOIN course_revisions r ON r.id = m.revision_id
  WHERE m.id = OLD.module_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM modules m JOIN courses c ON c.published_revision_id = m.revision_id
  WHERE m.id = OLD.module_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_attachment_insert
BEFORE INSERT ON course_attachments
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_attachment_update
BEFORE UPDATE ON course_attachments
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id IN (OLD.revision_id, NEW.revision_id) AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id IN (OLD.revision_id, NEW.revision_id)
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_attachment_delete
BEFORE DELETE ON course_attachments
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = OLD.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = OLD.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_category_insert
BEFORE INSERT ON course_revision_categories
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_category_update
BEFORE UPDATE ON course_revision_categories
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id IN (OLD.revision_id, NEW.revision_id) AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id IN (OLD.revision_id, NEW.revision_id)
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_category_delete
BEFORE DELETE ON course_revision_categories
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = OLD.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = OLD.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_quiz_insert
BEFORE INSERT ON quizzes
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = NEW.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_quiz_update
BEFORE UPDATE ON quizzes
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id IN (OLD.revision_id, NEW.revision_id) AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id IN (OLD.revision_id, NEW.revision_id)
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_quiz_delete
BEFORE DELETE ON quizzes
WHEN EXISTS (
  SELECT 1 FROM course_revisions r
  WHERE r.id = OLD.revision_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM courses c WHERE c.published_revision_id = OLD.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_question_insert
BEFORE INSERT ON questions
WHEN EXISTS (
  SELECT 1 FROM quizzes q JOIN course_revisions r ON r.id = q.revision_id
  WHERE q.id = NEW.quiz_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM quizzes q JOIN courses c ON c.published_revision_id = q.revision_id
  WHERE q.id = NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_question_update
BEFORE UPDATE ON questions
WHEN EXISTS (
  SELECT 1 FROM quizzes q JOIN course_revisions r ON r.id = q.revision_id
  WHERE q.id IN (OLD.quiz_id, NEW.quiz_id) AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM quizzes q JOIN courses c ON c.published_revision_id = q.revision_id
  WHERE q.id IN (OLD.quiz_id, NEW.quiz_id)
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;

CREATE TRIGGER published_revision_question_delete
BEFORE DELETE ON questions
WHEN EXISTS (
  SELECT 1 FROM quizzes q JOIN course_revisions r ON r.id = q.revision_id
  WHERE q.id = OLD.quiz_id AND r.published_at IS NOT NULL
) OR EXISTS (
  SELECT 1 FROM quizzes q JOIN courses c ON c.published_revision_id = q.revision_id
  WHERE q.id = OLD.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'published course revision is immutable');
END;