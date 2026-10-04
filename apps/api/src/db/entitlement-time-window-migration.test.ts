import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires parseable entitlement start times and strictly later optional end times', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('revision','course','Course','Summary');
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
      VALUES('enrollment','user','course','revision');
    `);

    const insert = db.prepare(
      'INSERT INTO entitlements(id,enrollment_id,source_type,starts_at,ends_at) VALUES(?,?,?,?,?)',
    );
    insert.run('open-ended', 'enrollment', 'free', '2026-10-04T10:00:00.000Z', null);
    insert.run('bounded', 'enrollment', 'admin', '2026-10-04T10:00:00.000Z', '2026-10-04T11:00:00.000Z');

    expect(() =>
      insert.run('end-before-start', 'enrollment', 'admin', '2026-10-04T10:00:00.000Z', '2026-10-04T09:59:59.000Z'),
    ).toThrow(/invalid entitlement time window/);
    expect(() =>
      insert.run('zero-length', 'enrollment', 'admin', '2026-10-04T10:00:00.000Z', '2026-10-04T10:00:00.000Z'),
    ).toThrow(/invalid entitlement time window/);
    expect(() =>
      insert.run('bad-start', 'enrollment', 'admin', 'not-a-date', null),
    ).toThrow(/invalid entitlement time window/);
    expect(() =>
      insert.run('bad-end', 'enrollment', 'admin', '2026-10-04T10:00:00.000Z', 'not-a-date'),
    ).toThrow(/invalid entitlement time window/);

    expect(() =>
      db.prepare('UPDATE entitlements SET ends_at=? WHERE id=?').run('2026-10-04T09:00:00.000Z', 'bounded'),
    ).toThrow(/invalid entitlement time window/);
    expect(() =>
      db.prepare('UPDATE entitlements SET starts_at=? WHERE id=?').run('not-a-date', 'open-ended'),
    ).toThrow(/invalid entitlement time window/);
  } finally {
    db.close();
  }
});
