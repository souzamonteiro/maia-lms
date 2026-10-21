import { test, expect } from './fixtures';

test('catalog and operations dashboard fit a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Operations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
