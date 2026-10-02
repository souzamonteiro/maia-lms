import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows one active certificate per enrollment and supports revoke-then-reissue', () => {
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
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
      VALUES ('enrollment-a','user','course-a','revision-a'),
             ('enrollment-b','user','course-b','revision-b');
      INSERT INTO certificates(id,enrollment_id,public_code,confirmed_name,payload_hash)
            VALUES ('certificate-old','enrollment-a','public-code-old-00000000000000000001','Learner','hash-old');
    `);

    const addCertificate = db.prepare(
      'INSERT INTO certificates(id,enrollment_id,public_code,confirmed_name,payload_hash,revoked_at,supersedes_id) VALUES(?,?,?,?,?,?,?)',
    );
    expect(() =>
      addCertificate.run('certificate-duplicate', 'enrollment-a', 'public-code-duplicate-0000000002', 'Learner', 'hash-2', null, null),
    ).toThrow(/active certificate already exists for enrollment/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=datetime(\'now\'),reason=NULL WHERE id=?').run('certificate-old'),
    ).toThrow(/revoked certificate requires a reason/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=datetime(\'now\'),reason=? WHERE id=?').run('   ', 'certificate-old'),
    ).toThrow(/revoked certificate requires a reason/);

    db.prepare('UPDATE certificates SET revoked_at=datetime(\'now\'),reason=? WHERE id=?').run(
      'Reissued',
      'certificate-old',
    );
    expect(() =>
      addCertificate.run('certificate-new', 'enrollment-a', 'public-code-new-00000000000000000002', 'Learner', 'hash-new', null, 'certificate-old'),
    ).not.toThrow();
    expect(
      db.prepare('SELECT supersedes_id FROM certificates WHERE id=?').get('certificate-new'),
    ).toEqual({ supersedes_id: 'certificate-old' });
    expect(() =>
      db.prepare('UPDATE certificates SET supersedes_id=? WHERE id=?').run(null, 'certificate-new'),
    ).toThrow(/certificate supersession reference is immutable/);
    expect(() =>
      addCertificate.run('certificate-branch', 'enrollment-a', 'public-code-branch-00000000000000003', 'Learner', 'hash-branch', null, 'certificate-old'),
    ).toThrow(/invalid certificate supersession reference/);
    expect(() =>
      addCertificate.run('certificate-wrong-enrollment', 'enrollment-b', 'public-code-wrong-00000000000000004', 'Learner', 'hash-wrong', null, 'certificate-old'),
    ).toThrow(/invalid certificate supersession reference/);
    expect(() =>
      addCertificate.run('certificate-short-code', 'enrollment-b', 'short', 'Learner', 'hash-short', null, null),
    ).toThrow(/certificate public code is too short/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=NULL WHERE id=?').run('certificate-old'),
    ).toThrow(/certificate revocation cannot be cleared/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=? WHERE id=?').run('2000-01-01T00:00:00Z', 'certificate-old'),
    ).toThrow(/certificate revocation timestamp cannot move backward/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=? WHERE id=?').run('2099-01-01T00:00:00Z', 'certificate-old'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE certificates SET public_code=? WHERE id=?').run('rewritten-code-00000000000000000000', 'certificate-old'),
    ).toThrow(/certificate snapshot is immutable/);
    expect(() =>
      db.prepare('UPDATE certificates SET confirmed_name=? WHERE id=?').run('Changed Name', 'certificate-old'),
    ).toThrow(/certificate snapshot is immutable/);
    expect(() =>
      db.prepare('UPDATE certificates SET payload_hash=? WHERE id=?').run('rewritten-hash', 'certificate-old'),
    ).toThrow(/certificate snapshot is immutable/);
    expect(() => db.prepare('DELETE FROM certificates WHERE id=?').run('certificate-old')).toThrow(
      /certificate history is retained/,
    );
    expect(() =>
      db.prepare('UPDATE certificates SET reason=? WHERE id=?').run('Corrected reason', 'certificate-old'),
    ).not.toThrow();
    expect(() =>
      addCertificate.run('certificate-other-enrollment', 'enrollment-b', 'public-code-other-00000000000000000003', 'Learner', 'hash-other', null, null),
    ).not.toThrow();
    expect(
      db.prepare('SELECT id,revoked_at FROM certificates WHERE enrollment_id=? ORDER BY id').all('enrollment-a'),
    ).toHaveLength(2);
    expect(
      db.prepare('SELECT count(*) AS n FROM certificates WHERE enrollment_id=? AND revoked_at IS NULL').get('enrollment-a'),
    ).toEqual({ n: 1 });
  } finally {
    db.close();
  }
});