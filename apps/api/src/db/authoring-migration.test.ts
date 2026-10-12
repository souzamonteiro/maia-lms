import { it,expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    expect(db.prepare('SELECT content_format,body,render_policy_version FROM lessons').get()).toEqual({content_format:'plain',body:'# Literal <b>text</b>',render_policy_version:1});
    expect(db.prepare('SELECT revision_id FROM enrollments').get()).toEqual({revision_id:'r'});
    expect(db.prepare('SELECT count(*) AS n FROM lesson_progress WHERE completed_at IS NOT NULL').get()).toEqual({n:1});
    expect(db.pragma('foreign_key_check')).toEqual([]);
  }finally{db.close();}
});

it('restores and upgrades a prototype database without losing identity, learning state or literal legacy text', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'maia-base-02-'));
  const prototypePath = path.join(directory, 'prototype.db');
  const restoredPath = path.join(directory, 'restored.db');
  let prototype: Database.Database | undefined;
  let restored: Database.Database | undefined;
  try {
    prototype = new Database(prototypePath);
    prototype.pragma('foreign_keys = ON');
    prototype.exec('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)');
    for (const file of ['001_initial_schema', '002_learning', '003_outbox_leases']) {
      prototype.exec(readFileSync(`migrations/${file}.sql`, 'utf8'));
      prototype.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(file);
    }
    prototype.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash,role,locale,verified_at)
      VALUES ('author','author@example.com','author@example.com','author-hash','author','en','2026-09-01T00:00:00Z'),
             ('learner','learner@example.com','learner@example.com','learner-hash','learner','pt-BR','2026-09-02T00:00:00Z');
      INSERT INTO sessions(id,user_id,hash,expires_at)
      VALUES ('legacy-session','learner','session-hash','2030-01-01T00:00:00Z');
      INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at)
      VALUES ('legacy-email-token','learner','email-token-hash','verify','2030-01-01T00:00:00Z');
      INSERT INTO totp_secrets(user_id,secret,verified_at)
      VALUES ('author','legacy-totp-secret','2026-09-01T00:00:00Z');
      INSERT INTO courses(id,slug,access_mode,status,locale,author_id,current_revision_id)
      VALUES ('published-course','legacy-published','OPEN_FREE','PUBLISHED','en','author','published-revision'),
             ('draft-course','legacy-draft','ENROLLED_FREE','DRAFT','pt-BR','author','draft-revision');
      INSERT INTO course_revisions(id,course_id,title,summary,published_at)
      VALUES ('published-revision','published-course','Legacy published title','Legacy summary','2026-09-01T00:00:00Z'),
             ('draft-revision','draft-course','Legacy draft title','Draft summary',NULL);
      INSERT INTO modules(id,revision_id,sort_order,title)
      VALUES ('published-module','published-revision',0,'Legacy module'),
             ('draft-module','draft-revision',0,'Draft module');
            INSERT INTO lessons(id,module_id,sort_order,media_id,body)
            VALUES ('published-lesson','published-module',0,'legacy-video-ref','Literal legacy text: <b>not markup</b>\n<script>old()</script>'),
              ('draft-lesson','draft-module',0,NULL,'Draft literal text: **not Markdown**');
      INSERT INTO enrollments(id,user_id,course_id,revision_id,enrolled_at)
      VALUES ('legacy-enrollment','learner','published-course','published-revision','2026-09-03T00:00:00Z');
      INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
      VALUES ('legacy-entitlement','legacy-enrollment','free','2026-09-03T00:00:00Z');
      INSERT INTO lesson_progress(enrollment_id,lesson_id,position_seconds,completed_at,updated_at)
      VALUES ('legacy-enrollment','published-lesson',137,'2026-09-04T00:00:00Z','2026-09-04T00:00:00Z');
      INSERT INTO promotions(id,slot,course_id,starts_at,ends_at,priority)
      VALUES ('legacy-promotion','featured','published-course','2026-09-01T00:00:00Z',NULL,7);
    `);

    await prototype.backup(restoredPath);
    prototype.close();
    prototype = undefined;

    restored = new Database(restoredPath);
    restored.pragma('foreign_keys = ON');
    runMigrations(restored);
    runMigrations(restored);

    expect(restored.prepare('SELECT id,email,password_hash,role,locale,verified_at FROM users ORDER BY id').all()).toEqual([
      { id: 'author', email: 'author@example.com', password_hash: 'author-hash', role: 'author', locale: 'en', verified_at: '2026-09-01T00:00:00Z' },
      { id: 'learner', email: 'learner@example.com', password_hash: 'learner-hash', role: 'learner', locale: 'pt-BR', verified_at: '2026-09-02T00:00:00Z' },
    ]);
    expect(restored.prepare('SELECT count(*) AS count FROM http_sessions').get()).toEqual({ count: 0 });
    expect(restored.prepare('SELECT id,user_id,hash,expires_at FROM sessions').get()).toEqual({
      id: 'legacy-session', user_id: 'learner', hash: 'session-hash', expires_at: '2030-01-01T00:00:00Z',
    });
    expect(restored.prepare('SELECT id,user_id,token_hash,kind FROM email_tokens').get()).toEqual({
      id: 'legacy-email-token', user_id: 'learner', token_hash: 'email-token-hash', kind: 'verify',
    });
    expect(restored.prepare('SELECT user_id,secret,verified_at FROM totp_secrets').get()).toEqual({
      user_id: 'author', secret: 'legacy-totp-secret', verified_at: '2026-09-01T00:00:00Z',
    });
    expect(restored.prepare('SELECT id,current_revision_id,published_revision_id FROM courses ORDER BY id').all()).toEqual([
      { id: 'draft-course', current_revision_id: 'draft-revision', published_revision_id: null },
      { id: 'published-course', current_revision_id: 'published-revision', published_revision_id: 'published-revision' },
    ]);
    expect(restored.prepare('SELECT id,slug,access_mode,locale FROM course_revisions ORDER BY id').all()).toEqual([
      { id: 'draft-revision', slug: 'legacy-draft', access_mode: 'ENROLLED_FREE', locale: 'pt-BR' },
      { id: 'published-revision', slug: 'legacy-published', access_mode: 'OPEN_FREE', locale: 'en' },
    ]);
    expect(restored.prepare('SELECT id,revision_id FROM enrollments').get()).toEqual({
      id: 'legacy-enrollment', revision_id: 'published-revision',
    });
    expect(restored.prepare('SELECT id,enrollment_id,source_type,starts_at FROM entitlements').get()).toEqual({
      id: 'legacy-entitlement', enrollment_id: 'legacy-enrollment', source_type: 'free', starts_at: '2026-09-03T00:00:00Z',
    });
    expect(restored.prepare('SELECT enrollment_id,lesson_id,position_seconds,completed_at FROM lesson_progress').get()).toEqual({
      enrollment_id: 'legacy-enrollment', lesson_id: 'published-lesson', position_seconds: 137, completed_at: '2026-09-04T00:00:00Z',
    });
    expect(restored.prepare('SELECT id,body,content_format FROM lessons ORDER BY id').all()).toEqual([
      { id: 'draft-lesson', body: 'Draft literal text: **not Markdown**', content_format: 'plain' },
      { id: 'published-lesson', body: 'Literal legacy text: <b>not markup</b>\n<script>old()</script>', content_format: 'plain' },
    ]);
    expect(restored.prepare('SELECT id,media_id,video_id FROM lessons ORDER BY id').all()).toEqual([
      { id: 'draft-lesson', media_id: null, video_id: null },
      { id: 'published-lesson', media_id: 'legacy-video-ref', video_id: null },
    ]);
    expect(restored.prepare('SELECT id,slot,course_id,starts_at,ends_at,priority FROM promotions').get()).toEqual({
      id: 'legacy-promotion', slot: 'featured', course_id: 'published-course', starts_at: '2026-09-01T00:00:00Z', ends_at: null, priority: 7,
    });
    expect(restored.prepare('SELECT id,version FROM home_settings').get()).toEqual({ id: 1, version: 0 });
    expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(restored.pragma('foreign_key_check')).toEqual([]);
    expect(
      restored.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get('077_certificate_payload_revision_consistency'),
    ).toEqual({ 1: 1 });
  } finally {
    prototype?.close();
    restored?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('adds an empty private display name to existing accounts', () => {
    const db = new Database(':memory:');
    try {
      db.exec('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)');
      for (const file of [
        '001_initial_schema',
        '002_learning',
        '003_outbox_leases',
        '004_authoring',
        '005_video_uploads',
        '006_attachments',
        '007_captions',
        '008_render_policy',
        '009_upload_activity',
        '010_course_covers',
        '011_course_prerequisites',
        '012_course_instructor_terms',
        '013_course_trailers',
        '014_course_categories',
      ]) {
        db.exec(readFileSync(`migrations/${file}.sql`, 'utf8'));
        db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(file);
      }
      db.prepare(
        "INSERT INTO users(id,email,email_normalized,password_hash) VALUES('legacy-user','legacy@example.com','legacy@example.com','hash')",
      ).run();

      runMigrations(db);

      expect(db.prepare('SELECT display_name FROM users WHERE id=?').get('legacy-user')).toEqual({
        display_name: '',
      });
      expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally {
      db.close();
    }
  });

it('pins existing Markdown to policy 1 without changing published content', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    // Reconstruct the pre-008 shape to exercise the upgrade on existing Markdown.
    db.exec('ALTER TABLE lessons DROP COLUMN render_policy_version');
    db.prepare('DELETE FROM schema_migrations WHERE version = ?').run('008_render_policy');
    db.exec(`INSERT INTO users(id,email,email_normalized,password_hash) VALUES('u','a@b.com','a@b.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('c','existing','u');
      INSERT INTO course_revisions(id,course_id,title,summary) VALUES('r','c','Existing','Summary');
      INSERT INTO modules(id,revision_id,sort_order,title) VALUES('m','r',0,'Module');
      INSERT INTO lessons(id,module_id,sort_order,body,content_format) VALUES('l','m',0,'**Existing**','markdown');`);
    runMigrations(db);
    runMigrations(db);
    expect(db.prepare('SELECT body,content_format,render_policy_version FROM lessons').get()).toEqual({
      body: '**Existing**', content_format: 'markdown', render_policy_version: 1,
    });
    expect(() => db.exec('UPDATE lessons SET render_policy_version=0')).toThrow();
    expect(() => db.exec('UPDATE lessons SET render_policy_version=1.5')).toThrow();
  } finally { db.close(); }
});
