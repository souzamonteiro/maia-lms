import { expect, test } from './fixtures';

test('account email change is pending until the new-address confirmation page succeeds', async ({ page }) => {
  await page.route('**/api/v1/auth/change-email', async route => {
    expect(route.request().postDataJSON()).toEqual({
      email: 'new-address@example.test',
      currentPassword: 'Admin-test-password-123',
    });
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/auth/confirm-email-change', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'EMAIL_CHANGE_CONFIRMED', email: 'new-address@example.test' }),
    });
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();

  const language = page.locator('#languageSelect');
  const selectSavedLanguage = async (locale: string) => {
    const saved = page.waitForResponse(
      response =>
        response.url().endsWith('/api/v1/auth/locale') && response.request().method() === 'PUT',
    );
    await language.selectOption(locale);
    expect((await saved).status()).toBe(200);
  };
  await selectSavedLanguage('pt-BR');
  await expect(page.locator('#change-email').getByLabel('Novo endereço de e-mail')).toBeVisible();
  await selectSavedLanguage('es');
  await expect(page.locator('#change-email').getByLabel('Nueva dirección de correo')).toBeVisible();
  await selectSavedLanguage('en');

  const form = page.locator('#change-email');
  await form.getByLabel('New email address', { exact: true }).fill('new-address@example.test');
  await form.getByLabel('Confirm with your current password', { exact: true }).fill('Admin-test-password-123');
  await form.getByRole('button', { name: 'Send confirmation email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your current email stays active until you confirm it');

  await page.goto(`/auth/confirm-email-change?token=${'a'.repeat(64)}`);
  await page.getByRole('button', { name: 'Confirm email change', exact: true }).click();
  await expect(page.locator('#verification-result')).toContainText('Your account email was changed and verified');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await selectSavedLanguage('pt-BR');
  await expect(page.locator('#verification-result')).toContainText('O e-mail da conta foi alterado e verificado');
  await selectSavedLanguage('es');
  await expect(page.locator('#verification-result')).toContainText('El correo de la cuenta se cambió y verificó');
  await selectSavedLanguage('en');
});
