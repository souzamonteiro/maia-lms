CREATE TRIGGER quiz_numeric_bounds_insert
BEFORE INSERT ON quizzes
WHEN typeof(NEW.pass_percent) != 'integer'
  OR NEW.pass_percent < 1
  OR NEW.pass_percent > 100
  OR typeof(NEW.max_attempts) != 'integer'
  OR NEW.max_attempts < 1
  OR typeof(NEW.randomize_questions) != 'integer'
BEGIN
  SELECT RAISE(ABORT, 'invalid quiz numeric configuration');
END;

CREATE TRIGGER quiz_numeric_bounds_update
BEFORE UPDATE OF pass_percent, max_attempts, randomize_questions ON quizzes
WHEN typeof(NEW.pass_percent) != 'integer'
  OR NEW.pass_percent < 1
  OR NEW.pass_percent > 100
  OR typeof(NEW.max_attempts) != 'integer'
  OR NEW.max_attempts < 1
  OR typeof(NEW.randomize_questions) != 'integer'
BEGIN
  SELECT RAISE(ABORT, 'invalid quiz numeric configuration');
END;

CREATE TRIGGER question_numeric_bounds_insert
BEFORE INSERT ON questions
WHEN typeof(NEW.points) != 'integer'
  OR NEW.points < 1
  OR typeof(NEW.sort_order) != 'integer'
  OR NEW.sort_order < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question numeric value');
END;

CREATE TRIGGER question_numeric_bounds_update
BEFORE UPDATE OF points, sort_order ON questions
WHEN typeof(NEW.points) != 'integer'
  OR NEW.points < 1
  OR typeof(NEW.sort_order) != 'integer'
  OR NEW.sort_order < 0
BEGIN
  SELECT RAISE(ABORT, 'invalid assessment question numeric value');
END;

CREATE TRIGGER attempt_answer_awarded_points_insert
BEFORE INSERT ON attempt_answers
WHEN typeof(NEW.awarded_points) != 'integer'
  OR NEW.awarded_points < 0
  OR NEW.awarded_points > COALESCE((
    SELECT q.points FROM questions q WHERE q.id = NEW.question_id
  ), 0)
BEGIN
  SELECT RAISE(ABORT, 'invalid awarded assessment points');
END;

CREATE TRIGGER attempt_answer_awarded_points_update
BEFORE UPDATE OF awarded_points, question_id ON attempt_answers
WHEN typeof(NEW.awarded_points) != 'integer'
  OR NEW.awarded_points < 0
  OR NEW.awarded_points > COALESCE((
    SELECT q.points FROM questions q WHERE q.id = NEW.question_id
  ), 0)
BEGIN
  SELECT RAISE(ABORT, 'invalid awarded assessment points');
END;