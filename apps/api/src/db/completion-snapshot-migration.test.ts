import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

it('backfills existing enrollment completion requirements and freezes the snapshots', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    const migrationsDirectory = path.resolve(process.cwd(), 'migrations');
    const priorMigrations = fs
      .readdirSync(migrationsDirectory)
      .filter(file => /^\d+.*\.sql$/.test(file) && Number(file.slice(0, 3)) < 52)
      .sort();
    for (const file of priorMigrations)
      db.exec(fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'));

    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('snapshot-user','snapshot@example.com','snapshot@example.com','hash');
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('snapshot-incomplete-user','snapshot-incomplete@example.com','snapshot-incomplete@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('snapshot-course','snapshot-course','snapshot-user');
      INSERT INTO course_revisions(id,course_id,title,summary)
        VALUES('snapshot-revision','snapshot-course','Snapshot course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title)
        VALUES('snapshot-module','snapshot-revision',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,title,body,is_required,is_preview)
        VALUES('snapshot-required','snapshot-module',0,'Required','Content',1,0),
              ('snapshot-optional','snapshot-module',1,'Optional','Content',0,0);
      INSERT INTO quizzes(id,revision_id,lesson_id) VALUES('snapshot-quiz-final','snapshot-revision',NULL);
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
        VALUES('snapshot-enrollment','snapshot-user','snapshot-course','snapshot-revision'),
            ('snapshot-incomplete-enrollment','snapshot-incomplete-user','snapshot-course','snapshot-revision');
    `);

    db.exec(fs.readFileSync(path.join(migrationsDirectory, '052_completion_requirement_snapshots.sql'), 'utf8'));
    expect(
      db.prepare('SELECT required_lesson_ids_snapshot,quiz_ids_snapshot FROM enrollments WHERE id=?').get('snapshot-enrollment'),
    ).toEqual({
      required_lesson_ids_snapshot: '["snapshot-required"]',
      quiz_ids_snapshot: '["snapshot-quiz-final"]',
    });
    expect(() => db.prepare('UPDATE enrollments SET quiz_ids_snapshot=? WHERE id=?').run('[]', 'snapshot-enrollment'))
      .toThrow(/completion requirements are immutable/);

    db.prepare(
      "INSERT INTO entitlements(id,enrollment_id,source_type,starts_at) VALUES('snapshot-entitlement','snapshot-enrollment','admin',datetime('now','-1 day'))",
    ).run();
    db.prepare(
      "INSERT INTO entitlements(id,enrollment_id,source_type,starts_at) VALUES('snapshot-incomplete-entitlement','snapshot-incomplete-enrollment','admin',datetime('now','-1 day'))",
    ).run();
    db.prepare(
      "INSERT INTO lesson_progress(enrollment_id,lesson_id,position_seconds,completed_at) VALUES('snapshot-enrollment','snapshot-required',0,datetime('now','-1 hour'))",
    ).run();
    db.prepare(
      "INSERT INTO attempts(id,enrollment_id,quiz_id,revision_id,seed,started_at,submitted_at,score,pass) VALUES('snapshot-attempt','snapshot-enrollment','snapshot-quiz-final','snapshot-revision','seed',datetime('now','-1 hour'),datetime('now','-30 minutes'),1,1)",
    ).run();
    db.exec(fs.readFileSync(path.join(migrationsDirectory, '053_completion_timestamp_backfill.sql'), 'utf8'));
    expect(
      (db.prepare('SELECT completed_at FROM enrollments WHERE id=?').get('snapshot-enrollment') as { completed_at: string | null }).completed_at,
    ).toBeTruthy();
    expect(
      (db.prepare('SELECT completed_at FROM enrollments WHERE id=?').get('snapshot-incomplete-enrollment') as { completed_at: string | null }).completed_at,
    ).toBeNull();
  } finally {
    db.close();
  }
});