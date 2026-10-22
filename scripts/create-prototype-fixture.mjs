import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(process.argv[2] ?? path.join(root, 'data/prototype-rehearsal.db'));

if (existsSync(destination)) {
  throw new Error(`Refusing to overwrite existing database: ${destination}`);
}

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'maia-prototype-fixture-'));
const temporaryDatabase = path.join(temporaryDirectory, 'prototype.db');
let db;

try {
  db = new Database(temporaryDatabase);
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)');

  for (const version of ['001_initial_schema', '002_learning', '003_outbox_leases']) {
    const sql = readFileSync(path.join(root, 'migrations', `${version}.sql`), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(version);
  }

  db.exec(`
    INSERT INTO users(id,email,email_normalized,password_hash,role,locale,verified_at)
    VALUES
      ('fixture-author','author@example.invalid','author@example.invalid','not-a-real-password-hash','author','en','2026-09-01T00:00:00Z'),
      ('fixture-learner','learner@example.invalid','learner@example.invalid','not-a-real-password-hash','learner','pt-BR','2026-09-02T00:00:00Z');
    INSERT INTO sessions(id,user_id,hash,expires_at)
    VALUES ('fixture-session','fixture-learner','fictional-session-hash','2030-01-01T00:00:00Z');
    INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at)
    VALUES ('fixture-token','fixture-learner','fictional-token-hash','verify','2030-01-01T00:00:00Z');
    INSERT INTO totp_secrets(user_id,secret,verified_at)
    VALUES ('fixture-author','fictional-totp-secret','2026-09-01T00:00:00Z');
    INSERT INTO assets(id,owner_id,kind,storage_key,status,metadata_json)
    VALUES ('fixture-legacy-video','fixture-author','video','fictional/legacy-video.mp4','READY','{}');
    INSERT INTO courses(id,slug,access_mode,status,locale,author_id,current_revision_id)
    VALUES
      ('fixture-published-course','fictional-published-course','OPEN_FREE','PUBLISHED','en','fixture-author','fixture-published-revision'),
      ('fixture-draft-course','fictional-draft-course','ENROLLED_FREE','DRAFT','pt-BR','fixture-author','fixture-draft-revision');
    INSERT INTO course_revisions(id,course_id,title,summary,published_at)
    VALUES
      ('fixture-published-revision','fixture-published-course','Fictional Published Course','Synthetic test summary','2026-09-01T00:00:00Z'),
      ('fixture-draft-revision','fixture-draft-course','Fictional Draft Course','Synthetic draft summary',NULL);
    INSERT INTO modules(id,revision_id,sort_order,title)
    VALUES
      ('fixture-published-module','fixture-published-revision',0,'Fictional Module'),
      ('fixture-draft-module','fixture-draft-revision',0,'Draft Module');
    INSERT INTO lessons(id,module_id,sort_order,media_id,body)
    VALUES
      ('fixture-published-lesson','fixture-published-module',0,'fixture-legacy-video','Literal legacy text: <b>not markup</b>\n<script>fictional()</script>'),
      ('fixture-draft-lesson','fixture-draft-module',0,NULL,'Draft literal text: **not Markdown**');
    INSERT INTO enrollments(id,user_id,course_id,revision_id,enrolled_at)
    VALUES ('fixture-enrollment','fixture-learner','fixture-published-course','fixture-published-revision','2026-09-03T00:00:00Z');
    INSERT INTO entitlements(id,enrollment_id,source_type,starts_at)
    VALUES ('fixture-entitlement','fixture-enrollment','free','2026-09-03T00:00:00Z');
    INSERT INTO lesson_progress(enrollment_id,lesson_id,position_seconds,completed_at,updated_at)
    VALUES ('fixture-enrollment','fixture-published-lesson',137,'2026-09-04T00:00:00Z','2026-09-04T00:00:00Z');
    INSERT INTO promotions(id,slot,course_id,starts_at,ends_at,priority)
    VALUES ('fixture-promotion','featured','fixture-published-course','2026-09-01T00:00:00Z',NULL,7);
  `);
  db.close();
  db = undefined;

  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(temporaryDatabase, destination, constants.COPYFILE_EXCL);
  console.log(`Created fictional prototype test database: ${destination}`);
} finally {
  db?.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
