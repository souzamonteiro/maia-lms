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
      "INSERT INTO modules(id,revision_id,sort_order,title) VALUES('module-a','revision-a',0,'Module A'),('module-b','revision-a',1,'Module B')",
    ).run();
    db.prepare(
      "INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES('lesson-a','module-a',0,'Lesson A','Text'),('lesson-b','module-b',0,'Lesson B','Text')",
    ).run();

    const addQuiz = db.prepare(
      'INSERT INTO quizzes(id,revision_id,lesson_id) VALUES(?,?,?)',
    );
    addQuiz.run('final-a', 'revision-a', null);
    expect(() => addQuiz.run('final-a-duplicate', 'revision-a', null)).toThrow(/UNIQUE constraint failed/);
    expect(() => addQuiz.run('final-b', 'revision-b', null)).not.toThrow();
    expect(() => addQuiz.run('lesson-quiz-a', 'revision-a', 'lesson-a')).not.toThrow();
    expect(() => addQuiz.run('lesson-quiz-b', 'revision-a', 'lesson-b')).not.toThrow();
    expect(() => addQuiz.run('lesson-quiz-a-duplicate', 'revision-a', 'lesson-a')).toThrow(
      /UNIQUE constraint failed/,
    );
  } finally {
    db.close();
  }
});