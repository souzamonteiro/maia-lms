import { attachmentScanMode } from './attachment-scan.js';
import { cleanupUploads } from './upload-cleanup.js';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import { NodemailerEmailProvider } from '@maia/providers';
import { processVideo } from './video-jobs.js';
import { pollOnce } from './jobs.js';
import { processCertificatePdf } from './certificate-pdf.js';
import { publishDueCourses } from '@maia/api/scheduled-publication';
import { loadConfig } from '@maia/api/config';
import { createPaymentProvider } from '@maia/api/payment-provider';
import { reconcilePendingPayments } from '@maia/api/payment-reconciliation';
import { fillMediaCapacity as fillMediaPoolCapacity } from './media-scheduler.js';

if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) process.loadEnvFile('.env');
const config = loadConfig();
const paymentProvider = createPaymentProvider(config);
attachmentScanMode();
const database = process.env.DATABASE_URL ?? './data/maia-lms.db';
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20)
  throw new Error('Invalid WORKER_CONCURRENCY');
const mediaConcurrency = Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 1);
if (!Number.isInteger(mediaConcurrency) || mediaConcurrency < 1 || mediaConcurrency > 4)
  throw new Error('Invalid MEDIA_WORKER_CONCURRENCY');
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
const mediaJobs = new Set<Promise<boolean>>();
function fillMediaCapacity() {
  if (running)
    fillMediaPoolCapacity(mediaJobs, mediaConcurrency, () =>
      processVideo(db, process.env.STORAGE_ROOT ?? './data/storage')
      .catch(error => {
        console.error('Video worker failed', error instanceof Error ? error.message : 'Unknown error');
        return false;
      }),
    );
}
let nextCleanup = 0;
let nextReconciliation = 0;
let paymentJob: Promise<unknown> | undefined;
while (running) {
  if (Date.now() >= nextCleanup) {
    nextCleanup = Date.now() + 60 * 60 * 1000;
    try {
      await cleanupUploads(db, process.env.STORAGE_ROOT ?? './data/storage');
    } catch (error) {
      console.error(
        'Upload cleanup failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
  fillMediaCapacity();
  if (
    config.PAYMENTS_CHECKOUT_ENABLED &&
    paymentProvider.name === 'mercado_pago' &&
    !paymentJob &&
    Date.now() >= nextReconciliation
  ) {
    nextReconciliation = Date.now() + 60_000;
    paymentJob = reconcilePendingPayments(db, paymentProvider, config.MP_SELLER_ID)
      .then(result => {
        if (result.failed) console.error('Payment reconciliation needs review', result.failed);
      })
      .catch(error => console.error('Payment reconciliation failed', error instanceof Error ? error.message : 'Unknown error'))
      .finally(() => {
        paymentJob = undefined;
      });
  }
  try {
    const scheduled = publishDueCourses(
      db,
      process.env.PUBLIC_BASE_URL ?? 'https://learn.maiaplatform.org',
    );
    if (scheduled.failed)
      console.error('Scheduled course publication needs review', scheduled.failed);
    await pollOnce(db, email, concurrency, {
      'certificate.generate': (payload, attempt) =>
        processCertificatePdf(
          db,
          process.env.STORAGE_ROOT ?? './data/storage',
          process.env.PUBLIC_BASE_URL ?? 'https://learn.maiaplatform.org',
          payload,
          attempt,
        ),
    });
  } catch (error) {
    console.error('Worker poll failed', error instanceof Error ? error.message : 'Unknown error');
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
await Promise.all(mediaJobs);
await paymentJob;
db.close();
