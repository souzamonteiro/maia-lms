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
  await expect(page.locator('#ops-playback')).toContainText('Not measured');
  expect((await page.request.get('/api/v1/lessons/missing-duration-test/video')).status()).toBe(404);
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.locator('#ops-updated')).toContainText('Updated');
  await expect(page.getByText('1 playback requests in the last 7 days')).toBeVisible();
  for (const [locale, measuredLabel, durationLabel] of [
    ['en', 'Responses with duration measured', 'Average response completion time'],
    ['pt-BR', 'Respostas com duração medida', 'Tempo médio até concluir a resposta'],
    ['es', 'Respuestas con duración medida', 'Tiempo medio hasta completar la respuesta'],
  ]) {
    await page.locator('#languageSelect').selectOption(locale);
    const measured = page.locator('#ops-playback > div').filter({ has: page.getByText(measuredLabel, { exact: true }) });
    await expect(measured.locator('dd')).toHaveText('1');
    const duration = page.locator('#ops-playback > div').filter({ hasText: durationLabel });
    await expect(duration.locator('dd')).toHaveText(/^[\d.,]+ ms$/);
  }
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
});