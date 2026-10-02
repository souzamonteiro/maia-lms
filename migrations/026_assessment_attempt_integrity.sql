CREATE TRIGGER attempt_revision_insert
BEFORE INSERT ON attempts
WHEN NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN quizzes q ON q.id = NEW.quiz_id
  WHERE e.id = NEW.enrollment_id
    AND e.revision_id = NEW.revision_id
    AND q.revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt revision mismatch');
END;

CREATE TRIGGER attempt_revision_update
BEFORE UPDATE OF enrollment_id, quiz_id, revision_id ON attempts
WHEN NOT EXISTS (
  SELECT 1
  FROM enrollments e
  JOIN quizzes q ON q.id = NEW.quiz_id
  WHERE e.id = NEW.enrollment_id
    AND e.revision_id = NEW.revision_id
    AND q.revision_id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt revision mismatch');
END;

CREATE TRIGGER enrollment_attempt_revision_update
BEFORE UPDATE OF revision_id ON enrollments
WHEN EXISTS (
  SELECT 1 FROM attempts a
  WHERE a.enrollment_id = OLD.id AND a.revision_id != NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt revision mismatch');
END;

CREATE TRIGGER quiz_attempt_revision_update
BEFORE UPDATE OF revision_id ON quizzes
WHEN EXISTS (
  SELECT 1 FROM attempts a
  WHERE a.quiz_id = OLD.id AND a.revision_id != NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment attempt revision mismatch');
END;

CREATE TRIGGER attempt_answer_question_insert
BEFORE INSERT ON attempt_answers
WHEN NOT EXISTS (
  SELECT 1
  FROM attempts a
  JOIN questions q ON q.id = NEW.question_id
  WHERE a.id = NEW.attempt_id AND q.quiz_id = a.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment answer quiz mismatch');
END;

CREATE TRIGGER attempt_answer_question_update
BEFORE UPDATE OF attempt_id, question_id ON attempt_answers
WHEN NOT EXISTS (
  SELECT 1
  FROM attempts a
  JOIN questions q ON q.id = NEW.question_id
  WHERE a.id = NEW.attempt_id AND q.quiz_id = a.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment answer quiz mismatch');
END;

CREATE TRIGGER attempt_answer_attempt_quiz_update
BEFORE UPDATE OF quiz_id ON attempts
WHEN EXISTS (
  SELECT 1
  FROM attempt_answers aa
  JOIN questions q ON q.id = aa.question_id
  WHERE aa.attempt_id = OLD.id AND q.quiz_id != NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment answer quiz mismatch');
END;

CREATE TRIGGER attempt_answer_question_quiz_update
BEFORE UPDATE OF quiz_id ON questions
WHEN EXISTS (
  SELECT 1
  FROM attempt_answers aa
  JOIN attempts a ON a.id = aa.attempt_id
  WHERE aa.question_id = OLD.id AND a.quiz_id != NEW.quiz_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment answer quiz mismatch');
END;