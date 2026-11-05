import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires published course revision timestamps to be parseable while allowing drafts', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('author','author@example.com','author@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','author')`).run();
    const insertRevision = db.prepare(`
      INSERT INTO course_revisions(id,course_id,title,summary,published_at)
      VALUES(?, 'course', 'Title', 'Summary', ?)
    `);
    insertRevision.run('draft-null', null);
    insertRevision.run('iso-draft', null);

    for (const publishedAt of [
      'not-a-date',
      '2026-11-05 10:00:00\u0000invalid',
      Buffer.from('2026-11-05 10:00:00'),
    ]) {
      expect(() =>
        db.prepare('UPDATE course_revisions SET published_at=? WHERE id=?')
          .run(publishedAt, 'draft-null'),
      ).toThrow(/course revision published timestamp is invalid/);
    }

    const updatePublishedAt = db.prepare('UPDATE course_revisions SET published_at=? WHERE id=?');
    updatePublishedAt.run('2026-11-05 10:00:00', 'draft-null');
    updatePublishedAt.run('2026-11-05T10:00:00.123Z', 'iso-draft');
    expect(() => updatePublishedAt.run('2026-11-05T10:01:00.000Z', 'draft-null'))
      .toThrow(/published course revision is immutable/);
    expect(db.prepare('SELECT published_at FROM course_revisions WHERE id=?').get('draft-null'))
      .toEqual({ published_at: '2026-11-05 10:00:00' });
    expect(db.prepare('SELECT published_at FROM course_revisions WHERE id=?').get('iso-draft'))
      .toEqual({ published_at: '2026-11-05T10:00:00.123Z' });
  } finally {
    db.close();
  }
});
