import Database from 'better-sqlite3';
import fs from 'node:fs';
import { NodemailerEmailProvider } from '@maia/providers';
import { pollOnce } from './jobs.js';

if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) process.loadEnvFile('.env');
const database = process.env.DATABASE_URL ?? './data/maia-lms.db';
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20)
  throw new Error('Invalid WORKER_CONCURRENCY');
const db = new Database(database, { fileMustExist: true });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
const email = new NodemailerEmailProvider(
  process.env.MAIL_TRANSPORT ?? 'smtp://localhost:1025',
  process.env.MAIL_FROM ?? 'noreply@maiaplatform.org',
);
let running = true;
process.on('SIGTERM', () => {
  running = false;
});
process.on('SIGINT', () => {
  running = false;
});
while (running) {
  try {
    await pollOnce(db, email, concurrency);
  } catch (error) {
    console.error('Worker poll failed', error instanceof Error ? error.message : 'Unknown error');
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
db.close();
