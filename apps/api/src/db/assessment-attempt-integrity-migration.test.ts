import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps assessment attempts and answers within their enrollment, revision and quiz', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','user'),('course-b','course-b','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision-a','course-a','Course A','Summary A'),
             ('revision-b','course-b','Course B','Summary B');
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES ('module-b','revision-b',0,'Module B');
      INSERT INTO lessons(id,module_id,sort_order,title)
      VALUES ('lesson-b','module-b',0,'Lesson B');
      INSERT INTO quizzes(id,revision_id,lesson_id,max_attempts) VALUES
        ('quiz-a','revision-a',NULL,3),
        ('quiz-b','revision-b',NULL,2),
        ('quiz-b-transfer','revision-b','lesson-b',1);
      INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys)
      VALUES ('question-a','quiz-a','Question A','[]','[]'),
             ('question-b','quiz-b','Question B','[]','[]');
      UPDATE questions SET sort_order=1 WHERE id='question-b';
            UPDATE quizzes SET pass_percent=80 WHERE id='quiz-b';
            UPDATE questions SET prompt='Edited before any attempt' WHERE id='question-b';
      UPDATE quizzes SET time_limit_seconds=300 WHERE id='quiz-b';
                  INSERT INTO enrollments(id,user_id,course_id,revision_id)
                  VALUES ('enrollment-a','user','course-a','revision-a'),
                    ('enrollment-b','user','course-b','revision-b');
      INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed)
      VALUES ('attempt-a','enrollment-a','quiz-a','revision-a','seed');
    `);

    expect(() =>
      db
        .prepare('INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed) VALUES(?,?,?,?,?)')
        .run('cross-revision-attempt', 'enrollment-a', 'quiz-b', 'revision-a', 'seed'),
    ).toThrow(/assessment attempt revision mismatch/);
    expect(() =>
      db.prepare('UPDATE attempts SET revision_id=? WHERE id=?').run('revision-b', 'attempt-a'),
    ).toThrow(/assessment attempt revision mismatch/);
    expect(() =>
      db.prepare('UPDATE enrollments SET revision_id=? WHERE id=?').run('revision-b', 'enrollment-a'),
    ).toThrow(/enrollment assignment is immutable/);
    expect(() =>
      db.prepare('UPDATE quizzes SET revision_id=? WHERE id=?').run('revision-b', 'quiz-a'),
    ).toThrow(/assessment attempt revision mismatch/);
    expect(() =>
      db.prepare('UPDATE quizzes SET pass_percent=? WHERE id=?').run(80, 'quiz-a'),
    ).toThrow(/assessment definition is in use by attempts/);
    expect(() =>
      db.prepare('UPDATE quizzes SET max_attempts=? WHERE id=?').run(0, 'quiz-b'),
    ).toThrow(/invalid quiz numeric configuration/);
    expect(() =>
      db.prepare('UPDATE quizzes SET pass_percent=? WHERE id=?').run(70.5, 'quiz-b'),
    ).toThrow(/invalid quiz numeric configuration/);
    expect(() =>
      db.prepare('UPDATE quizzes SET time_limit_seconds=? WHERE id=?').run(0, 'quiz-b-transfer'),
    ).toThrow(/invalid quiz time limit/);

    const addAttempt = db.prepare(
      'INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed) VALUES(?,?,?,?,?)',
    );
    addAttempt.run('attempt-b-1', 'enrollment-b', 'quiz-b', 'revision-b', 'seed-1');
    db.prepare(
      "INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed,started_at) VALUES(?,?,?,?,?,'2000-01-01T00:00:00Z')",
    ).run('attempt-b-2', 'enrollment-b', 'quiz-b', 'revision-b', 'seed-2');
    expect(() =>
      addAttempt.run('attempt-b-3', 'enrollment-b', 'quiz-b', 'revision-b', 'seed-3'),
    ).toThrow(/assessment attempt limit reached/);
    addAttempt.run('attempt-b-transfer', 'enrollment-b', 'quiz-b-transfer', 'revision-b', 'seed-transfer');
    expect(() =>
      db.prepare('UPDATE attempts SET quiz_id=? WHERE id=?').run('quiz-b', 'attempt-b-transfer'),
    ).toThrow(/assessment attempt limit reached/);
    expect(() => db.prepare('DELETE FROM attempts WHERE id=?').run('attempt-b-1')).toThrow(
      /assessment attempt history is retained/,
    );
    expect(() =>
      db.prepare('UPDATE quizzes SET time_limit_seconds=? WHERE id=?').run(600, 'quiz-b'),
    ).toThrow(/assessment definition is in use by attempts/);
    expect(() =>
      db.prepare('UPDATE attempts SET started_at=? WHERE id=?').run('2000-01-01T00:00:00Z', 'attempt-b-1'),
    ).toThrow(/assessment attempt start time is immutable/);
    expect(() =>
      db.prepare('UPDATE attempts SET started_at=? WHERE id=?').run('2099-01-01T00:00:00Z', 'attempt-b-2'),
    ).toThrow(/assessment attempt start time is immutable/);
    expect(() =>
      db.prepare('INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)')
        .run('attempt-b-2', 'question-b', '[]'),
    ).toThrow(/assessment attempt deadline expired/);
    expect(() =>
      db.prepare('UPDATE attempts SET submitted_at=datetime(\'now\') WHERE id=?').run('attempt-b-2'),
    ).toThrow(/assessment attempt deadline expired/);
    expect(() =>
      db.prepare('UPDATE questions SET points=? WHERE id=?').run(0, 'question-b'),
    ).toThrow(/invalid assessment question numeric value/);
    expect(() =>
      db.prepare('UPDATE questions SET sort_order=? WHERE id=?').run(-1, 'question-b'),
    ).toThrow(/invalid assessment question numeric value/);
    expect(() =>
      db.prepare('UPDATE questions SET correct_choice_keys=? WHERE id=?').run('["A"]', 'question-a'),
    ).toThrow(/assessment definition is in use by attempts/);
    expect(() =>
      db.prepare('INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys) VALUES(?,?,?,?,?)')
        .run('question-a-late', 'quiz-a', 'Late question', '[]', '[]'),
    ).toThrow(/assessment definition is in use by attempts/);
    expect(() => db.prepare('DELETE FROM questions WHERE id=?').run('question-a')).toThrow(
      /assessment definition is in use by attempts/,
    );
    expect(() => db.prepare('DELETE FROM quizzes WHERE id=?').run('quiz-a')).toThrow(
      /assessment definition is in use by attempts/,
    );

    db.prepare('INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)').run(
      'attempt-a',
      'question-a',
      '[]',
    );
    expect(() =>
      db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(2, 'attempt-a'),
    ).toThrow(/invalid awarded assessment points/);
    expect(() =>
      db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(-1, 'attempt-a'),
    ).toThrow(/invalid awarded assessment points/);
    db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(1, 'attempt-a');
    expect(() =>
      db
        .prepare('INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)')
        .run('attempt-a', 'question-b', '[]'),
    ).toThrow(/assessment answer quiz mismatch/);
    expect(() =>
      db.prepare('UPDATE questions SET quiz_id=? WHERE id=?').run('quiz-b', 'question-a'),
    ).toThrow(/assessment definition is in use by attempts/);
    expect(() =>
      db.prepare('UPDATE attempts SET quiz_id=? WHERE id=?').run('quiz-b', 'attempt-a'),
    ).toThrow(/assessment answer quiz mismatch/);
    expect(() =>
      db.prepare('UPDATE attempt_answers SET selected_keys=? WHERE attempt_id=?').run('["A"]', 'attempt-a'),
    ).not.toThrow();
    db.prepare('UPDATE attempts SET submitted_at=datetime(\'now\'),score=100,pass=1 WHERE id=?').run(
      'attempt-a',
    );
    expect(() =>
      db.prepare('UPDATE attempts SET score=? WHERE id=?').run(0, 'attempt-a'),
    ).toThrow(/submitted assessment attempt is immutable/);
    expect(() =>
      db.prepare('INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)')
        .run('attempt-a', 'question-a', '[]'),
    ).toThrow(/submitted assessment attempt is immutable/);
    expect(() =>
      db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(0, 'attempt-a'),
    ).toThrow(/submitted assessment attempt is immutable/);
    expect(() => db.prepare('DELETE FROM attempt_answers WHERE attempt_id=?').run('attempt-a')).toThrow(
      /submitted assessment attempt is immutable/,
    );
    expect(
      db.prepare('SELECT attempt_id,question_id,selected_keys FROM attempt_answers').all(),
    ).toEqual([{ attempt_id: 'attempt-a', question_id: 'question-a', selected_keys: '["A"]' }]);
  } finally {
    db.close();
  }
});