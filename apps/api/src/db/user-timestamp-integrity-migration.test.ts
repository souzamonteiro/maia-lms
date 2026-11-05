import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires parseable account timestamps while allowing existing SQL and ISO formats', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const insertUser = db.prepare(`INSERT INTO users(
      id,email,email_normalized,password_hash,created_at,updated_at,verified_at
    ) VALUES(?,?,?,'hash',?,?,?)`);
    insertUser.run(
      'sqlite-date',
      'sqlite-date@example.com',
      'sqlite-date@example.com',
      '2026-11-05 10:00:00',
      '2026-11-05 10:00:00',
      null,
    );
    insertUser.run(
      'iso-date',
      'iso-date@example.com',
      'iso-date@example.com',
      '2026-11-05T10:00:00.123Z',
      '2026-11-05T10:00:00.123Z',
      '2026-11-05T10:00:00.123Z',
    );

    for (const [field, value] of [
      ['created_at', 'invalid'],
      ['updated_at', 'invalid'],
      ['verified_at', 'invalid'],
    ] as const) {
      const createdAt = field === 'created_at' ? value : '2026-11-05T10:00:00.123Z';
      const updatedAt = field === 'updated_at' ? value : '2026-11-05T10:00:00.123Z';
      const verifiedAt = field === 'verified_at' ? value : null;
      expect(() => insertUser.run(
        `invalid-${field}`,
        `invalid-${field}@example.com`,
        `invalid-${field}@example.com`,
        createdAt,
        updatedAt,
        verifiedAt,
      )).toThrow(/user timestamps are invalid/);
    }
    expect(() => db.prepare(`INSERT INTO users(
      id,email,email_normalized,password_hash,created_at,updated_at
    ) VALUES('nul-date','nul-date@example.com','nul-date@example.com','hash',
      '2026-11-05 10:00:00'||char(0)||'invalid','2026-11-05 10:00:00')`).run())
      .toThrow(/user timestamps are invalid/);

    const updateTimestamp = db.prepare('UPDATE users SET created_at=? WHERE id=?');
    expect(() => updateTimestamp.run('invalid', 'sqlite-date'))
      .toThrow(/user timestamps are invalid/);
    expect(() => db.prepare(`UPDATE users SET updated_at=? WHERE id='sqlite-date'`)
      .run('invalid')).toThrow(/user timestamps are invalid/);
    expect(() => db.prepare(`UPDATE users SET verified_at=? WHERE id='sqlite-date'`)
      .run('invalid')).toThrow(/user timestamps are invalid/);

    db.prepare(`UPDATE users SET verified_at=? WHERE id='sqlite-date'`)
      .run('2026-11-05T10:01:00.000Z');
    db.prepare(`UPDATE users SET verified_at=NULL WHERE id='sqlite-date'`).run();
    expect(db.prepare('SELECT created_at,updated_at,verified_at FROM users WHERE id=?')
      .get('sqlite-date')).toEqual({
      created_at: '2026-11-05 10:00:00',
      updated_at: '2026-11-05 10:00:00',
      verified_at: null,
    });
  } finally {
    db.close();
  }
});
