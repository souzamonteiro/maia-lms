import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('rejects rewriting a ready media artifact referenced by a published revision', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','author');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('revision','course','Published course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES('module','revision',0,'Module');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size)
      VALUES('video','author','course','video.mp4',10);
      INSERT INTO lessons(id,module_id,sort_order,title,body,video_id)
      VALUES('lesson','module',0,'Lesson','Body','video');
      UPDATE video_uploads SET status='QUEUED' WHERE id='video';
      UPDATE video_uploads SET status='PROCESSING' WHERE id='video';
      UPDATE video_uploads SET status='READY',output_key='private/video-original.mp4',poster_key='private/video-poster.jpg',duration=60
      WHERE id='video';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET current_revision_id='revision',published_revision_id='revision',status='PUBLISHED'
      WHERE id='course';
    `);

    expect(() =>
      db.prepare('UPDATE video_uploads SET output_key=? WHERE id=?').run('private/replaced.mp4', 'video'),
    ).toThrow(/published revision media is immutable/);
    expect(() =>
      db.prepare('UPDATE video_uploads SET poster_key=? WHERE id=?').run('private/replaced.jpg', 'video'),
    ).toThrow(/published revision media is immutable/);
    expect(() =>
      db.prepare('UPDATE video_uploads SET duration=? WHERE id=?').run(120, 'video'),
    ).toThrow(/published revision media is immutable/);
    expect(() => db.prepare('DELETE FROM video_uploads WHERE id=?').run('video')).toThrow(
      /published revision media is immutable/,
    );
  } finally {
    db.close();
  }
});
