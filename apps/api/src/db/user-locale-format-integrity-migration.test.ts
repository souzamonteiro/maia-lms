import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('matches direct user-locale writes to the API locale format', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const insertUser = db.prepare(`
      INSERT INTO users(id,email,email_normalized,password_hash,locale)
      VALUES(?,?,?,'hash',?)
    `);
    for (const [index, locale] of ['en', 'pt-BR', 'es', 'fr', 'zh-CN'].entries()) {
      insertUser.run(`valid-${index}`, `valid-${index}@example.com`, `valid-${index}@example.com`, locale);
    }

    for (const [index, locale] of [
      '',
      'EN',
      'pt-br',
      'eng',
      'en-US-extra',
      ' en',
      'en ',
      'en\u0000suffix',
    ].entries()) {
      expect(() =>
        insertUser.run(`invalid-${index}`, `invalid-${index}@example.com`,
          `invalid-${index}@example.com`, locale),
      ).toThrow(/invalid user locale/);
    }

    expect(() => db.prepare('UPDATE users SET locale=? WHERE id=?')
      .run('EN', 'valid-0')).toThrow(/invalid user locale/);
    db.prepare('UPDATE users SET locale=? WHERE id=?').run('es', 'valid-0');
    expect(db.prepare('SELECT locale FROM users WHERE id=?').get('valid-0'))
      .toEqual({ locale: 'es' });
  } finally {
    db.close();
  }
});
