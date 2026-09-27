import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../api/src/db/migrate.js';
import { pollOnce } from './jobs.js';

describe('outbox worker', () => {
  it('does not claim leased jobs twice, retries failures, and keeps unsupported jobs unprocessed', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    try {
      db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES ('mail','email.send',?)").run(
        JSON.stringify({ to: 'user@example.com', subject: 'Test', text: 'Hello' }),
      );
      let finish!: () => void;
      const sending = pollOnce(db, {
        send: () =>
          new Promise<void>(resolve => {
            finish = resolve;
          }),
      });
      expect(
        await pollOnce(db, {
          send: async () => {
            throw new Error('Must not send twice');
          },
        }),
      ).toBe(0);
      finish();
      await sending;
      expect(db.prepare("SELECT processed_at FROM outbox WHERE id='mail'").get()).not.toEqual({
        processed_at: null,
      });
      db.exec("INSERT INTO outbox(id,event_type) VALUES ('unknown','asset.transcode')");
      await pollOnce(db, { send: async () => {} });
      expect(
        db.prepare("SELECT attempts,processed_at,last_error FROM outbox WHERE id='unknown'").get(),
      ).toEqual({
        attempts: 1,
        processed_at: null,
        last_error: 'Failed to process asset.transcode',
      });
      db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES ('retry','email.send',?)").run(
        JSON.stringify({ to: 'user@example.com', subject: 'Test', text: 'Hello' }),
      );
      await pollOnce(db, {
        send: async () => {
          throw new Error('SMTP failed');
        },
      });
      db.exec("UPDATE outbox SET available_at=datetime('now','-1 minute') WHERE id='retry'");
      expect(await pollOnce(db, { send: async () => {} })).toBe(1);
      expect(db.prepare("SELECT attempts,last_error FROM outbox WHERE id='retry'").get()).toEqual({
        attempts: 2,
        last_error: null,
      });
    } finally {
      db.close();
    }
  });
});
