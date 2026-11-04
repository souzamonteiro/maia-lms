import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows promotions only for published courses that are not withdrawn', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES('published-course','published-course','user'),
            ('draft-course','draft-course','user'),
            ('withdrawn-course','withdrawn-course','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('published-revision','published-course','Published','Summary'),
            ('withdrawn-revision','withdrawn-course','Withdrawn','Summary');
      UPDATE course_revisions SET published_at=datetime('now')
        WHERE id IN ('published-revision','withdrawn-revision');
      UPDATE courses SET published_revision_id='published-revision'
        WHERE id='published-course';
      UPDATE courses SET status='PUBLISHED' WHERE id='published-course';
      UPDATE courses SET published_revision_id='withdrawn-revision'
        WHERE id='withdrawn-course';
      UPDATE courses SET status='PUBLISHED' WHERE id='withdrawn-course';
      UPDATE courses SET withdrawn_at=datetime('now'),withdrawal_reason='Legal request'
        WHERE id='withdrawn-course';
    `);

    const insert = db.prepare(
      'INSERT INTO promotions(id,slot,course_id,starts_at,priority) VALUES(?,?,?,?,?)',
    );
    expect(() =>
      insert.run('published-placement', 'featured', 'published-course', '2026-10-04T10:00:00Z', 0),
    ).not.toThrow();
    expect(() =>
      insert.run('draft-placement', 'recommended', 'draft-course', '2026-10-04T10:00:00Z', 0),
    ).toThrow(/promotion course is not available/);
    expect(() =>
      insert.run(
        'withdrawn-placement',
        'recommended',
        'withdrawn-course',
        '2026-10-04T10:00:00Z',
        0,
      ),
    ).toThrow(/promotion course is not available/);

    db.prepare("UPDATE courses SET status='ARCHIVED' WHERE id='published-course'").run();
    expect(() =>
      db.prepare("UPDATE promotions SET course_id='draft-course' WHERE id='published-placement'").run(),
    ).toThrow(/promotion course is not available/);
    expect(db.prepare('SELECT course_id FROM promotions WHERE id=?').get('published-placement'))
      .toEqual({ course_id: 'published-course' });
  } finally {
    db.close();
  }
});
