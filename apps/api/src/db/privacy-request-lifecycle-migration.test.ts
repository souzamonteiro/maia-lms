import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps closed privacy requests terminal while allowing normal review transitions', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    expect(db.prepare('SELECT version FROM schema_migrations ORDER BY rowid DESC LIMIT 11').all())
      .toEqual([
        { version: '206_assessment_text_utf16_integrity' },
        { version: '205_assessment_answer_points_integrity' },
        { version: '204_assessment_question_text_integrity' },
        { version: '203_assessment_question_count_limit' },
        { version: '202_assessment_question_choice_integrity' },
        { version: '201_assessment_score_points_range' },
        { version: '200_assessment_answer_selection_integrity' },
        { version: '199_assessment_result_answers_integrity' },
        { version: '198_assessment_attempt_timestamp_integrity' },
        { version: '197_assessment_attempt_identity_immutable' },
        { version: '196_assessment_attempt_access_integrity' },
      ]);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash'),
             ('other-user','other@example.com','other@example.com','hash');
      INSERT INTO account_privacy_requests(id,user_id,request_type,status)
      VALUES ('request','user','deletion','OPEN');
    `);

    expect(() => db.prepare(`UPDATE account_privacy_requests SET id='other-id'
      WHERE id='request'`).run()).toThrow(/privacy request identity is immutable/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET user_id='other-user'
      WHERE id='request'`).run()).toThrow(/privacy request identity is immutable/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET created_at='2099-01-01'
      WHERE id='request'`).run()).toThrow(/privacy request identity is immutable/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='not-a-date'
      WHERE id='request'`).run()).toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='2000-01-01'
      WHERE id='request'`).run()).toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='2099-01-01'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='2098-01-01'
      WHERE id='request'`).run()).toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='IN_REVIEW'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='IN_REVIEW'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='OPEN'
      WHERE id='request'`).run()).toThrow(/privacy requests cannot return to open/);
    expect(db.prepare('SELECT status FROM account_privacy_requests WHERE id=?').get('request'))
      .toEqual({ status: 'IN_REVIEW' });
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='CLOSED'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='CLOSED'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='OPEN'
      WHERE id='request'`).run()).toThrow(/closed privacy requests cannot be reopened/);

    expect(db.prepare('SELECT id,status FROM account_privacy_requests ORDER BY id').all())
      .toEqual([{ id: 'request', status: 'CLOSED' }]);
    expect(() => db.prepare(`INSERT INTO account_privacy_requests
      (id,user_id,request_type,created_at,updated_at)
      VALUES ('bad-date','other-user','deletion','invalid','invalid')`).run())
      .toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`INSERT INTO account_privacy_requests
      (id,user_id,request_type,created_at,updated_at)
      VALUES ('out-of-order','other-user','deletion','2099-01-01','2000-01-01')`).run())
      .toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`INSERT INTO account_privacy_requests
      (id,user_id,request_type,created_at,updated_at)
      VALUES ('valid-dates','other-user','deletion','2026-01-01T10:00:00Z','2026-01-01T10:00:00Z')`).run())
      .not.toThrow();
  } finally {
    db.close();
  }
});
