import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows processing states only after an upload reaches its declared size', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 2').all())
      .toEqual([
        { version: '189_completed_lesson_progress_immutable' },
        { version: '188_enrollment_snapshot_insert_integrity' },
      ]);
    db.prepare(`INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('owner','owner@example.com','owner@example.com','hash')`).run();
    db.prepare(`INSERT INTO courses(id,slug,author_id) VALUES('course','course','owner')`).run();

    expect(() => db.prepare(`INSERT INTO video_uploads(
      id,owner_id,course_id,filename,size,status
    ) VALUES('incomplete-insert','owner','course','video.mp4',10,'QUEUED')`).run())
      .toThrow(/video upload is incomplete/);

    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('incomplete','owner','course','incomplete.mp4',10)`).run();
    for (const status of ['QUEUED', 'PROCESSING', 'READY', 'FAILED']) {
      expect(() => db.prepare('UPDATE video_uploads SET status=? WHERE id=?')
        .run(status, 'incomplete'))
        .toThrow(/video upload (is incomplete|processing state requires complete chunks)/);
    }
    expect(() => db.prepare("UPDATE video_uploads SET status='CANCELLED' WHERE id=?")
      .run('incomplete')).not.toThrow();

    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('complete','owner','course','complete.mp4',10)`).run();
    db.prepare(`INSERT INTO video_chunks(upload_id,offset,size,storage_key,sha256)
      VALUES('complete',0,10,'complete-chunk',?)`).run('a'.repeat(64));
    expect(() => db.prepare("UPDATE video_uploads SET status='QUEUED' WHERE id=?")
      .run('complete')).not.toThrow();
    expect(() => db.prepare('UPDATE video_uploads SET offset=9 WHERE id=?')
      .run('complete')).toThrow(/video upload cursor does not match chunks/);
    expect(() => db.prepare('UPDATE video_uploads SET size=11 WHERE id=?')
      .run('complete')).toThrow(/video upload is incomplete/);

    db.exec('DROP TRIGGER video_upload_initial_cursor_zero');
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,offset)
      VALUES('legacy-complete','owner','course','legacy.mp4',10,10)`).run();
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,offset,status)
      VALUES('legacy-queued','owner','course','legacy-queued.mp4',10,10,'QUEUED')`).run();
    db.exec(`CREATE TRIGGER video_upload_initial_cursor_zero
      BEFORE INSERT ON video_uploads WHEN NEW.offset != 0
      BEGIN SELECT RAISE(ABORT, 'video upload cursor must start at zero'); END`);
    expect(() => db.prepare("UPDATE video_uploads SET status='QUEUED' WHERE id=?")
      .run('legacy-complete')).toThrow(/video upload processing state requires complete chunks/);
    expect(() => db.prepare("UPDATE video_uploads SET status='PROCESSING' WHERE id=?")
      .run('legacy-queued')).toThrow(/video upload processing state requires complete chunks/);
  } finally {
    db.close();
  }
});
