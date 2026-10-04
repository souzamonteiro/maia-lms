import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps outbox retry counters and lease/processed state structurally valid', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    const insert = db.prepare('INSERT INTO outbox(id,event_type) VALUES(?,?)');
    insert.run('new-job', 'email.send');
    insert.run('retrying-job', 'email.send');
    insert.run('failed-job', 'email.send');
    insert.run('processed-job', 'email.send');

    expect(() => db.prepare('UPDATE outbox SET attempts=? WHERE id=?').run(-1, 'new-job'))
      .toThrow(/invalid outbox (processing state|lifecycle transition)/);
    expect(() => db.prepare('UPDATE outbox SET attempts=? WHERE id=?').run(1.5, 'new-job'))
      .toThrow(/invalid outbox (processing state|lifecycle transition)/);
    expect(() => db.prepare('INSERT INTO outbox(id,event_type,attempts) VALUES(?,?,?)').run('negative-job', 'email.send', -1))
      .toThrow(/invalid outbox processing state/);
    expect(() => db.prepare('UPDATE outbox SET lease_token=? WHERE id=?').run('orphan-lease', 'new-job'))
      .toThrow(/invalid outbox (processing state|lifecycle transition)/);
    expect(() => db.prepare('UPDATE outbox SET attempts=1,lease_token=?,processed_at=? WHERE id=?')
      .run('active-lease', new Date().toISOString(), 'new-job'))
      .toThrow(/invalid outbox (processing state|lifecycle transition)/);
    expect(() => db.prepare('UPDATE outbox SET lease_token=? WHERE id=?').run('   ', 'new-job'))
      .toThrow(/invalid outbox (processing state|lifecycle transition)/);
    expect(() => db.prepare('UPDATE outbox SET attempts=1 WHERE id=?').run('new-job'))
      .toThrow(/invalid outbox lifecycle transition/);
    expect(() => db.prepare('UPDATE outbox SET processed_at=? WHERE id=?').run(new Date().toISOString(), 'new-job'))
      .toThrow(/invalid outbox lifecycle transition/);

    db.prepare('UPDATE outbox SET attempts=1,lease_token=? WHERE id=?').run('active-lease', 'retrying-job');
    expect(() => db.prepare('UPDATE outbox SET lease_token=? WHERE id=?').run('stolen-lease', 'retrying-job'))
      .toThrow(/invalid outbox lifecycle transition/);
    expect(() => db.prepare('UPDATE outbox SET lease_token=NULL WHERE id=?').run('retrying-job'))
      .toThrow(/invalid outbox lifecycle transition/);
    db.prepare('UPDATE outbox SET attempts=1,lease_token=? WHERE id=?').run('failed-lease', 'failed-job');
    db.prepare('UPDATE outbox SET lease_token=NULL,last_error=? WHERE id=?')
      .run('Failed to process email.send', 'failed-job');
    expect(() => db.prepare('UPDATE outbox SET attempts=0 WHERE id=?').run('failed-job'))
      .toThrow(/invalid outbox lifecycle transition/);
    db.prepare('UPDATE outbox SET attempts=1,lease_token=? WHERE id=?').run('processed-lease', 'processed-job');
    db.prepare('UPDATE outbox SET processed_at=?,lease_token=NULL,last_error=NULL WHERE id=?')
      .run(new Date().toISOString(), 'processed-job');
    expect(() => db.prepare('UPDATE outbox SET processed_at=NULL WHERE id=?').run('processed-job'))
      .toThrow(/invalid outbox lifecycle transition/);
    expect(() => db.prepare('UPDATE outbox SET attempts=0 WHERE id=?').run('processed-job'))
      .toThrow(/invalid outbox lifecycle transition/);
    expect(db.prepare('SELECT attempts,lease_token,processed_at FROM outbox ORDER BY id').all()).toEqual([
      { attempts: 1, lease_token: null, processed_at: null },
      { attempts: 0, lease_token: null, processed_at: null },
      { attempts: 1, lease_token: null, processed_at: expect.any(String) },
      { attempts: 1, lease_token: 'active-lease', processed_at: null },
    ]);
  } finally {
    db.close();
  }
});
