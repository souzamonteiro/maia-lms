import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps webhook event identity immutable while allowing retry metadata updates', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.prepare(`
      INSERT INTO webhook_events(id,provider,external_event_id,payload_hash,status)
      VALUES(?,?,?,?,?)
    `).run('event-row', 'provider', 'external-event', 'original-hash', 'pending');

    for (const [column, value] of [
      ['id', 'replacement-row'],
      ['provider', 'replacement-provider'],
      ['external_event_id', 'replacement-event'],
      ['created_at', '2026-11-02 12:00:00'],
    ]) {
      expect(() => db.prepare(`UPDATE webhook_events SET ${column}=? WHERE id=?`)
        .run(value, 'event-row')).toThrow(/webhook event identity is immutable/);
    }

    expect(() => db.prepare(`
      UPDATE webhook_events
      SET payload_hash=?,status='pending',processed_at=NULL
      WHERE provider=? AND external_event_id=?
    `).run('retry-hash', 'provider', 'external-event')).not.toThrow();
    expect(db.prepare('SELECT id,provider,external_event_id,payload_hash,status,processed_at FROM webhook_events WHERE id=?')
      .get('event-row')).toEqual({
      id: 'event-row',
      provider: 'provider',
      external_event_id: 'external-event',
      payload_hash: 'retry-hash',
      status: 'pending',
      processed_at: null,
    });
  } finally {
    db.close();
  }
});
