import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrate.js';
import { publicationIssues } from './publication.js';

it('rejects unready media, cross-course references and invalid ordering', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','a@b.com','a@b.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('c','first','u'),('other','other','u');
      INSERT INTO course_revisions(id,course_id,title,summary) VALUES('r','c','Course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES('m','r',2,'Module');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,media_kind)
          VALUES('v','u','c','video.mp4',10,'UPLOADING','video'),('a','u','c','guide.pdf',10,'UPLOADING','attachment');
      INSERT INTO lessons(id,module_id,sort_order,title,body,video_id) VALUES('l','m',1,'Lesson','','v');
      INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES('attachment','r','a','Guide','Description',0);`);
    expect(publicationIssues(db, 'c', 'r').map(i => i.code)).toEqual([
      'PUBLICATION_ORDER',
      'PUBLICATION_ORDER',
      'VIDEO_NOT_READY',
      'FILE_NOT_READY',
    ]);
    db.exec(
      "UPDATE modules SET sort_order=0; UPDATE lessons SET sort_order=0; UPDATE video_uploads SET course_id='c'; UPDATE video_uploads SET status='QUEUED'; UPDATE video_uploads SET status='PROCESSING';",
    );
    expect(publicationIssues(db, 'c', 'r').map(i => i.code)).toEqual([
      'VIDEO_NOT_READY',
      'FILE_NOT_READY',
    ]);
    db.exec("UPDATE video_uploads SET status='READY'");
    expect(publicationIssues(db, 'c', 'r')).toEqual([]);
  } finally {
    db.close();
  }
});

it('blocks empty or inconsistent configured quizzes but does not require quizzes on every course', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','quiz@b.com','quiz@b.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('c','quiz-course','u');
      INSERT INTO course_revisions(id,course_id,title,summary) VALUES('r','c','Quiz course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES('m','r',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES('l','m',0,'Lesson','Lesson body');`);
    expect(publicationIssues(db, 'c', 'r')).toEqual([]);

    db.prepare('INSERT INTO quizzes(id,revision_id,lesson_id) VALUES(?,?,?)').run('empty-quiz', 'r', 'l');
    db.prepare('INSERT INTO quizzes(id,revision_id,lesson_id) VALUES(?,?,NULL)').run('bad-final', 'r');
    db.prepare(
      'INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,points,sort_order) VALUES(?,?,?,?,?,?,?)',
    ).run('bad-question', 'bad-final', 'Choose', '[{"key":"a","text":"Alpha"},{"key":"b","text":"Beta"}]', '["missing"]', 1, 0);
    expect(publicationIssues(db, 'c', 'r')).toEqual([
      { code: 'QUIZ_INVALID' },
      { code: 'QUIZ_EMPTY', moduleTitle: 'Module', lessonTitle: 'Lesson' },
    ]);

    db.prepare('DELETE FROM quizzes WHERE id=?').run('empty-quiz');
    db.prepare('UPDATE questions SET correct_choice_keys=? WHERE id=?').run('["b"]', 'bad-question');
    expect(publicationIssues(db, 'c', 'r')).toEqual([]);
  } finally {
    db.close();
  }
});
