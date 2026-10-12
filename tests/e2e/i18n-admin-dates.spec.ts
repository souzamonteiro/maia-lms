import { expect, test } from './fixtures';

test('admin account dates follow the selected interface locale', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage users', exact: true })).toBeVisible();

  const timestamp = '2026-01-02T12:00:00.000Z';
  let selectedLocale = 'en';
  await page.route('**/api/v1/auth/locale', async route => {
    selectedLocale = route.request().postDataJSON().locale;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ locale: selectedLocale }),
    });
  });
  await page.route('**/api/v1/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'admin-fixture', role: 'admin', locale: selectedLocale }),
    });
  });
  await page.route('**/api/v1/admin/users**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        items: [{
          id: 'user-fixture',
          email: 'learner@example.test',
          display_name: 'Learner',
          role: 'learner',
          status: 'active',
          locale: 'en',
          verified_at: timestamp,
          created_at: timestamp,
        }],
        limit: 25,
        offset: 0,
      }),
    });
  });

  await page.goto('/admin/users');
  const createdDate = page.locator('.user-list-item dl dd').nth(4);
  const expected = async (locale: string) => page.evaluate(
    ({ locale, timestamp }) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(timestamp)),
    { locale, timestamp },
  );

  await expect(createdDate).toHaveText(await expected('en'));
  await page.locator('#languageSelect').selectOption('pt-BR');
  await expect(createdDate).toHaveText(await expected('pt-BR'));
  await page.locator('#languageSelect').selectOption('es');
  await expect(createdDate).toHaveText(await expected('es'));
});
