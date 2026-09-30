import { test, expect } from './fixtures';

test('account forms retain input and submit the selected language with translated errors', async ({
  page,
}) => {
  for (const [locale, success, error] of [
    ['en', 'Account created', 'Invalid email or password.'],
    ['pt-BR', 'Conta criada', 'E-mail ou senha inválidos.'],
    ['es', 'Cuenta creada', 'Correo electrónico o contraseña incorrectos.'],
  ]) {
    await page.goto('/auth/register');
    const email = `locale-${locale}@example.com`;
    const password = 'Language-test-password-123';
    await page.locator('#auth [name=email]').fill(email);
    await page.locator('#auth [name=password]').fill(password);
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#auth [name=email]')).toHaveValue(email);
    await expect(page.locator('#auth [name=password]')).toHaveValue(password);
    const sent = page.waitForRequest(
      request => request.url().endsWith('/api/v1/auth/register') && request.method() === 'POST',
    );
    await page.locator('#auth button[type=submit]').click();
    expect((await sent).postDataJSON().locale).toBe(locale);
    await expect(page.getByRole('status')).toContainText(success);
    expect(
      await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)),
    ).not.toContain(password);
    await page.goto('/auth/login');
    await page.locator('#auth [name=email]').fill(email);
    await page.locator('#auth [name=password]').fill('Incorrect-password-123');
    await page.locator('#auth button[type=submit]').click();
    await expect(page.getByRole('status')).toHaveText(error);
  }
});
