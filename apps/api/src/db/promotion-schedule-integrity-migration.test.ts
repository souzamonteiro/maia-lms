import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates promotion slot, priority, and time window on insert and update', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','user');
      INSERT INTO courses(id,slug,author_id) VALUES('other-course','other-course','user');
    `);
    const insert = db.prepare(
      'INSERT INTO promotions(id,slot,course_id,starts_at,ends_at,priority) VALUES(?,?,?,?,?,?)',
    );
    insert.run(
      'valid',
      'featured',
      'course',
      '2026-10-04T10:00:00.000Z',
      '2026-10-04T11:00:00.000Z',
      1000,
    );
    insert.run('open-ended', 'recommended', 'course', '2026-10-04T10:00:00.000Z', null, 0);

    expect(() =>
      insert.run('invalid-slot', 'sidebar', 'course', '2026-10-04T10:00:00.000Z', null, 0),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run('negative-priority', 'hero', 'course', '2026-10-04T10:00:00.000Z', null, -1),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run('large-priority', 'hero', 'course', '2026-10-04T10:00:00.000Z', null, 1001),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run('text-priority', 'hero', 'course', '2026-10-04T10:00:00.000Z', null, 'high'),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run('invalid-start', 'hero', 'course', 'not-a-date', null, 0),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run(
        'invalid-end',
        'hero',
        'course',
        '2026-10-04T10:00:00.000Z',
        'not-a-date',
        0,
      ),
    ).toThrow(/invalid promotion schedule/);
    insert.run('hero', 'hero', 'course', '2026-10-04T10:00:00.000Z', null, 0);

    expect(() =>
      insert.run(
        'end-before-start',
        'featured',
        'other-course',
        '2026-10-04T10:00:00.000Z',
        '2026-10-04T09:00:00.000Z',
        0,
      ),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run(
        'zero-duration',
        'featured',
        'other-course',
        '2026-10-04T10:00:00.000Z',
        '2026-10-04T10:00:00.000Z',
        0,
      ),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      insert.run(
        'duplicate-placement',
        'featured',
        'course',
        '2026-10-04T10:00:00.000Z',
        null,
        1,
      ),
    ).toThrow(/duplicate promotion placement/);
    expect(() =>
      insert.run(
        'second-hero',
        'hero',
        'other-course',
        '2026-10-04T10:00:00.000Z',
        null,
        1,
      ),
    ).toThrow(/duplicate promotion placement/);

    expect(() =>
      db.prepare('UPDATE promotions SET priority=5 WHERE id=?').run('valid'),
    ).not.toThrow();
    expect(() =>
      db.prepare("UPDATE promotions SET slot='featured' WHERE id='open-ended'").run(),
    ).toThrow(/duplicate promotion placement/);
    expect(() =>
      db.prepare("UPDATE promotions SET slot='sidebar' WHERE id=?").run('valid'),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      db.prepare("UPDATE promotions SET starts_at='not-a-date' WHERE id=?").run('valid'),
    ).toThrow(/invalid promotion schedule/);
    expect(() =>
      db.prepare("UPDATE promotions SET ends_at=starts_at WHERE id=?").run('valid'),
    ).toThrow(/invalid promotion schedule/);
  } finally {
    db.close();
  }
});
