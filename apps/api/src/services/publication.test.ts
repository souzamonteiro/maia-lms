import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrate.js';
import { publicationIssues } from './publication.js';

it('rejects cross-course media and invalid ordering even when stored media is READY', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','a@b.com','a@b.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('c','first','u'),('other','other','u');
      INSERT INTO course_revisions(id,course_id,title,summary) VALUES('r','c','Course','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES('m','r',2,'Module');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,media_kind)
          VALUES('v','u','c','video.mp4',10,'READY','video'),('a','u','c','guide.pdf',10,'READY','attachment');
      INSERT INTO lessons(id,module_id,sort_order,title,body,video_id) VALUES('l','m',1,'Lesson','','v');
      INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order) VALUES('attachment','r','a','Guide','Description',0);`);
    expect(publicationIssues(db, 'c', 'r').map(i => i.code)).toEqual([
      'PUBLICATION_ORDER',
      'PUBLICATION_ORDER',
    ]);
    db.exec(
      "UPDATE modules SET sort_order=0; UPDATE lessons SET sort_order=0; UPDATE video_uploads SET course_id='c',status='PROCESSING';",
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
