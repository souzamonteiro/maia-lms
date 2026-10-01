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

test('signed-in interface language follows the account into an isolated browser context', async ({
  page,
  browser,
}) => {
  const email = 'saved-locale@example.com';
  const password = 'Saved-locale-password-123';
  await page.goto('/auth/register');
  await page.locator('#languageSelect').selectOption('en');
  await page.locator('#auth [name=email]').fill(email);
  await page.locator('#auth [name=password]').fill(password);
  await page.locator('#auth button[type=submit]').click();
  await expect(page.getByRole('status')).toContainText('Account created');

  await page.goto('/auth/login');
  await page.locator('#auth [name=email]').fill(email);
  await page.locator('#auth [name=password]').fill(password);
  await page.locator('#auth button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
  for (const [locale, title] of [
    ['pt-BR', 'Meu aprendizado'],
    ['es', 'Mi aprendizaje'],
  ]) {
    const saved = page.waitForResponse(
      response =>
        response.url().endsWith('/api/v1/auth/locale') && response.request().method() === 'PUT',
    );
    await page.locator('#languageSelect').selectOption(locale);
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  }

  const freshContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    locale: 'en-US',
    extraHTTPHeaders: { 'X-Forwarded-For': '10.251.1.25' },
  });
  try {
    const freshPage = await freshContext.newPage();
    await freshPage.goto('/auth/login');
    await expect(freshPage.locator('html')).toHaveAttribute('lang', 'en');
    await freshPage.locator('#auth [name=email]').fill(email);
    await freshPage.locator('#auth [name=password]').fill(password);
    await freshPage.locator('#auth button[type=submit]').click();
    await expect(freshPage.getByRole('heading', { name: 'Mi aprendizaje' })).toBeVisible();
    await expect(freshPage.locator('#languageSelect')).toHaveValue('es');
    await expect(freshPage.locator('html')).toHaveAttribute('lang', 'es');
  } finally {
    await freshContext.close();
  }
});
