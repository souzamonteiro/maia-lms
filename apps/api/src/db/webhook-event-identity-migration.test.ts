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
    `).run('event-row', 'provider', 'external-event', 'a'.repeat(64), 'pending');
    expect(() => db.prepare('DELETE FROM webhook_events WHERE id=?').run('event-row'))
      .toThrow(/webhook event history is retained/);

    for (const [id, provider, eventId, hash] of [
      ['blank-provider', '  ', 'event', 'a'.repeat(64)],
      ['blank-event', 'provider', '  ', 'a'.repeat(64)],
      ['short-hash', 'provider', 'event', 'a'.repeat(63)],
      ['uppercase-hash', 'provider', 'event', 'A'.repeat(64)],
    ]) {
      expect(() => db.prepare(`
        INSERT INTO webhook_events(id,provider,external_event_id,payload_hash,status)
        VALUES(?,?,?,?,?)
      `).run(id, provider, eventId, hash, 'pending'))
        .toThrow(/webhook event payload is invalid/);
    }

    for (const [column, value] of [
      ['id', 'replacement-row'],
      ['provider', 'replacement-provider'],
      ['external_event_id', 'replacement-event'],
      ['created_at', '2026-11-02 12:00:00'],
    ]) {
      expect(() => db.prepare(`UPDATE webhook_events SET ${column}=? WHERE id=?`)
        .run(value, 'event-row')).toThrow(/webhook event identity is immutable/);
    }
    expect(() => db.prepare('UPDATE webhook_events SET payload_hash=? WHERE id=?')
      .run('not-a-sha256', 'event-row')).toThrow(/webhook event payload is invalid/);

    expect(() => db.prepare(`
      UPDATE webhook_events
      SET payload_hash=?,status='pending',processed_at=NULL
      WHERE provider=? AND external_event_id=?
    `).run('b'.repeat(64), 'provider', 'external-event')).not.toThrow();
    expect(db.prepare('SELECT id,provider,external_event_id,payload_hash,status,processed_at FROM webhook_events WHERE id=?')
      .get('event-row')).toEqual({
      id: 'event-row',
      provider: 'provider',
      external_event_id: 'external-event',
      payload_hash: 'b'.repeat(64),
      status: 'pending',
      processed_at: null,
    });
  } finally {
    db.close();
  }
});
