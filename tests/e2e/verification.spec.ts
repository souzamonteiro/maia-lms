import { test, expect } from './fixtures';

test('verification requires confirmation and preserves translated success across language changes', async ({
  page,
}) => {
  let confirmations = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/v1/auth/verify-email')) confirmations++;
  });
  for (const [locale, digit, success] of [
    ['en', '1', 'Your email is verified.'],
    ['pt-BR', '2', 'Seu e-mail foi confirmado.'],
    ['es', '3', 'Tu correo está verificado.'],
  ]) {
    const before = confirmations;
    await page.goto(`/auth/verify-email?lang=${locale}&token=${digit.repeat(64)}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#verify-email')).toBeEnabled();
    expect(confirmations).toBe(before);
    await page.locator('#verify-email').click();
    await expect(page.locator('#verification-result')).toContainText(success);
    await expect(page.locator('#verify-email')).toHaveCount(0);
    await page.locator('#languageSelect').selectOption('en');
    await expect(page.locator('#verification-result')).toContainText('Your email is verified.');
    expect(confirmations).toBe(before + 1);
  }
});

test('verification explains expired, used and invalid links without exposing tokens', async ({
  page,
}) => {
  for (const [token, message] of [
    ['4'.repeat(64), 'This link has expired.'],
    ['5'.repeat(64), 'This link has already been used.'],
    ['invalid-token', 'This link is invalid'],
  ]) {
    await page.goto(`/auth/verify-email?lang=en&token=${token}`);
    if (token.length === 64) await page.locator('#verify-email').click();
    await expect(page.locator('#verification-result')).toContainText(message);
    await expect(page.locator('#app')).not.toContainText(token);
    await expect(
      page.locator('#app').getByRole('link', { name: 'Sign in', exact: true }),
    ).toBeVisible();
  }
});
