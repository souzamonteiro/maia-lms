import { test, expect } from './fixtures';

test('administrator manages categories and authors publish categorized courses', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Administer', exact: true }).click();
  await page.getByRole('link', { name: 'Manage categories', exact: true }).click();
  await page.getByLabel('Category name', { exact: true }).fill('Coding <b>basics</b>');
  await page.getByLabel('Category slug', { exact: true }).fill('coding-basics');
  await page.getByLabel('Category description', { exact: true }).fill('Practical code');
  for (const locale of ['pt-BR', 'es', 'en']) {
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.locator('#category-editor [name=name]')).toHaveValue('Coding <b>basics</b>');
  }
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.locator('#category-list h2')).toHaveText('Coding <b>basics</b>');
  await expect(page.locator('#category-list b')).toHaveCount(0);
  await page.getByLabel('Category name', { exact: true }).fill('Coding basics');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.locator('#category-list h2')).toHaveText('Coding basics');
  await page.locator('#app').getByRole('link', { name: 'Administer', exact: true }).click();
  await page.getByLabel('Coding basics', { exact: true }).check();
  await page.locator('[name=title]').fill('Categorized course');
  await page.locator('[name=slug]').fill('categorized-course');
  await page.locator('[name=summary]').fill('An introduction to programming with categories.');
  await page.locator('.module-title').fill('Introduction');
  await page.locator('.lesson-title').fill('First steps');
  await page.locator('.lesson-content').fill('A complete introduction.');
  for (const locale of ['pt-BR', 'es', 'en']) {
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.getByLabel('Coding basics', { exact: true })).toBeChecked();
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#save-status')).toContainText('Draft saved');
  const card = page
    .locator('#admin-list .card')
    .filter({ has: page.getByRole('heading', { name: 'Categorized course', exact: true }) });
  await card.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(card).toContainText('PUBLISHED');
  await page.goto('/courses/categorized-course');
  await page.getByRole('link', { name: 'Coding basics', exact: true }).click();
  await expect(page).toHaveURL(/category=coding-basics/);
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await page.locator('#search [name=locale]').selectOption('en');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#search [name=category]')).toHaveValue('coding-basics');
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await page.goto('/admin/categories');
  await expect(page.getByRole('button', { name: 'Delete category', exact: true })).toBeDisabled();
  await page.getByLabel('Category name', { exact: true }).fill('Unused category');
  await page.getByLabel('Category slug', { exact: true }).fill('unused-category');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  const unused = page
    .locator('#category-list .card')
    .filter({ has: page.getByRole('heading', { name: 'Unused category', exact: true }) });
  await expect(unused).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await unused.getByRole('button', { name: 'Delete category', exact: true }).click();
  await expect(unused).toHaveCount(0);
});
