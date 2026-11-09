import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps upload cursors contiguous with stored chunks and permits terminal cleanup', () => {
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
    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('upload','owner','course','video.mp4',10)`).run();

    const insertChunk = db.prepare(`INSERT INTO video_chunks(
      upload_id,offset,size,storage_key,sha256
    ) VALUES('upload',?,?,?,?)`);
    const digest = 'a'.repeat(64);
    insertChunk.run(0, 4, 'chunk-1', digest);
    expect(db.prepare('SELECT offset FROM video_uploads WHERE id=?').get('upload'))
      .toEqual({ offset: 4 });
    insertChunk.run(4, 6, 'chunk-2', digest);
    expect(db.prepare('SELECT offset FROM video_uploads WHERE id=?').get('upload'))
      .toEqual({ offset: 10 });

    expect(() => insertChunk.run(9, 1, 'overlap', digest))
      .toThrow(/video chunk byte range is invalid/);
    expect(() => db.prepare('UPDATE video_uploads SET offset=9 WHERE id=?').run('upload'))
      .toThrow(/video upload cursor does not match chunks/);
    expect(() => db.prepare('UPDATE video_uploads SET offset=10 WHERE id=?').run('upload'))
      .not.toThrow();
    expect(() => db.prepare('DELETE FROM video_chunks WHERE storage_key=?').run('chunk-1'))
      .toThrow(/video chunks cannot be deleted from active uploads/);

    db.prepare("UPDATE video_uploads SET status='CANCELLED' WHERE id=?").run('upload');
    expect(() => db.prepare('DELETE FROM video_chunks WHERE upload_id=?').run('upload'))
      .not.toThrow();
    expect(db.prepare('SELECT offset FROM video_uploads WHERE id=?').get('upload'))
      .toEqual({ offset: 10 });
    expect(db.prepare('SELECT count(*) AS total FROM video_chunks WHERE upload_id=?').get('upload'))
      .toEqual({ total: 0 });
  } finally {
    db.close();
  }
});
