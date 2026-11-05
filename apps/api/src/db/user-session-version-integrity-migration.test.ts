import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps user session versions nonnegative and monotonic by one generation', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const insertUser = db.prepare(`
      INSERT INTO users(id,email,email_normalized,password_hash,session_version)
      VALUES(?,?,?,'hash',?)
    `);
    insertUser.run('default-version', 'default@example.com', 'default@example.com', 0);
    insertUser.run('positive-version', 'positive@example.com', 'positive@example.com', 5);

    for (const [index, version] of [-1, 0.5, 'five'].entries()) {
      expect(() =>
        insertUser.run(`invalid-${index}`, `invalid-${index}@example.com`,
          `invalid-${index}@example.com`, version),
      ).toThrow(/invalid user session version/);
    }

    const updateVersion = db.prepare('UPDATE users SET session_version=? WHERE id=?');
    expect(() => updateVersion.run(-1, 'default-version'))
      .toThrow(/invalid user session version/);
    expect(() => updateVersion.run(1.5, 'default-version'))
      .toThrow(/invalid user session version/);
    expect(() => updateVersion.run(2, 'default-version'))
      .toThrow(/invalid user session version/);
    expect(() => updateVersion.run(4, 'positive-version'))
      .toThrow(/invalid user session version/);

    updateVersion.run(0, 'default-version');
    updateVersion.run(1, 'default-version');
    updateVersion.run(6, 'positive-version');
    expect(db.prepare('SELECT session_version FROM users WHERE id=?').get('default-version'))
      .toEqual({ session_version: 1 });
    expect(db.prepare('SELECT session_version FROM users WHERE id=?').get('positive-version'))
      .toEqual({ session_version: 6 });
  } finally {
    db.close();
  }
});
