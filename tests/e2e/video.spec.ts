import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('author uploads a real video, publishes, and browser plays it', async ({ page }) => {
  test.skip(process.env.VIDEO_TEST_REAL !== '1', 'Requires FFmpeg and FFprobe on PATH');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-browser-video-'));
  try {
    const file = path.join(directory, 'lesson.mp4');
    execFileSync('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=160x90:rate=10',
      '-t',
      '3',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      file,
    ]);
    await page.goto('/auth/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('link', { name: 'Administer', exact: true }).click();
    await page.locator('[name=title]').fill('Browser video course');
    await page.locator('[name=slug]').fill('browser-video-course');
    await page.locator('[name=summary]').fill('A real video course for browser verification.');
    await page.locator('[name=accessMode]').selectOption('OPEN_FREE');
    await page.locator('.module-title').fill('Video module');
    await page.locator('.lesson-title').fill('Real video lesson');
    await page.locator('.lesson-content').fill('Video introduction');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const card = page
      .locator('#admin-list .card')
      .filter({ has: page.getByRole('heading', { name: 'Browser video course', exact: true }) });
    await card.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('.video-file').setInputFiles(file);
    await page.getByRole('button', { name: 'Upload / resume', exact: true }).click();
    await expect(page.locator('.video-status')).toHaveText('Queued for processing');
    await expect
      .poll(
        async () => {
          await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
          return page.locator('.video-choice').textContent();
        },
        { timeout: 30000 },
      )
      .toContain('Ready');
    await page.getByText('Captions', { exact: true }).click();
    await page.locator('.caption-row[data-language="en"] .caption-file').setInputFiles({
      name: 'lesson.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000\nHello captions'),
    });
    await expect(page.locator('.caption-row[data-language="en"] textarea')).toHaveValue(
      /Hello captions/,
    );
    for (const language of ['pt-BR', 'es', 'en']) {
      await page.locator('#languageSelect').selectOption(language);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('.caption-row[data-language="en"] textarea')).toHaveValue(
        /Hello captions/,
      );
    }
    await page.locator('.lesson-content').fill('');
    await expect(page.locator('#save-status')).toContainText('Draft saved');
    await card.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.locator('#message')).toBeEmpty();
    await expect(card)
      .toContainText('PUBLISHED')
      .catch(async error => {
        throw new Error(
          `${error.message}\nUI: ${await page.locator('#message').textContent()}\nSave: ${await page.locator('#save-status').textContent()}`,
        );
      });
    await card.getByRole('link', { name: 'View', exact: true }).click();
    await page.getByRole('link', { name: 'Real video lesson', exact: true }).click();
    const video = page.locator('video');
    await expect(video).toBeVisible();
    await expect(page.locator('track[srclang="en"]')).toHaveCount(1);
    await video.evaluate((v: HTMLVideoElement) => {
      v.textTracks[0].mode = 'showing';
    });
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0].cues?.length))
      .toBe(1);
    await page.getByText('Transcript — English', { exact: true }).click();
    await expect(
      page.locator('.plain-content').filter({ hasText: 'Hello captions' }),
    ).toBeVisible();
    await video.evaluate((v: HTMLVideoElement) => v.play());
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/video-lesson.png', fullPage: true });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('author attaches PDF, ZIP and source with descriptions and downloads the published material', async ({
  page,
}) => {
  test.skip(process.env.VIDEO_TEST_REAL !== '1', 'Requires the media worker in the test server');
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Administer', exact: true }).click();
  await page.locator('[name=title]').fill('Course materials');
  await page.locator('[name=slug]').fill('course-materials');
  await page.locator('[name=summary]').fill('Download the examples and course guide.');
  await page.locator('[name=accessMode]').selectOption('OPEN_FREE');
  await page.locator('.module-title').fill('Examples');
  await page.locator('.lesson-title').fill('Exercise');
  await page.locator('.lesson-content').fill('Use the supplied source code.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const card = page
    .locator('#admin-list .card')
    .filter({ has: page.getByRole('heading', { name: 'Course materials', exact: true }) });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const materials = page.locator('#course-attachments');
  const zip = Buffer.alloc(22);
  zip.writeUInt32LE(0x06054b50);
  for (const [name, bytes] of [
    ['guide.pdf', Buffer.from('%PDF-1.7\n%%EOF')],
    ['sources.zip', zip],
    ['example.py', Buffer.from('print("hello")')],
  ] as [string, Buffer][]) {
    await materials.getByRole('button', { name: 'Add material', exact: true }).click();
    const row = materials.locator('.attachment-row').last();
    await row.locator('.attachment-title').fill(name);
    await row.locator('.attachment-description').fill(`Description of ${name}`);
    await row
      .locator('.video-file')
      .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: bytes });
    await row.getByRole('button', { name: 'Upload / resume file', exact: true }).click();
    await expect(row.locator('.video-status')).toHaveText('Queued for processing');
    await expect
      .poll(
        async () => {
          await row.getByRole('button', { name: 'Refresh status', exact: true }).click();
          return row.locator('.video-choice option:checked').textContent();
        },
        { timeout: 15000 },
      )
      .toContain('Ready');
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#save-status')).toContainText('Draft saved');
  await card.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(card).toContainText('PUBLISHED');
  await card.getByRole('link', { name: 'View', exact: true }).click();
  await expect(page.locator('.attachments')).toContainText('Description of sources.zip');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'example.py', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('example.py');
  expect(fs.readFileSync((await file.path())!, 'utf8')).toBe('print("hello")');
});
