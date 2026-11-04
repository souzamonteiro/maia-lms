import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('preserves the home settings singleton and advances its version exactly once', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT id,version FROM home_settings').get()).toEqual({
      id: 1,
      version: 0,
    });

    expect(() => db.prepare('UPDATE home_settings SET version=version+1 WHERE id=1').run())
      .not.toThrow();
    expect(db.prepare('SELECT version FROM home_settings WHERE id=1').get()).toEqual({
      version: 1,
    });
    expect(() => db.prepare('UPDATE home_settings SET version=version+1 WHERE id=1').run())
      .not.toThrow();
    expect(db.prepare('SELECT version FROM home_settings WHERE id=1').get()).toEqual({
      version: 2,
    });

    expect(() => db.prepare('UPDATE home_settings SET version=version WHERE id=1').run())
      .toThrow(/home settings version must advance by one/);
    expect(() => db.prepare('UPDATE home_settings SET version=version+2 WHERE id=1').run())
      .toThrow(/home settings version must advance by one/);
    expect(() => db.prepare('UPDATE home_settings SET version=2.5 WHERE id=1').run())
      .toThrow(/home settings version must advance by one/);
    expect(() => db.prepare('UPDATE home_settings SET version=-1 WHERE id=1').run())
      .toThrow(/home settings version must advance by one/);
    expect(() => db.prepare('DELETE FROM home_settings WHERE id=1').run())
      .toThrow(/home settings singleton cannot be deleted/);
    expect(() => db.prepare('UPDATE home_settings SET id=2 WHERE id=1').run())
      .toThrow(/home settings identity is immutable/);
    expect(() => db.prepare('INSERT OR REPLACE INTO home_settings(id,version) VALUES(1,0)').run())
      .toThrow(/home settings singleton already exists/);
    expect(db.prepare('SELECT id,version FROM home_settings').get()).toEqual({
      id: 1,
      version: 2,
    });
  } finally {
    db.close();
  }
});
