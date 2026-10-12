import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('rejects direct updates to published course revision metadata', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('author','author@example.com','author@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('course','course','author');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('revision','course','Published title','Summary');
      INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
      VALUES('attachment','author','course','notes.pdf',10,'attachment');
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES('module','revision',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,title,body)
      VALUES('lesson','module',0,'Lesson','Body');
      INSERT INTO course_attachments(id,revision_id,lesson_id,upload_id,title,description,sort_order)
      VALUES('attachment-link','revision','lesson','attachment','Notes','Description',0);
      INSERT INTO categories(id,slug,name) VALUES('category','category','Category');
      INSERT INTO categories(id,slug,name) VALUES('category-b','category-b','Category B');
      INSERT INTO course_revision_categories(revision_id,category_id)
      VALUES('revision','category');
      INSERT INTO quizzes(id,revision_id,lesson_id)
      VALUES('quiz','revision','lesson');
      INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys)
      VALUES('question','quiz','Prompt','[]','[]');
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET current_revision_id='revision',published_revision_id='revision',status='PUBLISHED'
      WHERE id='course';
    `);

    expect(() =>
      db.prepare('UPDATE course_revisions SET title=? WHERE id=?').run('Rewritten title', 'revision'),
    ).toThrow(/published course revision is immutable/);
    expect(() =>
      db.prepare('UPDATE course_revisions SET published_at=NULL WHERE id=?').run('revision'),
    ).toThrow(/published course revision is immutable/);
    expect(() => db.prepare('DELETE FROM course_revisions WHERE id=?').run('revision')).toThrow(
      /published course revision is immutable/,
    );
    expect(() =>
      db.prepare("INSERT INTO course_revisions(id,course_id,title,summary,published_at) VALUES(?,?,?,?,datetime('now'))")
        .run('invalid-published','course','Invalid','Summary'),
    ).toThrow(/published course revision is immutable/);
    expect(() =>
      db.prepare('INSERT INTO modules(id,revision_id,sort_order,title) VALUES(?,?,?,?)')
        .run('module-new','revision',1,'New module'),
    ).toThrow(/published course revision is immutable/);
    expect(() => db.prepare("UPDATE modules SET title='Changed' WHERE id='module'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() => db.prepare("DELETE FROM modules WHERE id='module'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() =>
      db.prepare('INSERT INTO lessons(id,module_id,sort_order,title,body) VALUES(?,?,?,?,?)')
        .run('lesson-new','module',1,'New lesson','Body'),
    ).toThrow(/published course revision is immutable/);
    expect(() => db.prepare("UPDATE lessons SET body='Changed' WHERE id='lesson'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() => db.prepare("DELETE FROM lessons WHERE id='lesson'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() =>
      db.prepare('INSERT INTO course_attachments(id,revision_id,lesson_id,upload_id,title,description,sort_order) VALUES(?,?,?,?,?,?,?)')
        .run('attachment-new','revision','lesson','attachment','New notes','Description',1),
    ).toThrow(/published course revision is immutable/);
    expect(() =>
      db.prepare("UPDATE course_attachments SET title='Changed' WHERE id='attachment-link'").run(),
    ).toThrow(/published course revision is immutable/);
    expect(() => db.prepare("DELETE FROM course_attachments WHERE id='attachment-link'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() =>
      db.prepare('INSERT INTO course_revision_categories(revision_id,category_id) VALUES(?,?)')
        .run('revision','category-b'),
    ).toThrow(/published course revision is immutable/);
    expect(() =>
      db.prepare('UPDATE course_revision_categories SET category_id=? WHERE revision_id=?')
        .run('category-b','revision'),
    ).toThrow(/published course revision is immutable/);
    expect(() =>
      db.prepare('DELETE FROM course_revision_categories WHERE revision_id=?').run('revision'),
    ).toThrow(/published course revision is immutable/);
    expect(() =>
      db.prepare('INSERT INTO quizzes(id,revision_id) VALUES(?,?)').run('quiz-new','revision'),
    ).toThrow(/published course revision is immutable/);
    expect(() => db.prepare("UPDATE quizzes SET pass_percent=80 WHERE id='quiz'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() => db.prepare("DELETE FROM quizzes WHERE id='quiz'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() =>
      db.prepare('INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys) VALUES(?,?,?,?,?)')
        .run('question-new','quiz','New prompt','[]','[]'),
    ).toThrow(/published course revision is immutable/);
    expect(() => db.prepare("UPDATE questions SET prompt='Changed' WHERE id='question'").run()).toThrow(
      /published course revision is immutable/,
    );
    expect(() => db.prepare("DELETE FROM questions WHERE id='question'").run()).toThrow(
      /published course revision is immutable/,
    );

    db.exec(`
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('draft','course','Draft','Draft summary');
      UPDATE course_revisions SET title='Draft edit' WHERE id='draft';
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES('draft-module','draft',0,'Draft module');
    `);
    expect(db.prepare('SELECT title FROM course_revisions WHERE id=?').get('draft')).toEqual({
      title: 'Draft edit',
    });
    expect(() =>
      db.prepare("UPDATE course_revisions SET title=?,published_at=datetime('now') WHERE id=?")
        .run('Changed while publishing','draft'),
    ).toThrow(/published course revision is immutable/);
  } finally {
    db.close();
  }
});