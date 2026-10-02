import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows only one final quiz per revision while keeping lesson quizzes independent', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.prepare(
      "INSERT INTO users(id,email,email_normalized,password_hash) VALUES('author','author@example.com','author@example.com','hash')",
    ).run();
    db.prepare("INSERT INTO courses(id,slug,author_id) VALUES('course-a','course-a','author')").run();
    db.prepare("INSERT INTO courses(id,slug,author_id) VALUES('course-b','course-b','author')").run();
    db.prepare(
      "INSERT INTO course_revisions(id,course_id,title,summary) VALUES('revision-a','course-a','Course A','Course A summary'),('revision-b','course-b','Course B','Course B summary')",
    ).run();
    db.prepare(
      "INSERT INTO modules(id,revision_id,sort_order,title) VALUES('module-a','revision-a',0,'Module A'),('module-b','revision-a',1,'Module B'),('module-c','revision-b',0,'Module C')",
    ).run();
    db.prepare(
      "INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES('lesson-a','module-a',0,'Lesson A','Text'),('lesson-b','module-b',0,'Lesson B','Text'),('lesson-c','module-c',0,'Lesson C','Text')",
    ).run();

    const addQuiz = db.prepare(
      'INSERT INTO quizzes(id,revision_id,lesson_id) VALUES(?,?,?)',
    );
    addQuiz.run('final-a', 'revision-a', null);
    expect(() => addQuiz.run('final-a-duplicate', 'revision-a', null)).toThrow(/UNIQUE constraint failed/);
    expect(() => addQuiz.run('final-b', 'revision-b', null)).not.toThrow();
    expect(() => addQuiz.run('lesson-quiz-a', 'revision-a', 'lesson-a')).not.toThrow();
    expect(() => addQuiz.run('lesson-quiz-b', 'revision-a', 'lesson-b')).not.toThrow();
    expect(() => addQuiz.run('lesson-quiz-c', 'revision-b', 'lesson-c')).not.toThrow();
    expect(() => addQuiz.run('cross-revision-quiz', 'revision-a', 'lesson-c')).toThrow(
      /quiz lesson revision mismatch/,
    );
    expect(() => addQuiz.run('lesson-quiz-a-duplicate', 'revision-a', 'lesson-a')).toThrow(
      /UNIQUE constraint failed/,
    );
    expect(() =>
      db.prepare('UPDATE quizzes SET lesson_id=? WHERE id=?').run('lesson-c', 'lesson-quiz-a'),
    ).toThrow(/quiz lesson revision mismatch/);
    expect(() =>
      db.prepare('UPDATE quizzes SET revision_id=? WHERE id=?').run('revision-b', 'lesson-quiz-a'),
    ).toThrow(/quiz lesson revision mismatch/);
    expect(() =>
      db.prepare('UPDATE lessons SET module_id=? WHERE id=?').run('module-c', 'lesson-a'),
    ).toThrow(/quiz lesson revision mismatch/);
    expect(() =>
      db.prepare('UPDATE modules SET revision_id=? WHERE id=?').run('revision-b', 'module-a'),
    ).toThrow(/quiz lesson revision mismatch/);

    const addQuestion = db.prepare(
      'INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,sort_order) VALUES(?,?,?,?,?,?)',
    );
    addQuestion.run('question-a-1', 'lesson-quiz-a', 'First', '[]', '[]', 0);
    expect(() =>
      addQuestion.run('question-a-2', 'lesson-quiz-a', 'Duplicate order', '[]', '[]', 0),
    ).toThrow(/duplicate question sort order/);
    expect(() =>
      addQuestion.run('question-b-1', 'lesson-quiz-b', 'Independent quiz', '[]', '[]', 0),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE questions SET sort_order=? WHERE id=?').run(0, 'question-b-1'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE questions SET sort_order=? WHERE id=?').run(0, 'question-a-1'),
    ).not.toThrow();
    expect(() =>
      addQuestion.run('question-a-3', 'lesson-quiz-a', 'Other', '[]', '[]', 1),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE questions SET sort_order=? WHERE id=?').run(1, 'question-a-1'),
    ).toThrow(/duplicate question sort order/);
  } finally {
    db.close();
  }
});