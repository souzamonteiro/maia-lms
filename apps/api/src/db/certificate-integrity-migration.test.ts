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
            INSERT INTO course_revisions(id,course_id,title,summary,duration_minutes,instructor_name)
            VALUES ('revision-a','course-a','Test course','Summary A',60,'Test issuer'),
              ('revision-b','course-b','Test course','Summary B',60,'Test issuer');
            INSERT INTO enrollments(id,user_id,course_id,revision_id,completed_at)
            VALUES ('enrollment-a','user','course-a','revision-a','2026-10-10T10:00:00.000Z'),
              ('enrollment-b','user','course-b','revision-b','2026-10-10T10:00:00.000Z');
    `);

    const addCertificate = (
      id: string,
      enrollmentId: string,
      publicCode: string,
      confirmedName: string,
      payloadHash: string,
      revokedAt: string | null,
      supersedesId: string | null,
    ) => {
      const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      return db.prepare(
        'INSERT INTO certificates(id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,revoked_at,supersedes_id,payload_json,disclosure_hash,disclosure_consented_at,disclosure_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        enrollmentId,
        publicCode,
        confirmedName,
        payloadHash,
        issuedAt,
        revokedAt,
        supersedesId,
        JSON.stringify({
          confirmedName,
          courseTitle: 'Test course',
          workloadMinutes: 60,
          issuerName: 'Test issuer',
          completedAt: '2026-10-10T10:00:00.000Z',
          publicCode,
          issuedAt,
          status: 'valid',
        }),
        'a'.repeat(64),
        issuedAt,
        'certificate-disclosure-v1',
      );
    };
    addCertificate(
      'certificate-old',
      'enrollment-a',
      'public-code-old-00000000000000000001',
      'Learner',
      'hash-old',
      null,
      null,
    );
    expect(() =>
      db.prepare(
        'INSERT INTO certificates(id,enrollment_id,public_code,confirmed_name,payload_hash) VALUES(?,?,?,?,?)',
      ).run('certificate-missing-snapshot', 'enrollment-b', 'public-code-missing-snapshot-000001', 'Learner', 'hash-missing'),
    ).toThrow(/new certificates require an immutable consented payload snapshot|invalid certificate payload snapshot|certificate payload does not match row snapshot|certificate payload does not match enrollment revision/);
    expect(() =>
      db.prepare(`INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,
        payload_json,disclosure_hash,disclosure_consented_at,disclosure_version
      ) VALUES(?,?,?,?,?,'not-a-timestamp',?,?,?,?)`).run(
        'certificate-invalid-issued-at',
        'enrollment-b',
        'public-code-invalid-issued-at-000000001',
        'Learner',
        'hash-invalid-issued-at',
        JSON.stringify({
          confirmedName: 'Learner',
          courseTitle: 'Test course',
          workloadMinutes: 60,
          issuerName: 'Test issuer',
          completedAt: '2026-10-10T10:00:00.000Z',
          publicCode: 'public-code-invalid-issued-at-000000001',
          issuedAt: new Date().toISOString(),
          status: 'valid',
        }),
        'a'.repeat(64),
        new Date().toISOString(),
        'certificate-disclosure-v1',
      ),
    ).toThrow(/invalid certificate issuance timestamp|certificate payload does not match row snapshot|certificate payload does not match enrollment revision/);
    expect(() =>
      db.prepare(`INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,payload_json,
        disclosure_hash,disclosure_consented_at,disclosure_version
      ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
        'certificate-invalid-payload',
        'enrollment-b',
        'public-code-invalid-payload-0000000001',
        'Learner',
        'hash-invalid-payload',
        '{}',
        'a'.repeat(64),
        new Date().toISOString(),
        'certificate-disclosure-v1',
      ),
    ).toThrow(/invalid certificate payload snapshot|certificate payload does not match row snapshot|certificate payload does not match enrollment revision/);
    expect(() => {
      const publicCode = 'public-code-name-mismatch-0000000000001';
      const issuedAt = new Date().toISOString();
      db.prepare(`INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,payload_json,
        disclosure_hash,disclosure_consented_at,disclosure_version
      ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
        'certificate-name-mismatch',
        'enrollment-b',
        publicCode,
        'Column learner',
        'hash-name-mismatch',
        issuedAt,
        JSON.stringify({
          confirmedName: 'Payload learner',
          courseTitle: 'Test course',
          workloadMinutes: 60,
          issuerName: 'Test issuer',
          completedAt: '2026-10-10T10:00:00.000Z',
          publicCode,
          issuedAt,
          status: 'valid',
        }),
        'a'.repeat(64),
        issuedAt,
        'certificate-disclosure-v1',
      );
    }).toThrow(/certificate payload does not match row snapshot/);
    expect(() => {
      const publicCode = 'public-code-course-snapshot-mismatch';
      const issuedAt = '2026-10-11T10:00:00.000Z';
      db.prepare(`INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,payload_json,
        disclosure_hash,disclosure_consented_at,disclosure_version
      ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
        'certificate-course-snapshot-mismatch',
        'enrollment-b',
        publicCode,
        'Learner',
        'hash-course-snapshot-mismatch',
        issuedAt,
        JSON.stringify({
          confirmedName: 'Learner',
          courseTitle: 'Forged course title',
          workloadMinutes: 60,
          issuerName: 'Test issuer',
          completedAt: '2026-10-10T10:00:00.000Z',
          publicCode,
          issuedAt,
          status: 'valid',
        }),
        'a'.repeat(64),
        issuedAt,
        'certificate-disclosure-v1',
      );
    }).toThrow(/certificate payload does not match enrollment revision/);
    for (const [label, field, value] of [
      ['workload', 'workloadMinutes', 61],
      ['issuer', 'issuerName', 'Forged issuer'],
      ['completion', 'completedAt', '2026-10-09T10:00:00.000Z'],
    ] as const) {
      const publicCode = `payload-mismatch-${label}-0000000000000000000000`;
      const issuedAt = '2026-10-11T10:00:00.000Z';
      const payload: Record<string, unknown> = {
        confirmedName: 'Learner',
        courseTitle: 'Test course',
        workloadMinutes: 60,
        issuerName: 'Test issuer',
        completedAt: '2026-10-10T10:00:00.000Z',
        publicCode,
        issuedAt,
        status: 'valid',
      };
      payload[field] = value;
      expect(() =>
        db.prepare(`INSERT INTO certificates(
          id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,payload_json,
          disclosure_hash,disclosure_consented_at,disclosure_version
        ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
          `certificate-${label}-mismatch`,
          'enrollment-b',
          publicCode,
          'Learner',
          `hash-${label}-mismatch`,
          issuedAt,
          JSON.stringify(payload),
          'a'.repeat(64),
          issuedAt,
          'certificate-disclosure-v1',
        ),
      ).toThrow(/certificate payload does not match enrollment revision/);
    }
    expect(() => {
      const publicCode = 'public-code-issued-at-mismatch-0000001';
      const rowIssuedAt = '2026-10-11T10:00:00.000Z';
      db.prepare(`INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,payload_json,
        disclosure_hash,disclosure_consented_at,disclosure_version
      ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
        'certificate-issued-at-mismatch',
        'enrollment-b',
        publicCode,
        'Learner',
        'hash-issued-at-mismatch',
        rowIssuedAt,
        JSON.stringify({
          confirmedName: 'Learner',
          courseTitle: 'Test course',
          workloadMinutes: 60,
          issuerName: 'Test issuer',
          completedAt: '2026-10-10T10:00:00.000Z',
          publicCode,
          issuedAt: '2026-10-10T10:00:00.000Z',
          status: 'valid',
        }),
        'a'.repeat(64),
        rowIssuedAt,
        'certificate-disclosure-v1',
      );
    }).toThrow(/certificate payload does not match row snapshot/);
    expect(() =>
      addCertificate('certificate-duplicate', 'enrollment-a', 'public-code-duplicate-0000000002', 'Learner', 'hash-2', null, null),
    ).toThrow(/active certificate already exists for enrollment/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=datetime(\'now\'),reason=NULL WHERE id=?').run('certificate-old'),
    ).toThrow(/revoked certificate requires a reason/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=datetime(\'now\'),reason=? WHERE id=?').run('   ', 'certificate-old'),
    ).toThrow(/revoked certificate requires a reason/);
    expect(() =>
      db.prepare('UPDATE certificates SET revoked_at=?,reason=? WHERE id=?')
        .run('not-a-timestamp', 'Invalid timestamp', 'certificate-old'),
    ).toThrow(/invalid certificate revocation timestamp/);

    db.prepare('UPDATE certificates SET revoked_at=datetime(\'now\'),reason=? WHERE id=?').run(
      'Reissued',
      'certificate-old',
    );
    expect(() =>
      addCertificate('certificate-new', 'enrollment-a', 'public-code-new-00000000000000000002', 'Learner', 'hash-new', null, 'certificate-old'),
    ).not.toThrow();
    expect(
      db.prepare('SELECT supersedes_id FROM certificates WHERE id=?').get('certificate-new'),
    ).toEqual({ supersedes_id: 'certificate-old' });
    expect(() =>
      db.prepare('UPDATE certificates SET supersedes_id=? WHERE id=?').run(null, 'certificate-new'),
    ).toThrow(/certificate supersession reference is immutable/);
    expect(() =>
      addCertificate('certificate-branch', 'enrollment-a', 'public-code-branch-00000000000000003', 'Learner', 'hash-branch', null, 'certificate-old'),
    ).toThrow(/invalid certificate supersession reference/);
    expect(() =>
      addCertificate('certificate-wrong-enrollment', 'enrollment-b', 'public-code-wrong-00000000000000004', 'Learner', 'hash-wrong', null, 'certificate-old'),
    ).toThrow(/invalid certificate supersession reference/);
    expect(() =>
      addCertificate('certificate-short-code', 'enrollment-b', 'short', 'Learner', 'hash-short', null, null),
    ).toThrow(/certificate public code is too short/);
    expect(() =>
      (() => {
        const bornRevokedCode = 'public-code-born-revoked-0000000000001';
        const bornRevokedIssuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        return db.prepare(`INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,revoked_at,reason,
        payload_json,disclosure_hash,disclosure_consented_at,disclosure_version
      ) VALUES(?,?,?,?,?,?,datetime('now'),?,?,?,?,?)`).run(
        'certificate-born-revoked',
        'enrollment-b',
        bornRevokedCode,
        'Learner',
        'hash-born-revoked',
        bornRevokedIssuedAt,
        'Revoked at issuance',
        JSON.stringify({
          confirmedName: 'Learner',
          courseTitle: 'Test course',
          workloadMinutes: 60,
          issuerName: 'Test issuer',
          completedAt: '2026-10-10T10:00:00.000Z',
          publicCode: bornRevokedCode,
          issuedAt: bornRevokedIssuedAt,
          status: 'valid',
        }),
        'a'.repeat(64),
        new Date().toISOString(),
        'certificate-disclosure-v1',
        );
      })(),
    ).toThrow(/new certificate cannot be inserted revoked/);
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
    expect(() =>
      db.prepare('UPDATE certificates SET payload_json=? WHERE id=?').run('{"edited":true}', 'certificate-old'),
    ).toThrow(/certificate snapshot is immutable/);
    expect(() =>
      db.prepare('UPDATE certificates SET disclosure_consented_at=? WHERE id=?').run('2099-01-01T00:00:00Z', 'certificate-old'),
    ).toThrow(/certificate snapshot is immutable/);
    expect(() => db.prepare('DELETE FROM certificates WHERE id=?').run('certificate-old')).toThrow(
      /certificate history is retained/,
    );
    expect(() =>
      db.prepare('UPDATE certificates SET reason=? WHERE id=?').run('Corrected reason', 'certificate-old'),
    ).not.toThrow();
    expect(() =>
      addCertificate('certificate-other-enrollment', 'enrollment-b', 'public-code-other-00000000000000000003', 'Learner', 'hash-other', null, null),
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