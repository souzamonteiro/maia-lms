import { it,expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { runMigrations } from './migrate.js';
it('upgrades an existing published text course without changing enrollments, progress or content',()=>{
  const db=new Database(':memory:');db.pragma('foreign_keys = ON');
  try {
    db.exec('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)');
    for(const file of ['001_initial_schema','002_learning','003_outbox_leases']) {
      db.exec(readFileSync(`migrations/${file}.sql`,'utf8'));
      db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(file);
    }
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','a@b.com','a@b.com','hash');
      INSERT INTO courses(id,slug,author_id,status,current_revision_id) VALUES('c','existing','u','PUBLISHED','r');
      INSERT INTO course_revisions(id,course_id,title,summary,published_at) VALUES('r','c','Existing','Summary',datetime('now'));
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES('m','r',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,body) VALUES('l','m',0,'# Literal <b>text</b>');
      INSERT INTO enrollments(id,user_id,course_id,revision_id) VALUES('e','u','c','r');
      INSERT INTO lesson_progress(enrollment_id,lesson_id,completed_at) VALUES('e','l',datetime('now'));`);
    runMigrations(db);runMigrations(db);
    expect(db.prepare('SELECT current_revision_id,published_revision_id FROM courses').get()).toEqual({current_revision_id:'r',published_revision_id:'r'});
    expect(db.prepare('SELECT content_format,body FROM lessons').get()).toEqual({content_format:'plain',body:'# Literal <b>text</b>'});
    expect(db.prepare('SELECT revision_id FROM enrollments').get()).toEqual({revision_id:'r'});
    expect(db.prepare('SELECT count(*) AS n FROM lesson_progress WHERE completed_at IS NOT NULL').get()).toEqual({n:1});
    expect(db.pragma('foreign_key_check')).toEqual([]);
  }finally{db.close();}
});
