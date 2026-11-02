import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps webhook event status and processed timestamp consistent', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const insertEvent = db.prepare(`
      INSERT INTO webhook_events(id,provider,external_event_id,payload_hash,status,processed_at)
      VALUES(?,?,?,?,?,?)
    `);

    expect(() => insertEvent.run('pending', 'provider', 'event-pending', 'hash', 'pending', null))
      .not.toThrow();
    expect(() => insertEvent.run('processed', 'provider', 'event-processed', 'hash', 'processed', '2026-11-02 12:00:00'))
      .not.toThrow();
    expect(() => insertEvent.run('failed', 'provider', 'event-failed', 'hash', 'failed', '2026-11-02 12:00:00'))
      .not.toThrow();

    expect(() => insertEvent.run('pending-time', 'provider', 'event-pending-time', 'hash', 'pending', '2026-11-02 12:00:00'))
      .toThrow(/invalid webhook event lifecycle/);
    expect(() => insertEvent.run('processed-null', 'provider', 'event-processed-null', 'hash', 'processed', null))
      .toThrow(/invalid webhook event lifecycle/);
    expect(() => insertEvent.run('failed-malformed', 'provider', 'event-failed-malformed', 'hash', 'failed', 'not-a-time'))
      .toThrow(/invalid webhook event lifecycle/);

    db.prepare('UPDATE webhook_events SET status=?,processed_at=? WHERE id=?')
      .run('processed', '2026-11-02 12:01:00', 'pending');
    db.prepare('UPDATE webhook_events SET status=?,processed_at=? WHERE id=?')
      .run('pending', null, 'failed');
    expect(() => db.prepare('UPDATE webhook_events SET status=? WHERE id=?')
      .run('failed', 'failed')).toThrow(/invalid webhook event lifecycle/);
    expect(db.prepare('SELECT status,processed_at FROM webhook_events WHERE id=?').get('failed'))
      .toEqual({ status: 'pending', processed_at: null });
  } finally {
    db.close();
  }
});
