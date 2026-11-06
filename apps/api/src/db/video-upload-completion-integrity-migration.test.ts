import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows processing states only after an upload reaches its declared size', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 2').all())
      .toEqual([
        { version: '182_video_upload_completion_integrity' },
        { version: '181_video_upload_chunk_cursor_integrity' },
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
        .run(status, 'incomplete')).toThrow(/video upload is incomplete/);
    }
    expect(() => db.prepare("UPDATE video_uploads SET status='CANCELLED' WHERE id=?")
      .run('incomplete')).not.toThrow();

    db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,offset)
      VALUES('complete','owner','course','complete.mp4',10,10)`).run();
    expect(() => db.prepare("UPDATE video_uploads SET status='QUEUED' WHERE id=?")
      .run('complete')).not.toThrow();
    expect(() => db.prepare('UPDATE video_uploads SET offset=9 WHERE id=?')
      .run('complete')).toThrow(/video upload cursor does not match chunks/);
    expect(() => db.prepare('UPDATE video_uploads SET size=11 WHERE id=?')
      .run('complete')).toThrow(/video upload is incomplete/);
  } finally {
    db.close();
  }
});
