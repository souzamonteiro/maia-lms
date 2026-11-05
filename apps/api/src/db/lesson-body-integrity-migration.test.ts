import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('enforces lesson body UTF-16 limits and NUL exclusion on direct SQL writes', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','course','author');
      INSERT INTO course_revisions(id,course_id,title,summary)
        VALUES('revision','course','Course title','A sufficiently long summary');
      INSERT INTO modules(id,revision_id,sort_order,title)
        VALUES('module','revision',0,'Module title');
    `);

    const insertLesson = db.prepare(`
      INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES(?,?,?,'Lesson',?)
    `);
    const boundaryBody = '😀'.repeat(50000);
    insertLesson.run('boundary', 'module', 0, boundaryBody);
    insertLesson.run('legacy-null', 'module', 1, null);

    for (const [id, body] of [
      ['too-many-units', '😀'.repeat(50001)],
      ['over-codepoint-limit', 'a'.repeat(100001)],
      ['embedded-nul', `Lesson\u0000body`],
    ]) {
      expect(() => insertLesson.run(id, 'module', 2, body))
        .toThrow(/invalid lesson body/);
    }

    expect(() => db.prepare('UPDATE lessons SET body=? WHERE id=?')
      .run('😀'.repeat(50001), 'boundary')).toThrow(/invalid lesson body/);
    expect(() => db.prepare('UPDATE lessons SET body=? WHERE id=?')
      .run('Body\u0000suffix', 'boundary')).toThrow(/invalid lesson body/);
    expect(db.prepare('SELECT body FROM lessons WHERE id=?').get('boundary').body)
      .toBe(boundaryBody);
  } finally {
    db.close();
  }
});
