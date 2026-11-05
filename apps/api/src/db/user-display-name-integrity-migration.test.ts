import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates account display names while retaining the empty signup default', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const insert = db.prepare(
      'INSERT INTO users(id,email,email_normalized,password_hash,display_name) VALUES(?,?,?,?,?)',
    );
    insert.run('empty', 'empty@example.com', 'empty@example.com', 'hash', '');
    insert.run('valid', 'valid@example.com', 'valid@example.com', 'hash', 'Ada Lovelace');

    const invalidNames = [
      '\u00a0',
      '\u2003',
      '\u3000',
      '\ufeff',
      'Ada\u0000Lovelace',
      `${'😀'.repeat(50)}😀`,
    ];
    for (const [index, displayName] of invalidNames.entries()) {
      expect(() =>
        insert.run(`invalid-${index}`, `invalid-${index}@example.com`,
          `invalid-${index}@example.com`, 'hash', displayName),
      ).toThrow(/invalid user display name/);
    }

    const update = db.prepare('UPDATE users SET display_name=? WHERE id=?');
    expect(() => update.run('😀'.repeat(50), 'valid')).not.toThrow();
    for (const displayName of ['', '\u2003', 'Ada\u0000Lovelace', `${'😀'.repeat(50)}😀`]) {
      expect(() => update.run(displayName, 'valid')).toThrow(/invalid user display name/);
    }
  } finally {
    db.close();
  }
});
