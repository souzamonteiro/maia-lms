import { test, expect } from './fixtures';

test('administrator reviews a privacy request and the requester sees its actual state without private notes', async ({ page, browser, request }) => {
  const email = `privacy-review-${Date.now()}@example.com`;
  const password = 'Privacy-review-password-123';
  expect((await request.post('/api/v1/auth/register', { data: { email, password, locale: 'en' } })).status()).toBe(201);
  expect((await request.post('/api/v1/auth/login', { data: { email, password } })).status()).toBe(200);
  const submitted = await request.post('/api/v1/auth/privacy/requests', { data: { requestType: 'deletion' } });
  expect(submitted.status()).toBe(201);
  const id = (await submitted.json()).id;

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Privacy requests', exact: true }).click();
  await expect(page).toHaveURL('/admin/privacy');
  await page.locator('#privacy-search input').fill(email);
  const search = page.locator('#privacy-search button');
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#privacy-summary')).toBeFocused();
  const card = page.locator('.privacy-request').filter({ hasText: id });
  await expect(card).toContainText('Open');
  await card.getByLabel('Private review note (5–1000 characters)').fill('Review pending retention policy. <script>private</script>');
  await page.locator('#languageSelect').selectOption('pt-BR');
  await expect(page.getByRole('heading', { name: 'Pedidos de privacidade', exact: true })).toBeVisible();
  await expect(card.locator('textarea')).toHaveValue('Review pending retention policy. <script>private</script>');
  await expect(page.locator('#privacy-search input')).toHaveValue(email);
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Privacy requests', exact: true })).toBeVisible();
  await expect(page.locator('#privacy-summary')).toContainText('1 requests');
  await page.route(/\/api\/v1\/admin\/privacy\/requests\?/, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Requests temporarily unavailable' }),
  }), { times: 1 });
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#privacy-list').getByRole('alert')).toContainText('Requests temporarily unavailable');
  await expect(page.locator('#privacy-list').getByRole('button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#privacy-summary')).toBeFocused();
  await expect(card.locator('textarea')).toHaveValue('Review pending retention policy. <script>private</script>');
  await page.route(`**/admin/privacy/requests/${id}/review`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Review temporarily unavailable' }),
  }), { times: 1 });
  const recordReview = card.getByRole('button', { name: 'Record review', exact: true });
  await recordReview.focus();
  await expect(recordReview).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Review temporarily unavailable');
  await expect(card.locator('textarea')).toHaveValue('Review pending retention policy. <script>private</script>');
  await recordReview.focus();
  await expect(recordReview).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toContainText('In review');
  await expect(card.getByRole('heading', { level: 2 })).toBeFocused();
  await page.route(`**/admin/privacy/requests/${id}/history`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'History temporarily unavailable' }),
  }), { times: 1 });
  await card.getByText('Private review history', { exact: true }).click();
  await expect(card.locator('.privacy-history').getByRole('alert')).toContainText('History temporarily unavailable');
  await expect(card.locator('.privacy-history')).toHaveAttribute('aria-busy', 'false');
  const historyRetry = card.locator('.privacy-history').getByRole('button');
  await historyRetry.focus();
  await page.keyboard.press('Enter');
  await expect(card.locator('.privacy-history')).toContainText('<script>private</script>');
  await expect(card.locator('summary')).toBeFocused();
  await expect(card.locator('.privacy-history script')).toHaveCount(0);

  for (const [locale, heading, state] of [
    ['pt-BR', 'Pedidos de privacidade', 'Em análise'],
    ['es', 'Solicitudes de privacidad', 'En revisión'],
    ['en', 'Privacy requests', 'In review'],
  ]) {
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.privacy-request').filter({ hasText: id })).toContainText(state);
  }
  const learnerContext = await browser.newContext();
  try {
    expect((await learnerContext.request.post('/api/v1/auth/login', { data: { email, password } })).status()).toBe(200);
    const learner = await learnerContext.newPage();
    await learner.goto('/my-learning');
    await expect(learner.locator('#privacy-request-list')).toContainText('In review');
    await expect(learner.locator('body')).not.toContainText('retention policy');
    await expect(learner.getByRole('link', { name: 'Privacy requests', exact: true })).toHaveCount(0);
    expect((await learnerContext.request.get(`/api/v1/admin/privacy/requests/${id}/history`)).status()).toBe(403);
  } finally {
    await learnerContext.close();
  }
});
