import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires user password hashes to be nonempty NUL-free text', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const insertUser = db.prepare(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES(?,?,?,?)
    `);
    insertUser.run('opaque-hash', 'opaque@example.com', 'opaque@example.com', 'hash');
    insertUser.run('argon-hash', 'argon@example.com', 'argon@example.com', '$argon2id$v=19$hash');

    for (const [index, passwordHash] of [
      ['', ''],
      ['nul', 'prefix\u0000suffix'],
      ['blob', Buffer.from('hash')],
    ] as const) {
      expect(() =>
        insertUser.run(`${index}-insert`, `${index}-insert@example.com`,
          `${index}-insert@example.com`, passwordHash),
      ).toThrow(/invalid user password hash/);
    }

    const updateHash = db.prepare('UPDATE users SET password_hash=? WHERE id=?');
    expect(() => updateHash.run('replacement-hash', 'opaque-hash')).not.toThrow();
    for (const passwordHash of ['', 'prefix\u0000suffix', Buffer.from('hash')]) {
      expect(() => updateHash.run(passwordHash, 'opaque-hash'))
        .toThrow(/invalid user password hash/);
    }
    expect(db.prepare('SELECT password_hash FROM users WHERE id=?').get('opaque-hash'))
      .toEqual({ password_hash: 'replacement-hash' });
  } finally {
    db.close();
  }
});
