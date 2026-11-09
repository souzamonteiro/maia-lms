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
      INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,points)
      VALUES ('question-a','quiz-a','Question A','[{"key":"A","text":"A"}]','["A"]',101),
             ('question-b','quiz-b','Question B','[]','[]',1);
      UPDATE questions SET sort_order=1 WHERE id='question-b';
            UPDATE quizzes SET pass_percent=80 WHERE id='quiz-b';
            UPDATE questions SET prompt='Edited before any attempt' WHERE id='question-b';
      UPDATE quizzes SET time_limit_seconds=300 WHERE id='quiz-b';
                  INSERT INTO enrollments(
                    id,user_id,course_id,revision_id,required_lesson_ids_snapshot,quiz_ids_snapshot
                  ) VALUES ('enrollment-a','user','course-a','revision-a','[]','["quiz-a"]'),
                    ('enrollment-b','user','course-b','revision-b','["lesson-b"]','["quiz-b","quiz-b-transfer"]');
                  INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
                  VALUES ('entitlement-a','enrollment-a','admin',datetime('now','-1 day')),
                         ('entitlement-b','enrollment-b','admin',datetime('now','-1 day'));
                  INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed)
                  VALUES ('attempt-a','enrollment-a','quiz-a','revision-a','seed');
    `);

    db.prepare(
      'UPDATE questions SET choices_json=?,correct_choice_keys=? WHERE id=?',
    ).run('[{"key":"A","text":"Choice A"},{"key":"B","text":"Choice B"}]', '["A"]', 'question-b');
    const addQuestion = db.prepare(
      'INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,sort_order) VALUES(?,?,?,?,?,?)',
    );
    for (const [index, [choices, correctKeys]] of [
      ['{invalid-json', '[]'],
      ['[{"key":"A","text":"A"},{"key":"A","text":"Duplicate"}]', '["A"]'],
      ['[{"key":"A","text":"A"}]', '["unknown"]'],
      ['[{"key":"A","text":"A"}]', '["A","A"]'],
    ].entries()) {
      expect(() =>
        addQuestion.run(
          `invalid-question-${index}`,
          'quiz-b',
          'Invalid question',
          choices,
          correctKeys,
          99,
        ),
      ).toThrow(/invalid assessment question choices/);
    }
    for (const invalidChoices of [
      '{invalid-json',
      '{"key":"A","text":"Choice A"}',
      '[{"key":1,"text":"Choice A"}]',
      '[{"key":"A","text":""}]',
      '[{"key":"A","text":"Choice A"},{"key":"A","text":"Duplicate"}]',
    ]) {
      expect(() =>
        db.prepare('UPDATE questions SET choices_json=? WHERE id=?').run(invalidChoices, 'question-b'),
      ).toThrow(/invalid assessment question choices/);
    }
    for (const invalidCorrectKeys of [
      '{invalid-json',
      '{"key":"A"}',
      '[1]',
      '["unknown"]',
      '["A","A"]',
    ]) {
      expect(() =>
        db.prepare('UPDATE questions SET correct_choice_keys=? WHERE id=?').run(
          invalidCorrectKeys,
          'question-b',
        ),
      ).toThrow(/invalid assessment question choices/);
    }
    expect(() =>
      db.prepare('UPDATE questions SET correct_choice_keys=? WHERE id=?').run('["B"]', 'question-b'),
    ).not.toThrow();

    expect(() =>
      db
        .prepare('INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed) VALUES(?,?,?,?,?)')
        .run('cross-revision-attempt', 'enrollment-a', 'quiz-b', 'revision-a', 'seed'),
    ).toThrow(/assessment attempt revision mismatch/);
    for (const [field, value] of [
      ['id', 'attempt-a-renamed'],
      ['enrollment_id', 'enrollment-b'],
      ['quiz_id', 'quiz-b'],
      ['revision_id', 'revision-b'],
      ['seed', 'tampered-seed'],
    ]) {
      expect(() => db.prepare(`UPDATE attempts SET ${field}=? WHERE id=?`).run(value, 'attempt-a'))
        .toThrow(/assessment attempt identity is immutable/);
    }
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
    expect(() => db.prepare(`INSERT INTO attempts(
      id,enrollment_id,quiz_id,revision_id,seed,submitted_at,score,pass
    ) VALUES(?,?,?,?,?,datetime('now'),100,1)`)
      .run('submitted-on-insert','enrollment-a','quiz-a','revision-a','seed-insert'))
      .toThrow(/assessment attempt must start open/);
    for (const [id, startedAt] of [
      ['future-start', "datetime('now','+1 minute')"],
      ['invalid-start', "'not-a-timestamp'"],
    ]) {
      expect(() => db.prepare(`INSERT INTO attempts(
        id,enrollment_id,quiz_id,revision_id,seed,started_at
      ) VALUES(?,?,?,?,?,${startedAt})`)
        .run(id,'enrollment-a','quiz-a','revision-a',id))
        .toThrow(/invalid assessment attempt start time/);
    }
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
    ).toThrow(/assessment attempt identity is immutable/);
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
      db.prepare('UPDATE attempts SET submitted_at=datetime(\'now\'),score=0,pass=0 WHERE id=?').run('attempt-b-2'),
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
    for (const invalidSelection of [
      '{invalid-json',
      '{"key":"A"}',
      '[1]',
      '["unknown"]',
      '["A","A"]',
    ]) {
      expect(() => db.prepare(
        'UPDATE attempt_answers SET selected_keys=? WHERE attempt_id=? AND question_id=?',
      ).run(invalidSelection, 'attempt-a', 'question-a'))
        .toThrow(/invalid assessment answer selection/);
    }
    expect(() => db.prepare(
      'INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)',
    ).run('attempt-b-1', 'question-b', '[1]'))
      .toThrow(/invalid assessment answer selection/);
    expect(() => db.prepare(
      'INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)',
    ).run('attempt-b-1', 'question-b', '"not-an-array"'))
      .toThrow(/invalid assessment answer selection/);
    expect(() => db.prepare(
      'UPDATE attempt_answers SET selected_keys=? WHERE attempt_id=? AND question_id=?',
    ).run('["A"]', 'attempt-a', 'question-a')).not.toThrow();
    expect(() =>
      db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(102, 'attempt-a'),
    ).toThrow(/invalid awarded assessment points/);
    expect(() =>
      db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(-1, 'attempt-a'),
    ).toThrow(/invalid awarded assessment points/);
    db.prepare('UPDATE attempt_answers SET awarded_points=? WHERE attempt_id=?').run(101, 'attempt-a');
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
    ).toThrow(/assessment attempt identity is immutable/);
    expect(() =>
      db.prepare('UPDATE attempt_answers SET selected_keys=? WHERE attempt_id=?').run('["A"]', 'attempt-a'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE attempts SET score=? WHERE id=?').run(40, 'attempt-a'),
    ).toThrow(/invalid assessment attempt result state/);
    expect(() =>
      db.prepare('UPDATE attempts SET submitted_at=?,score=?,pass=? WHERE id=?').run(
        new Date().toISOString(),
        102,
        1,
        'attempt-a',
      ),
    ).toThrow();
    expect(() => db.prepare(`UPDATE attempts SET submitted_at=datetime('now','+1 minute'),score=0,pass=0
      WHERE id='attempt-a'`).run())
      .toThrow(/invalid assessment attempt submission time/);
    expect(() => db.prepare(`UPDATE attempts SET submitted_at='not-a-timestamp',score=0,pass=0
      WHERE id='attempt-a'`).run())
      .toThrow(/invalid assessment attempt submission time/);
    expect(() => db.prepare(`UPDATE attempts SET submitted_at='2000-01-01T00:00:00Z',score=0,pass=0
      WHERE id='attempt-a'`).run())
      .toThrow(/invalid assessment attempt submission time/);
    expect(() => db.prepare(`UPDATE attempts SET submitted_at=datetime('now'),score=0,pass=0
      WHERE id='attempt-a'`).run())
      .toThrow(/assessment result does not match submitted answers/);
    db.prepare('UPDATE attempt_answers SET awarded_points=0 WHERE attempt_id=?').run('attempt-a');
    expect(() => db.prepare(`UPDATE attempts SET submitted_at=datetime('now'),score=0,pass=0
      WHERE id='attempt-a'`).run())
      .toThrow(/assessment result does not match submitted answers/);
    db.prepare('UPDATE attempt_answers SET awarded_points=101 WHERE attempt_id=?').run('attempt-a');
    expect(() => db.prepare(`UPDATE attempts SET submitted_at=datetime('now'),score=1,pass=0
      WHERE id='attempt-a'`).run())
      .toThrow(/assessment result does not match submitted answers/);
    expect(() =>
      db.prepare('UPDATE attempts SET submitted_at=?,score=?,pass=? WHERE id=?').run(
        new Date().toISOString(),
        75,
        2,
        'attempt-a',
      ),
    ).toThrow(/invalid assessment attempt result state/);
    db.prepare('UPDATE attempts SET submitted_at=datetime(\'now\'),score=101,pass=1 WHERE id=?').run(
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

    db.prepare('INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed) VALUES(?,?,?,?,?)')
      .run('attempt-open-a','enrollment-a','quiz-a','revision-a','open-seed');
    db.prepare('INSERT INTO attempt_answers(attempt_id,question_id,selected_keys,awarded_points) VALUES(?,?,?,?)')
      .run('attempt-open-a','question-a','["A"]',101);
    db.prepare("UPDATE entitlements SET revoked_at=datetime('now') WHERE id='entitlement-a'").run();
    expect(() => addAttempt.run('attempt-after-revocation','enrollment-a','quiz-a','revision-a','seed-revoked'))
      .toThrow(/assessment attempt requires active enrollment/);
    expect(() => db.prepare('UPDATE attempt_answers SET selected_keys=? WHERE attempt_id=?')
      .run('["A"]','attempt-open-a'))
      .toThrow(/assessment attempt requires active enrollment/);
    expect(() => db.prepare('DELETE FROM attempt_answers WHERE attempt_id=?').run('attempt-open-a'))
      .toThrow(/assessment attempt requires active enrollment/);
    db.prepare("UPDATE entitlements SET revoked_at=datetime('now') WHERE id='entitlement-b'").run();
    expect(() => db.prepare('INSERT INTO attempt_answers(attempt_id,question_id,selected_keys) VALUES(?,?,?)')
      .run('attempt-b-1','question-b','[]'))
      .toThrow(/assessment attempt requires active enrollment/);
    expect(() => db.prepare("UPDATE attempts SET submitted_at=datetime('now'),score=101,pass=1 WHERE id='attempt-open-a'")
      .run())
      .toThrow(/assessment attempt requires active enrollment/);
  } finally {
    db.close();
  }
});