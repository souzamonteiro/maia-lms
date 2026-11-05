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

it('matches instructor profile text limits for Unicode, NUL, inserts, and updates', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    const addUser = db.prepare(
      "INSERT INTO users(id,email,email_normalized,password_hash,role) VALUES(?,?,?,?,'author')",
    );
    addUser.run('user', 'user@example.com', 'user@example.com', 'hash');
    const insert = db.prepare(
      'INSERT INTO instructor_profiles(user_id,slug,display_name,bio) VALUES(?,?,?,?)',
    );
    const displayBoundary = '😀'.repeat(50);
    const bioBoundary = '😀'.repeat(2500);
    expect(displayBoundary.length).toBe(100);
    expect(bioBoundary.length).toBe(5000);
    insert.run('user', 'ada-lovelace', displayBoundary, bioBoundary);

    for (const [index, whitespace] of ['\u00a0', '\u2003', '\u3000', '\ufeff'].entries()) {
      const userId = `whitespace-${index}`;
      addUser.run(userId, `${userId}@example.com`, `${userId}@example.com`, 'hash');
      expect(() => insert.run(userId, `whitespace-${index}`, whitespace, '')).toThrow(
        /invalid instructor profile text/,
      );
    }
    const invalidProfiles = [
      ['display-too-long', 'Display Too Long', `${displayBoundary}😀`, ''],
      ['bio-too-long', 'Bio Too Long', 'Instructor', `${bioBoundary}😀`],
      ['display-nul', 'Display Nul', 'Ada\u0000Lovelace', ''],
      ['bio-nul', 'Bio Nul', 'Instructor', 'Bio\u0000suffix'],
    ] as const;
    for (const [userId, slug, displayName, bio] of invalidProfiles) {
      addUser.run(userId, `${userId}@example.com`, `${userId}@example.com`, 'hash');
      expect(() => insert.run(userId, slug.toLowerCase().replaceAll(' ', '-'), displayName, bio))
        .toThrow(/invalid instructor profile text/);
    }

    const update = db.prepare(
      'UPDATE instructor_profiles SET display_name=?,bio=? WHERE user_id=?',
    );
    expect(() => update.run('\u2003', bioBoundary, 'user')).toThrow();
    expect(() => update.run('Instructor', `${bioBoundary}😀`, 'user')).toThrow();
    expect(() => update.run('Instructor', 'Bio\u0000suffix', 'user')).toThrow();
    expect(() => update.run('Grace Hopper', 'Mathematician', 'user')).not.toThrow();
  } finally {
    db.close();
  }
});
