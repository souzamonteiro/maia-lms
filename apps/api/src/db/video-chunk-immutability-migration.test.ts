import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps video chunk identity immutable while allowing cleanup deletion', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 9').all())
      .toEqual([
        { version: '203_assessment_question_count_limit' },
        { version: '202_assessment_question_choice_integrity' },
        { version: '201_assessment_score_points_range' },
        { version: '200_assessment_answer_selection_integrity' },
        { version: '199_assessment_result_answers_integrity' },
        { version: '198_assessment_attempt_timestamp_integrity' },
        { version: '197_assessment_attempt_identity_immutable' },
        { version: '196_assessment_attempt_access_integrity' },
        { version: '195_lesson_progress_access_integrity' },
      ]);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner')`).run();
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('upload','owner','course','video.mp4',10)`).run();
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('other-upload','owner','course','other.mp4',10)`).run();
    db.prepare(`INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256)
      VALUES('upload',0,4,'chunk','${'a'.repeat(64)}')`).run();

    const updates = [
      "UPDATE video_chunks SET upload_id='other-upload' WHERE storage_key='chunk'",
      "UPDATE video_chunks SET offset=1 WHERE storage_key='chunk'",
      "UPDATE video_chunks SET size=5 WHERE storage_key='chunk'",
      "UPDATE video_chunks SET storage_key='replacement' WHERE storage_key='chunk'",
      `UPDATE video_chunks SET sha256='${'b'.repeat(64)}' WHERE storage_key='chunk'`,
    ];
    for (const statement of updates) {
      expect(() => db.exec(statement)).toThrow(/video chunk identity is immutable/);
    }

    expect(db.prepare('SELECT upload_id,offset,size,storage_key,sha256 FROM video_chunks')
      .get()).toEqual({
      upload_id: 'upload',
      offset: 0,
      size: 4,
      storage_key: 'chunk',
      sha256: 'a'.repeat(64),
    });
    expect(() => db.prepare('DELETE FROM video_chunks WHERE storage_key=?').run('chunk'))
      .toThrow(/video chunks cannot be deleted from active uploads/);
    db.prepare("UPDATE video_uploads SET status='CANCELLED' WHERE id='upload'").run();
    expect(() => db.prepare('DELETE FROM video_chunks WHERE storage_key=?').run('chunk'))
      .not.toThrow();
    expect(db.prepare('SELECT count(*) AS total FROM video_chunks').get()).toEqual({ total: 0 });
  } finally {
    db.close();
  }
});
