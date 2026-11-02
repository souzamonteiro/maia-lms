import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates enrollment completion timestamps without rewriting completion history', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES ('course','course','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision','course','Course','Summary');
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
      VALUES ('enrollment','user','course','revision');
    `);

    expect(() => db.prepare(`INSERT INTO enrollments(
      id,user_id,course_id,revision_id,completed_at
    ) VALUES('invalid-enrollment','user','course','revision','not-a-time')`).run())
      .toThrow(/enrollment completion timestamp is invalid/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='not-a-time'
      WHERE id='enrollment'`).run())
      .toThrow(/enrollment completion timestamp is invalid/);

    db.prepare(`UPDATE enrollments SET completed_at='2026-11-02T18:00:00.000Z'
      WHERE id='enrollment'`).run();
    expect(() => db.prepare(`UPDATE enrollments SET completed_at=NULL
      WHERE id='enrollment'`).run()).toThrow(/enrollment completion is immutable/);
    expect(() => db.prepare(`UPDATE enrollments SET completed_at='2026-11-03T18:00:00.000Z'
      WHERE id='enrollment'`).run()).toThrow(/enrollment completion is immutable/);
  } finally {
    db.close();
  }
});
