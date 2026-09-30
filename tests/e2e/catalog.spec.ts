import { test, expect } from './fixtures';

test('catalog keeps filters in shared URLs and navigates real pages', async ({ page }) => {
  await page.goto(
    '/courses?q=Catalog+fixture&locale=en&level=beginner&accessMode=OPEN_FREE&sort=title',
  );
  await expect(page.locator('#catalog .card')).toHaveCount(12);
  await page.getByRole('link', { name: 'Next page', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await expect(page.locator('#catalog')).toContainText('Catalog fixture 12');
  await page.reload();
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await page.locator('#languageSelect').selectOption('pt-BR');
  await expect(page.locator('#search [name=locale]')).toHaveValue('en');
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await page.locator('#languageSelect').selectOption('en');
  await page.locator('#search [name=locale]').selectOption('es');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#catalog')).toContainText('No courses match');
  await expect(page).not.toHaveURL(/page=2/);
  await page.goBack();
  await expect(page.locator('#catalog .card')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
