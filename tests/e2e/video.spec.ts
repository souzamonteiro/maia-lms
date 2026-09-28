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
    await video.evaluate((v: HTMLVideoElement) => v.play());
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/video-lesson.png', fullPage: true });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
