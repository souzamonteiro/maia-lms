import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('requires category versions to be positive integers and advance on each update', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.prepare('INSERT INTO categories(id,slug,name) VALUES(?,?,?)')
      .run('category', 'category', 'Category');

    expect(() => db.prepare("UPDATE categories SET name='Updated',version=version+1 WHERE id=?")
      .run('category')).not.toThrow();
    expect(db.prepare('SELECT name,version FROM categories WHERE id=?').get('category')).toEqual({
      name: 'Updated',
      version: 2,
    });
    expect(() => db.prepare('UPDATE categories SET version=version+1 WHERE id=?').run('category'))
      .not.toThrow();
    expect(db.prepare('SELECT version FROM categories WHERE id=?').get('category')).toEqual({
      version: 3,
    });

    expect(() => db.prepare("UPDATE categories SET name='Unversioned' WHERE id=?").run('category'))
      .toThrow(/category version must advance by one/);
    expect(() => db.prepare('UPDATE categories SET version=version WHERE id=?').run('category'))
      .toThrow(/category version must advance by one/);
    expect(() => db.prepare('UPDATE categories SET version=version+2 WHERE id=?').run('category'))
      .toThrow(/category version must advance by one/);
    expect(() => db.prepare('UPDATE categories SET version=2.5 WHERE id=?').run('category'))
      .toThrow(/category version must advance by one/);
    expect(() =>
      db.prepare('INSERT INTO categories(id,slug,name,version) VALUES(?,?,?,?)')
        .run('fractional', 'fractional', 'Fractional', 1.5),
    ).toThrow(/invalid category version/);
    expect(() =>
      db.prepare('INSERT INTO categories(id,slug,name,version) VALUES(?,?,?,?)')
        .run('zero', 'zero', 'Zero', 0),
    ).toThrow(/invalid category version/);
  } finally {
    db.close();
  }
});
