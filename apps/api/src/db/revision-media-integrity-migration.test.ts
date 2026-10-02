import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps revision covers and trailers in the owning course with the correct media kind', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','user'),('course-b','course-b','user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision-a','course-a','Course A','Summary A'),
             ('revision-b','course-b','Course B','Summary B');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
      VALUES ('cover-a','user','course-a','cover.png',10,'attachment'),
             ('trailer-a','user','course-a','trailer.mp4',10,'video'),
             ('video-b','user','course-b','other.mp4',10,'video');
    `);
    db.prepare('UPDATE course_revisions SET cover_file_id=? WHERE id=?').run('cover-a', 'revision-a');
    db.prepare('UPDATE course_revisions SET trailer_video_id=? WHERE id=?').run('trailer-a', 'revision-a');

    expect(() =>
      db.prepare('UPDATE course_revisions SET cover_file_id=? WHERE id=?').run('video-b', 'revision-a'),
    ).toThrow(/revision media course or kind mismatch/);
    expect(() =>
      db.prepare('UPDATE course_revisions SET trailer_video_id=? WHERE id=?').run('cover-a', 'revision-a'),
    ).toThrow(/revision media course or kind mismatch/);
    expect(() =>
      db.prepare('UPDATE video_uploads SET course_id=? WHERE id=?').run('course-b', 'cover-a'),
    ).toThrow(/revision media course or kind mismatch/);
    expect(() =>
      db.prepare('UPDATE video_uploads SET media_kind=? WHERE id=?').run('attachment', 'trailer-a'),
    ).toThrow(/revision media course or kind mismatch/);
    expect(() =>
      db.prepare('UPDATE course_revisions SET course_id=? WHERE id=?').run('course-b', 'revision-a'),
    ).toThrow(/revision media course or kind mismatch/);
    expect(
      db.prepare('SELECT cover_file_id,trailer_video_id FROM course_revisions WHERE id=?').get('revision-a'),
    ).toEqual({ cover_file_id: 'cover-a', trailer_video_id: 'trailer-a' });
  } finally {
    db.close();
  }
});