import { test, expect } from './fixtures';

test('public home and catalog are localized before JavaScript executes', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const [locale, heading, courses, login, noscript] of [
      ['en', 'Learn with Maia', 'Courses', 'Log in', 'JavaScript is required for search and filters. Published courses are listed above.'],
      ['pt-BR', 'Aprenda com a Maia', 'Cursos', 'Entrar', 'JavaScript é necessário para a busca e os filtros. Os cursos publicados estão listados acima.'],
      ['es', 'Aprende con Maia', 'Cursos', 'Iniciar sesión', 'JavaScript es necesario para la búsqueda y los filtros. Los cursos publicados se muestran arriba.'],
    ]) {
      await page.goto(`/?displayLocale=${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.locator('#account a')).toHaveText(login);
      await expect(page.locator('#languageSelect')).toHaveValue(locale);
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', locale.replace('-', '_'));
      await page.goto(`/courses?displayLocale=${locale}`);
      await expect(page.getByRole('heading', { name: courses, exact: true })).toBeVisible();
      await expect(page.locator('#account a')).toHaveText(login);
      expect(await page.content()).toContain(`<noscript>${noscript}</noscript>`);
      await expect(page.locator('#app h2 a').first()).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
