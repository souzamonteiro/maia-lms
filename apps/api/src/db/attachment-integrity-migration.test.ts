import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps attachments in their revision course and optional lesson revision', () => {
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
      INSERT INTO lessons(id,module_id,sort_order,title)
      VALUES ('lesson-a','module-a',0,'Lesson A'),
             ('lesson-b','module-b',0,'Lesson B');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
      VALUES ('file-a','user','course-a','guide.pdf',10,'attachment'),
             ('file-b','user','course-b','other.pdf',10,'attachment'),
             ('video-a','user','course-a','video.mp4',10,'video');
      INSERT INTO course_attachments(id,revision_id,lesson_id,upload_id,title,description,sort_order)
      VALUES ('attachment-global','revision-a',NULL,'file-a','Guide','Description',0),
              ('attachment-lesson-first','revision-a','lesson-a','file-a','First lesson guide','Description',0),
              ('attachment-lesson','revision-a','lesson-a','file-a','Lesson guide','Description',1);
    `);

    expect(() =>
      db
        .prepare('INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?)')
        .run('foreign-file', 'revision-a', 'file-b', 'Foreign', 'Description', 2),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(() =>
      db
        .prepare('INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?)')
        .run('video-file', 'revision-a', 'video-a', 'Video', 'Description', 2),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(() =>
      db
        .prepare('INSERT INTO course_attachments(id,revision_id,lesson_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?,?)')
        .run('wrong-lesson', 'revision-a', 'lesson-b', 'file-a', 'Wrong lesson', 'Description', 2),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(() =>
      db
        .prepare('INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?)')
        .run('duplicate-global', 'revision-a', 'file-a', 'Duplicate', 'Description', 0),
    ).toThrow(/duplicate attachment sort order/);
    expect(() =>
      db
        .prepare('UPDATE course_attachments SET sort_order=? WHERE id=?')
        .run(0, 'attachment-lesson'),
    ).toThrow(/duplicate attachment sort order/);
    expect(() =>
      db
        .prepare('INSERT INTO course_attachments(id,revision_id,lesson_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?,?)')
        .run('other-scope', 'revision-b', 'lesson-b', 'file-b', 'Other scope', 'Description', 0),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE video_uploads SET media_kind=? WHERE id=?').run('video', 'file-a'),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(() =>
      db.prepare('UPDATE lessons SET module_id=? WHERE id=?').run('module-b', 'lesson-a'),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(() =>
      db.prepare('UPDATE modules SET revision_id=? WHERE id=?').run('revision-b', 'module-a'),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(() =>
      db.prepare('UPDATE course_revisions SET course_id=? WHERE id=?').run('course-b', 'revision-a'),
    ).toThrow(/course attachment revision or media mismatch/);
    expect(
      db.prepare('SELECT id FROM course_attachments ORDER BY id').all(),
    ).toEqual([
      { id: 'attachment-global' },
      { id: 'attachment-lesson' },
      { id: 'attachment-lesson-first' },
      { id: 'other-scope' },
    ]);
  } finally {
    db.close();
  }
});