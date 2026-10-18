import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../api/src/db/migrate.js';
import { pollOnce } from './jobs.js';
import { fillMediaCapacity } from './media-scheduler.js';

it('keeps media concurrency independent while the email outbox continues processing', async () => {
  const db = new Database(':memory:');
  runMigrations(db);
  const jobs = new Set<Promise<boolean>>();
  const releases: Array<(value: boolean) => void> = [];
  try {
    db.prepare("INSERT INTO outbox(id,event_type,payload) VALUES('email','email.send',?)").run(
      JSON.stringify({ to: 'learner@example.com', subject: 'Update', text: 'Published' }),
    );
    fillMediaCapacity(jobs, 2, () => new Promise<boolean>(resolve => releases.push(resolve)));
    fillMediaCapacity(jobs, 2, () => Promise.resolve(true));
    expect(jobs.size).toBe(2);
    expect(releases).toHaveLength(2);

    let emailSent = false;
    expect(await pollOnce(db, {
      send: async () => {
        emailSent = true;
      },
    }, 1)).toBe(1);
    expect(emailSent).toBe(true);
    expect(jobs.size).toBe(2);
  } finally {
    releases.forEach(release => release(true));
    await Promise.all(jobs);
    db.close();
  }
});