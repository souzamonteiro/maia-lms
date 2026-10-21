import { test, expect } from './fixtures';

test('administrator inspects operational status and refreshes the summary', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Operations', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
  for (const heading of [
    'Workers',
    'Media jobs',
    'Message queue',
    'Payments by state',
    'Storage',
    'Alerts',
    'Playback',
  ]) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText('0 playback requests in the last 7 days')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.locator('#ops-updated')).toContainText('Updated');
});