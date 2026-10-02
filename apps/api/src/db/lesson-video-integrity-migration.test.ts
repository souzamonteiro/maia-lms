import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps a lesson video in the owning course and video media kind', () => {
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
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES ('module-a','revision-a',0,'Module A'),
             ('module-b','revision-b',0,'Module B');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
      VALUES ('video-a','user','course-a','a.mp4',10,'video'),
             ('video-b','user','course-b','b.mp4',10,'video'),
             ('file-a','user','course-a','a.pdf',10,'attachment');
      INSERT INTO lessons(id,module_id,sort_order,title,body,video_id)
      VALUES ('lesson-a','module-a',0,'Lesson A','Text','video-a');
    `);

    expect(() =>
      db
        .prepare('UPDATE lessons SET video_id=? WHERE id=?')
        .run('video-b', 'lesson-a'),
    ).toThrow(/lesson video course or media kind mismatch/);
    expect(() =>
      db
        .prepare('UPDATE lessons SET video_id=? WHERE id=?')
        .run('file-a', 'lesson-a'),
    ).toThrow(/lesson video course or media kind mismatch/);
    expect(() =>
      db.prepare('UPDATE video_uploads SET course_id=? WHERE id=?').run('course-b', 'video-a'),
    ).toThrow(/lesson video course or media kind mismatch/);
    expect(() =>
      db.prepare('UPDATE modules SET revision_id=? WHERE id=?').run('revision-b', 'module-a'),
    ).toThrow(/lesson video course or media kind mismatch/);
    expect(() =>
      db.prepare('UPDATE course_revisions SET course_id=? WHERE id=?').run('course-b', 'revision-a'),
    ).toThrow(/lesson video course or media kind mismatch/);
    expect(db.prepare('SELECT video_id FROM lessons WHERE id=?').get('lesson-a')).toEqual({
      video_id: 'video-a',
    });
  } finally {
    db.close();
  }
});