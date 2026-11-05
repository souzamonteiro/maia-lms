import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('enforces authoring title UTF-16 limits on direct inserts and updates', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','course','author');
      INSERT INTO course_revisions(id,course_id,title,summary)
        VALUES('revision','course','Course title','A sufficiently long summary');
      INSERT INTO modules(id,revision_id,sort_order,title)
        VALUES('module','revision',0,'Module title');
      INSERT INTO lessons(id,module_id,sort_order,title,body)
        VALUES('lesson','module',0,'Lesson title','Content');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
        VALUES('upload','author','course','attachment.pdf',1,'attachment');
      INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order)
        VALUES('attachment','revision','upload','Attachment title','',0);
    `);

    const insertTitle = {
      module: db.prepare('INSERT INTO modules(id,revision_id,sort_order,title) VALUES(?,?,?,?)'),
      lesson: db.prepare('INSERT INTO lessons(id,module_id,sort_order,title) VALUES(?,?,?,?)'),
    };
    const boundaryTitle = '😀'.repeat(100);
    insertTitle.module.run('module-boundary', 'revision', 1, boundaryTitle);
    insertTitle.lesson.run('lesson-boundary', 'module', 1, boundaryTitle);
    db.prepare(`INSERT INTO course_attachments
      (id,revision_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?)`)
      .run('attachment-boundary', 'revision', 'upload', boundaryTitle, '😀'.repeat(1000), 1);

    const invalidTitles = [
      '',
      '😀'.repeat(101),
      'Valid\u0000title',
    ];
    for (const [index, title] of invalidTitles.entries()) {
      expect(() => insertTitle.module.run(`module-invalid-${index}`, 'revision', index + 1, title))
        .toThrow(/invalid authoring title/);
      expect(() => insertTitle.lesson.run(`lesson-invalid-${index}`, 'module', index + 1, title))
        .toThrow(/invalid authoring title/);
      expect(() => db.prepare(`INSERT INTO course_attachments
        (id,revision_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,'',?)`)
        .run(`attachment-invalid-${index}`, 'revision', 'upload', title, index + 1))
        .toThrow(/invalid authoring title|invalid course attachment text/);
    }
    for (const [index, description] of [
      ['nul', 'Valid\u0000description'],
      ['over-limit', '😀'.repeat(1001)],
    ]) {
      expect(() => db.prepare(`INSERT INTO course_attachments
        (id,revision_id,upload_id,title,description,sort_order) VALUES(?,?,?,'Valid title',?,?)`)
        .run(`attachment-description-invalid-${index}`, 'revision', 'upload', description, index + 2))
        .toThrow(/invalid course attachment text/);
    }

    for (const [table, id] of [
      ['modules', 'module'],
      ['lessons', 'lesson'],
      ['course_attachments', 'attachment'],
    ]) {
      expect(() => db.prepare(`UPDATE ${table} SET title=? WHERE id=?`)
        .run('😀'.repeat(101), id)).toThrow(/invalid authoring title/);
      expect(() => db.prepare(`UPDATE ${table} SET title=? WHERE id=?`)
        .run('Valid\u0000title', id)).toThrow(/invalid authoring title/);
    }
    expect(() => db.prepare('UPDATE modules SET title=? WHERE id=?')
      .run('', 'module')).toThrow(/invalid authoring title/);
    expect(() => db.prepare('UPDATE lessons SET title=? WHERE id=?')
      .run('', 'lesson')).toThrow(/invalid authoring title/);
    expect(() => db.prepare('UPDATE course_attachments SET title=? WHERE id=?')
      .run('', 'attachment')).toThrow(/invalid course attachment text/);
    expect(() => db.prepare('UPDATE course_attachments SET description=? WHERE id=?')
      .run('Valid\u0000description', 'attachment')).toThrow(/invalid course attachment text/);
    expect(() => db.prepare('UPDATE course_attachments SET description=? WHERE id=?')
      .run('😀'.repeat(1001), 'attachment')).toThrow(/invalid course attachment text/);

    for (const table of ['modules', 'lessons', 'course_attachments']) {
      expect(db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count).toBe(2);
    }
  } finally {
    db.close();
  }
});
