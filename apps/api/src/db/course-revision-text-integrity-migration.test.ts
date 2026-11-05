import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('enforces course revision title and summary UTF-16 limits for direct SQL writes', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','course','author');
    `);

    const insertRevision = db.prepare(`
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES(?, 'course', ?, ?)
    `);
    expect(() => insertRevision.run(
      'at-boundaries',
      '😀'.repeat(127) + 'a',
      '😀'.repeat(500),
    )).not.toThrow();

    for (const [id, title, summary] of [
      ['title-over-limit', '😀'.repeat(128), 'A sufficiently long summary'],
      ['summary-over-limit', 'Valid title', '😀'.repeat(501)],
      ['title-with-nul', 'Valid\u0000title', 'A sufficiently long summary'],
      ['summary-with-nul', 'Valid title', 'A sufficiently\u0000long summary'],
    ]) {
      expect(() => insertRevision.run(id, title, summary))
        .toThrow(/invalid course revision text/);
    }

    expect(() => db.prepare('UPDATE course_revisions SET title=? WHERE id=?')
      .run('😀'.repeat(128), 'at-boundaries'))
      .toThrow(/invalid course revision text/);
    expect(() => db.prepare('UPDATE course_revisions SET summary=? WHERE id=?')
      .run('A sufficiently\u0000long summary', 'at-boundaries'))
      .toThrow(/invalid course revision text/);
    expect(db.prepare('SELECT title,summary FROM course_revisions WHERE id=?')
      .get('at-boundaries')).toEqual({
      title: '😀'.repeat(127) + 'a',
      summary: '😀'.repeat(500),
    });
  } finally {
    db.close();
  }
});
