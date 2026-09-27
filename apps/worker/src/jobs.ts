import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { EmailProvider } from '@maia/providers';
import { z } from 'zod';
const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string(),
});
export async function pollOnce(
  db: Database.Database,
  email: EmailProvider,
  concurrency = 4,
): Promise<number> {
  const lease = randomUUID();
  const rows = db
    .transaction(() => {
      const jobs = db
        .prepare(
          `SELECT id, event_type, payload, attempts FROM outbox WHERE processed_at IS NULL AND julianday(available_at) <= julianday('now') AND attempts < 5 ORDER BY available_at LIMIT ?`,
        )
        .all(concurrency) as {
        id: string;
        event_type: string;
        payload: string;
        attempts: number;
      }[];
      for (const job of jobs)
        db.prepare(
          `UPDATE outbox SET attempts = attempts + 1, lease_token = ?, available_at = datetime('now', '+5 minutes') WHERE id = ?`,
        ).run(lease, job.id);
      return jobs;
    })
    .immediate();
  await Promise.all(
    rows.map(async row => {
      try {
        if (row.event_type !== 'email.send')
          throw new Error(`Unsupported event: ${row.event_type}`);
        await email.send(emailSchema.parse(JSON.parse(row.payload)));
        db.prepare(
          `UPDATE outbox SET processed_at = datetime('now'), lease_token = NULL, last_error = NULL WHERE id = ? AND lease_token = ?`,
        ).run(row.id, lease);
      } catch {
        db.prepare(
          `UPDATE outbox SET last_error = ?, lease_token = NULL, available_at = datetime('now', '+' || ? || ' minutes') WHERE id = ? AND lease_token = ?`,
        ).run(`Failed to process ${row.event_type}`, 2 ** row.attempts, row.id, lease);
      }
    }),
  );
  return rows.length;
}
