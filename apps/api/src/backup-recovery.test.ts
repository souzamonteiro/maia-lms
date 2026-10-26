import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';
import { processVideo } from '../../worker/src/video-jobs.js';
import { processCertificatePdf } from '../../worker/src/certificate-pdf.js';

it.runIf(process.env.VIDEO_TEST_REAL === '1')(
  'restores published revisions, real media, progress and certificate HTTP delivery without original data',
  async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-recovery-http-'));
    const databaseFile = path.join(directory, 'source.sqlite');
    const storage = path.join(directory, 'storage');
    const bundle = path.join(directory, 'bundle');
    const recovery = path.join(directory, 'recovery');
    let db = new Database(databaseFile);
    let server: Server | undefined;
    let base = '';
    const password = 'Recovery-test-password-123';
    const config = { ...loadConfig(), STORAGE_ROOT: storage, DATABASE_URL: databaseFile };

    async function start() {
      server = createApp(db, config).listen(0, '127.0.0.1');
      await once(server, 'listening');
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }
    async function stop() {
      const running = server;
      if (!running) return;
      running.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        running.close(error => error ? reject(error) : resolve()),
      );
      server = undefined;
    }
    async function request(url: string, method = 'GET', body?: unknown, cookie = '') {
      return fetch(`${base}/api/v1${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        ...(!['GET', 'HEAD'].includes(method) ? { body: JSON.stringify(body ?? {}) } : {}),
      });
    }
    async function login(email: string) {
      const response = await request('/auth/login', 'POST', { email, password });
      expect(response.status).toBe(200);
      return response.headers.get('set-cookie')!.split(';')[0];
    }
    async function account(email: string, role = 'learner') {
      const response = await request('/auth/register', 'POST', { email, password, locale: 'en' });
      expect(response.status).toBe(201);
      const user = await response.json();
      db.prepare("UPDATE users SET role=?,verified_at=datetime('now') WHERE id=?").run(role, user.id);
      return login(email);
    }
    function lastEmailToken() {
      const mail = db.prepare("SELECT payload FROM outbox WHERE event_type='email.send' ORDER BY rowid DESC LIMIT 1")
        .get() as { payload: string };
      const token = (JSON.parse(mail.payload).text as string).match(/token=([a-f0-9]{64})/)?.[1];
      expect(token).toBeDefined();
      return token!;
    }
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      runMigrations(db);
      await start();
      const admin = await account('admin@recovery.test', 'admin');
      const learner = await account('learner@recovery.test');
      const oldVerificationToken = lastEmailToken();
      const courseDraft = {
        slug: 'recovery-course',
        title: 'Recovery course',
        summary: 'Fictional course for an isolated restoration rehearsal.',
        accessMode: 'ENROLLED_FREE',
        durationMinutes: 30,
        instructorName: 'Test Academy',
        modules: [{ title: 'Module', lessons: [{ title: 'Watch', body: 'Initial draft', required: true }] }],
      };
      const created = await request('/admin/courses', 'POST', courseDraft, admin);
      expect(created.status).toBe(201);
      const course = await created.json();
      const sample = path.join(directory, 'sample.mp4');
      execFileSync('ffmpeg', [
        '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10',
        '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', sample,
      ]);
      const bytes = fs.readFileSync(sample);
      const uploaded = await request('/admin/videos', 'POST', {
        courseId: course.id, filename: 'sample.mp4', size: bytes.length,
      }, admin);
      expect(uploaded.status).toBe(201);
      const video = await uploaded.json();
      expect((await fetch(`${base}/api/v1/admin/videos/${video.id}/chunks`, {
        method: 'PUT',
        headers: { Cookie: admin, 'Content-Type': 'application/octet-stream', 'Upload-Offset': '0' },
        body: bytes,
      })).status).toBe(200);
      expect((await request(`/admin/videos/${video.id}/complete`, 'POST', {}, admin)).status).toBe(200);
      expect(await processVideo(db, storage)).toBe(true);
      const videoDraft = {
        ...courseDraft,
        modules: [{ title: 'Module', lessons: [{
          title: 'Watch', body: '', videoId: video.id, required: true,
          captions: [{ language: 'en', label: 'English', vtt: 'WEBVTT\n\n00:00.000 --> 00:02.000\nOriginal captions' }],
        }] }],
      };
      expect((await request(`/admin/courses/${course.id}`, 'PUT', {
        ...videoDraft, expectedRevisionId: course.current_revision_id,
      }, admin)).status).toBe(200);
      expect((await request(`/admin/courses/${course.id}/publish`, 'POST', {}, admin)).status).toBe(200);
      const original = await (await request(`/courses/${course.id}`)).json();
      const lessonId = original.modules[0].lessons[0].id;
      const enrolled = await request(`/courses/${course.id}/enroll`, 'POST', {}, learner);
      expect(enrolled.status).toBe(200);
      const enrollment = await enrolled.json();
      const originalVideo = await request(`/lessons/${lessonId}/video`, 'GET', undefined, learner);
      expect(originalVideo.status).toBe(200);
      const originalVideoBytes = Buffer.from(await originalVideo.arrayBuffer());
      expect((await request(`/lessons/${lessonId}/progress`, 'PUT', {
        positionSeconds: 1, complete: true,
      }, learner)).status).toBe(200);
      const consent = { enrollmentId: enrollment.id, confirmedName: 'Test Learner', disclosureConsent: true };
      const eligibility = await (await request('/me/certificates/eligibility', 'POST', consent, learner)).json();
      expect(eligibility.eligible).toBe(true);
      const issued = await request('/me/certificates', 'POST', {
        ...consent, acceptedDisclosureHash: eligibility.disclosureHash,
      }, learner);
      expect(issued.status).toBe(201);
      const { certificate } = await issued.json();
      await processCertificatePdf(db, storage, config.PUBLIC_BASE_URL, { certificateId: certificate.id }, 1);
      const originalPdf = Buffer.from(await (await request(`/me/certificates/${certificate.id}/pdf`, 'GET', undefined, learner)).arrayBuffer());
      expect(originalPdf.subarray(0, 5).toString()).toBe('%PDF-');

      const current = await (await request(`/admin/courses/${course.id}`, 'GET', undefined, admin)).json();
      expect((await request(`/admin/courses/${course.id}`, 'PUT', {
        ...courseDraft, title: 'New published title', expectedRevisionId: current.current_revision_id,
      }, admin)).status).toBe(200);
      expect((await request(`/admin/courses/${course.id}/publish`, 'POST', {}, admin)).status).toBe(200);
      expect((await request('/auth/forgot-password', 'POST', { email: 'learner@recovery.test' })).status).toBe(204);
      const oldResetToken = lastEmailToken();
      expect((await request('/auth/change-email', 'POST', {
        email: 'changed@recovery.test', currentPassword: password,
      }, learner)).status).toBe(204);
      const oldEmailChangeToken = lastEmailToken();
      await stop();
      db.close();
      execFileSync(process.execPath, [path.resolve('scripts/backup-bundle.mjs'), bundle], {
        env: { ...process.env, DATABASE_URL: databaseFile, STORAGE_ROOT: storage }, stdio: 'pipe',
      });
      fs.renameSync(storage, path.join(directory, 'offline-storage'));
      fs.renameSync(databaseFile, path.join(directory, 'offline.sqlite'));
      execFileSync(process.execPath, [path.resolve('scripts/restore-bundle.mjs'), bundle, recovery], { stdio: 'pipe' });
      db = new Database(path.join(recovery, 'database.sqlite'));
      db.pragma('foreign_keys = ON');
      expect(() => runMigrations(db)).not.toThrow();
      config.STORAGE_ROOT = path.join(recovery, 'storage');
      config.DATABASE_URL = path.join(recovery, 'database.sqlite');
      await start();
      expect((await fetch(`${base}/readyz`)).status).toBe(200);
      expect((await request('/auth/privacy/export', 'GET', undefined, learner)).status).toBe(401);
      expect((await request('/admin/courses', 'GET', undefined, admin)).status).toBe(401);
      expect((await request('/auth/verify-email', 'POST', { token: oldVerificationToken })).status).toBe(400);
      expect((await request('/auth/reset-password', 'POST', { token: oldResetToken, password })).status).toBe(400);
      expect((await request('/auth/confirm-email-change', 'POST', { token: oldEmailChangeToken })).status).toBe(400);
      expect((await request('/auth/forgot-password', 'POST', { email: 'learner@recovery.test' })).status).toBe(204);
      expect((await request('/auth/reset-password', 'POST', { token: lastEmailToken(), password })).status).toBe(200);
      const restoredLearner = await login('learner@recovery.test');
      const outsider = await account('outsider@recovery.test');
      expect((await (await request(`/courses/${course.id}`)).json()).title).toBe('New published title');
      const restoredLesson = await (await request(`/lessons/${lessonId}`, 'GET', undefined, restoredLearner)).json();
      expect(restoredLesson.revision_id).toBe(enrollment.revision_id);
      expect(restoredLesson.can_track_progress).toBe(true);
      expect(restoredLesson.progress).toMatchObject({ position_seconds: 1 });
      expect(restoredLesson.progress.completed_at).toBeTruthy();
      expect(restoredLesson.captions[0].transcript).toContain('Original captions');
      expect((await request(`/lessons/${lessonId}/video`)).status).toBe(403);
      expect((await request(`/lessons/${lessonId}/video`, 'GET', undefined, outsider)).status).toBe(403);
      expect((await request(`/lessons/${lessonId}/hls/master.m3u8`, 'GET', undefined, outsider)).status).toBe(403);
      const restoredCaptions = await request(`/lessons/${lessonId}/captions/en`, 'GET', undefined, restoredLearner);
      expect(restoredCaptions.status).toBe(200);
      expect(await restoredCaptions.text()).toContain('Original captions');
      const poster = await request(`/lessons/${lessonId}/poster`, 'GET', undefined, restoredLearner);
      expect(poster.status).toBe(200);
      expect((await poster.arrayBuffer()).byteLength).toBeGreaterThan(0);
      const restoredVideo = await fetch(`${base}/api/v1/lessons/${lessonId}/video`, {
        headers: { Cookie: restoredLearner, Range: 'bytes=0-31' },
      });
      expect(restoredVideo.status).toBe(206);
      expect(Buffer.from(await restoredVideo.arrayBuffer())).toEqual(originalVideoBytes.subarray(0, 32));
      const fullVideo = await request(`/lessons/${lessonId}/video`, 'GET', undefined, restoredLearner);
      expect(fullVideo.status).toBe(200);
      expect(Buffer.from(await fullVideo.arrayBuffer())).toEqual(originalVideoBytes);
      const masterUrl = `${base}/api/v1/lessons/${lessonId}/hls/master.m3u8`;
      const master = await fetch(masterUrl, { headers: { Cookie: restoredLearner } });
      expect(master.status).toBe(200);
      const variantPath = (await master.text()).split(/\r?\n/).find(line => line.endsWith('.m3u8'));
      expect(variantPath).toBeTruthy();
      const variantUrl = new URL(variantPath!, masterUrl);
      const variant = await fetch(variantUrl, { headers: { Cookie: restoredLearner } });
      expect(variant.status).toBe(200);
      const segmentPath = (await variant.text()).split(/\r?\n/).find(line => line.endsWith('.ts'));
      expect(segmentPath).toBeTruthy();
      const segment = await fetch(new URL(segmentPath!, variantUrl), { headers: { Cookie: restoredLearner } });
      expect(segment.status).toBe(200);
      expect((await segment.arrayBuffer()).byteLength).toBeGreaterThan(0);
      const verification = await request(`/certificates/verify/${certificate.publicCode}`);
      expect(verification.status).toBe(200);
      expect(await verification.json()).toMatchObject({
        status: 'valid', learnerName: 'Test Learner', courseTitle: 'Recovery course',
      });
      const pdf = await request(`/me/certificates/${certificate.id}/pdf`, 'GET', undefined, restoredLearner);
      expect(pdf.status).toBe(200);
      expect(Buffer.from(await pdf.arrayBuffer())).toEqual(originalPdf);
      expect((await request(`/me/certificates/${certificate.id}/pdf`, 'GET', undefined, outsider)).status).toBe(404);
      const repeatedIssue = await request('/me/certificates', 'POST', {
        ...consent, acceptedDisclosureHash: eligibility.disclosureHash,
      }, restoredLearner);
      expect(repeatedIssue.status).toBe(200);
      expect((await repeatedIssue.json()).certificate.id).toBe(certificate.id);
      expect((await request(`/lessons/${lessonId}/progress`, 'PUT', { positionSeconds: 2 }, restoredLearner)).status).toBe(200);
      expect((await (await request(`/lessons/${lessonId}`, 'GET', undefined, restoredLearner)).json()).progress.position_seconds).toBe(2);
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally {
      await stop();
      if (db.open) db.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
  30000,
);
