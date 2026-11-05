import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('matches instructor profile slug validation on direct inserts and updates', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    const addUser = db.prepare(
      "INSERT INTO users(id,email,email_normalized,password_hash,role) VALUES(?,?,?,?,'author')",
    );
    addUser.run('user', 'user@example.com', 'user@example.com', 'hash');
    const insert = db.prepare(
      'INSERT INTO instructor_profiles(user_id,slug,display_name) VALUES(?,?,?)',
    );
    insert.run('user', 'ada-lovelace', 'Ada Lovelace');

    const invalidSlugs = [
      'ab',
      'Ada-lovelace',
      '-ada',
      'ada-',
      'ada--lovelace',
      'ada_lovelace',
      'a'.repeat(81),
    ];
    for (const [index, slug] of invalidSlugs.entries()) {
      addUser.run(
        `user-${index}`,
        `user-${index}@example.com`,
        `user-${index}@example.com`,
        'hash',
      );
      expect(() =>
        insert.run(`user-${index}`, slug, 'Instructor'),
      ).toThrow(/invalid instructor profile slug|CHECK constraint failed/);
    }

    expect(() =>
      db.prepare('UPDATE instructor_profiles SET slug=? WHERE user_id=?')
        .run('ada--lovelace', 'user'),
    ).toThrow(/invalid instructor profile slug/);
    expect(() =>
      db.prepare('UPDATE instructor_profiles SET slug=? WHERE user_id=?')
        .run('grace-hopper', 'user'),
    ).not.toThrow();
    expect(db.prepare('SELECT slug FROM instructor_profiles WHERE user_id=?').get('user'))
      .toEqual({ slug: 'grace-hopper' });
  } finally {
    db.close();
  }
});
