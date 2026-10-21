import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('enforces course revision translation metadata invariants for direct SQL writes', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course','course','user');
    `);

    const insertRevision = (id: string, locale: string, translations: string) =>
      db.prepare(`INSERT INTO course_revisions(id,course_id,title,summary,locale,translations_json)
        VALUES(?,?,?,'A sufficiently long course summary',?,?)`)
        .run(id, 'course', `Course ${id}`, locale, translations);

    insertRevision('valid', 'pt-BR', JSON.stringify([
      { locale: 'es', title: 'Curso traducido' },
      { locale: 'en', summary: 'A sufficiently long translated summary' },
    ]));
    expect(db.prepare('SELECT translations_json FROM course_revisions WHERE id=?')
      .get('valid').translations_json).toContain('Curso traducido');

    const invalidTranslations = [
      JSON.stringify([{ locale: 'es', title: 'Título válido' }, { locale: 'es', title: 'Otro título' }]),
      JSON.stringify([{ locale: 'pt-BR', title: 'Same as source' }]),
      JSON.stringify([{ locale: 'fr', title: 'Unsupported locale' }]),
      JSON.stringify([{ locale: 'es', title: 'Valid title', unexpected: 'extra field' }]),
      '[{"locale":"es","title":"First title","title":"Second title"}]',
      JSON.stringify([{ locale: 'es', title: 'x' }]),
      JSON.stringify([{ locale: 'es', summary: 42 }]),
      JSON.stringify([{ locale: 'es', title: '   ' }]),
      JSON.stringify([{ locale: 'es', learningOutcomes: 'x'.repeat(5001) }]),
      JSON.stringify([{ locale: 'es' }]),
      'not-json',
    ];

    for (const [index, translations] of invalidTranslations.entries()) {
      expect(() => insertRevision(`invalid-${index}`, 'pt-BR', translations))
        .toThrow(/invalid course revision translation metadata/);
    }

    expect(() => db.prepare('UPDATE course_revisions SET locale=? WHERE id=?')
      .run('es', 'valid')).toThrow(/invalid course revision translation metadata/);
    expect(() => db.prepare('UPDATE course_revisions SET translations_json=? WHERE id=?')
      .run(JSON.stringify([{ locale: 'es', title: 'Valid title' }, { locale: 'es', summary: 'Duplicate translated summary' }]), 'valid'))
      .toThrow(/invalid course revision translation metadata/);
    expect(db.prepare('SELECT locale FROM course_revisions WHERE id=?').get('valid').locale)
      .toBe('pt-BR');
  } finally {
    db.close();
  }
});