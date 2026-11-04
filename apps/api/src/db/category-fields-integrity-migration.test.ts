import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates category slugs, names, and descriptions on insert and update', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    const insert = db.prepare(
      'INSERT INTO categories(id,slug,name,description) VALUES(?,?,?,?)',
    );
    insert.run('category', 'course-category', 'Category', 'Description');
    expect(
      db.prepare('SELECT slug,name,description FROM categories WHERE id=?').get('category'),
    ).toEqual({
      slug: 'course-category',
      name: 'Category',
      description: 'Description',
    });

    const invalidRows = [
      ['short-slug', 'ab', 'Category', ''],
      ['uppercase-slug', 'Course-category', 'Category', ''],
      ['spaced-slug', 'course category', 'Category', ''],
      ['leading-hyphen', '-course', 'Category', ''],
      ['trailing-hyphen', 'course-', 'Category', ''],
      ['repeated-hyphen', 'course--category', 'Category', ''],
      ['long-slug', 'a'.repeat(101), 'Category', ''],
      ['blank-name', 'blank-name', '   ', ''],
      ['whitespace-name', 'whitespace-name', '\t\n', ''],
      ['long-name', 'long-name', 'N'.repeat(101), ''],
      ['long-description', 'long-description', 'Category', 'D'.repeat(1001)],
    ] as const;
    for (const [id, slug, name, description] of invalidRows) {
      expect(() => insert.run(id, slug, name, description)).toThrow(/invalid category fields/);
    }

    expect(() =>
      db.prepare(
        `UPDATE categories
         SET slug=?,name=?,description=?,version=version+1
         WHERE id=?`,
      ).run('updated-category', 'Updated category', 'Updated description', 'category'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE categories SET name=?,version=version+1 WHERE id=?').run('  ', 'category'),
    ).toThrow(/invalid category fields/);
  } finally {
    db.close();
  }
});
