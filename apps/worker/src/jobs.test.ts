import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../api/src/db/migrate.js';
import { pollOnce } from './jobs.js';

describe('outbox worker', () => {
  it('measures transport outcomes and retries without recording payloads or counting invalid jobs', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    try {
      db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES('measured','email.send',?)")
        .run(JSON.stringify({ to: 'private@example.com', subject: 'Secret subject', text: 'token=secret' }));
      const clock = vi.spyOn(performance, 'now');
      try {
        clock.mockReturnValueOnce(100).mockReturnValueOnce(140);
        await pollOnce(db, { send: async () => { throw new Error('SMTP password=secret'); } });
        db.exec("UPDATE outbox SET available_at=datetime('now','-1 minute') WHERE id='measured'");
        clock.mockReturnValueOnce(200).mockReturnValueOnce(260);
        await pollOnce(db, { send: async () => {} });
        db.prepare("INSERT INTO outbox(id,event_type,payload) SELECT 'second',event_type,payload FROM outbox WHERE id='measured'").run();
        clock.mockReturnValueOnce(300).mockReturnValueOnce(320);
        await pollOnce(db, { send: async () => {} });
      } finally {
        clock.mockRestore();
      }
      db.exec(`INSERT INTO outbox(id,event_type,payload) VALUES
        ('invalid','email.send','{}'),('unsupported','unknown','{}');`);
      const send = vi.fn(async () => {});
      await pollOnce(db, { send });
      expect(send).not.toHaveBeenCalled();
      const rows = db.prepare('SELECT * FROM email_transport_metrics_daily ORDER BY outcome').all();
      expect(rows).toEqual([
        { metric_date: new Date().toISOString().slice(0, 10), outcome: 'accepted', attempt_count: 2, duration_total_ms: 80 },
        { metric_date: new Date().toISOString().slice(0, 10), outcome: 'failed', attempt_count: 1, duration_total_ms: 40 },
      ]);
      expect(JSON.stringify(rows)).not.toMatch(/private|secret|SMTP|token/);
      expect(db.prepare("SELECT attempts,processed_at FROM outbox WHERE id='measured'").get())
        .toEqual({ attempts: 2, processed_at: expect.any(String) });
      for (const [date, outcome, attempts, duration] of [
        ['2026-02-30', 'accepted', 1, 0],
        ['invalid', 'accepted', 1, 0],
        ['2026-01-01', 'delivered', 1, 0],
        ['2026-01-01', 'accepted', 0, 0],
        ['2026-01-01', 'accepted', 1.5, 0],
        ['2026-01-01', 'accepted', 1, -1],
        ['2026-01-01', 'accepted', 1, 0.5],
      ]) {
        expect(() => db.prepare('INSERT INTO email_transport_metrics_daily VALUES(?,?,?,?)')
          .run(date, outcome, attempts, duration)).toThrow();
      }
    } finally {
      db.close();
    }
  });

  it('does not retry accepted mail when metrics persistence fails and logs no sensitive errors', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES('mail','email.send',?)")
        .run(JSON.stringify({ to: 'private@example.com', subject: 'Private', text: 'Secret' }));
      db.exec(`CREATE TRIGGER reject_email_metrics BEFORE INSERT ON email_transport_metrics_daily
        BEGIN SELECT RAISE(ABORT,'Sensitive database error'); END;`);
      const send = vi.fn(async () => {});
      await pollOnce(db, { send });
      expect(await pollOnce(db, { send })).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledExactlyOnceWith('Email transport metrics write failed');
      expect(db.prepare("SELECT processed_at,last_error FROM outbox WHERE id='mail'").get())
        .toEqual({ processed_at: expect.any(String), last_error: null });
    } finally {
      log.mockRestore();
      db.close();
    }
  });

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

  it('dispatches certificate generation jobs and retries them without acknowledging failed work', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    try {
      db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES('certificate-job','certificate.generate',?)")
        .run(JSON.stringify({ certificateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
      let calls = 0;
      const handlers = {
        'certificate.generate': async (payload: unknown, attempt: number) => {
          calls++;
          expect(payload).toEqual({ certificateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
          expect(attempt).toBe(calls);
          if (calls === 1) throw new Error('Temporary PDF failure');
        },
      };
      const email = { send: async () => {} };

      expect(await pollOnce(db, email, 1, handlers)).toBe(1);
      expect(db.prepare("SELECT processed_at,last_error,attempts FROM outbox WHERE id='certificate-job'").get()).toMatchObject({
        processed_at: null,
        last_error: 'Failed to process certificate.generate',
        attempts: 1,
      });
      db.exec("UPDATE outbox SET available_at=datetime('now','-1 minute') WHERE id='certificate-job'");
      expect(await pollOnce(db, email, 1, handlers)).toBe(1);
      expect(db.prepare("SELECT processed_at,last_error,attempts FROM outbox WHERE id='certificate-job'").get()).toMatchObject({
        processed_at: expect.any(String),
        last_error: null,
        attempts: 2,
      });
    } finally {
      db.close();
    }
  });
});
