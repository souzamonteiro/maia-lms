import { test, expect } from './fixtures';

test('administrator reviews a privacy request and the requester sees its actual state without private notes', async ({ page, browser, request }) => {
  const email = `privacy-review-${Date.now()}@example.com`;
  const password = 'Privacy-review-password-123';
  expect((await request.post('/api/v1/auth/register', { data: { email, password, locale: 'en' } })).status()).toBe(201);
  expect((await request.post('/api/v1/auth/login', { data: { email, password } })).status()).toBe(200);
  const submitted = await request.post('/api/v1/auth/privacy/requests', { data: { requestType: 'deletion' } });
  expect(submitted.status()).toBe(201);
  const id = (await submitted.json()).id;
  let historyRequests = 0;
  let releaseHistoryRetry: (() => void) | undefined;
  let notifyHistoryRetry: (() => void) | undefined;
  const historyRetryStarted = new Promise<void>(resolve => {
    notifyHistoryRetry = resolve;
  });

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
  await expect(card.getByRole('button', { name: 'Close request', exact: true })).toHaveCount(0);
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
  await expect(page.locator('#privacy-list')).toHaveAttribute('aria-live', 'polite');
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press('Enter');
  const list = page.locator('#privacy-list');
  const listError = list.getByRole('alert');
  await expect(listError).toContainText('Requests temporarily unavailable');
  await expect(listError).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(list.getByRole('button', { name: 'Retry', exact: true })).toBeFocused();
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
  await page.route(`**/admin/privacy/requests/${id}/history`, async route => {
    historyRequests += 1;
    if (historyRequests <= 2) {
      await route.fulfill({
        status: 503, contentType: 'application/json',
        body: JSON.stringify({ error: 'History temporarily unavailable' }),
      });
      return;
    }

    notifyHistoryRetry?.();
    await new Promise<void>(resolve => {
      releaseHistoryRetry = resolve;
    });
    await route.continue();
  });
  await card.getByText('Private review history', { exact: true }).click();
  const history = card.locator('.privacy-history');
  const historyError = history.getByRole('alert');
  await expect(historyError).toContainText('History temporarily unavailable');
  await expect(historyError).toBeFocused();
  await expect(history).toHaveAttribute('aria-busy', 'false');
  const historyRetry = history.getByRole('button', { name: 'Retry', exact: true });
  await page.keyboard.press('Tab');
  await expect(historyRetry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(historyError).toHaveText('History temporarily unavailable');
  await expect(historyError).toBeFocused();
  await expect(history).toHaveAttribute('aria-busy', 'false');
  await page.keyboard.press('Tab');
  await expect(historyRetry).toBeFocused();
  await page.keyboard.press('Enter');
  await historyRetryStarted;
  await expect(history).toHaveAttribute('aria-busy', 'true');
  releaseHistoryRetry?.();
  await expect(history).toContainText('<script>private</script>');
  await expect(history).toHaveAttribute('aria-busy', 'false');
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
  await page.unroute(`**/admin/privacy/requests/${id}/history`);
  const resolutionNote = 'Resolution recorded; retention rules reviewed before any deletion.';
  await card.getByLabel('Private resolution note (5–1000 characters)').fill(resolutionNote);
  for (const [locale, heading, label, button] of [
    ['pt-BR', 'Pedidos de privacidade', 'Observação privada de resolução (5–1000 caracteres)', 'Encerrar pedido'],
    ['es', 'Solicitudes de privacidad', 'Nota privada de resolución (5–1000 caracteres)', 'Cerrar solicitud'],
    ['en', 'Privacy requests', 'Private resolution note (5–1000 characters)', 'Close request'],
  ]) {
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(card.getByLabel(label)).toHaveValue(resolutionNote);
    await expect(card.getByRole('button', { name: button, exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(card.getByLabel('Private resolution note (5–1000 characters)')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Close request', exact: true })).toBeVisible();
  await page.route(`**/admin/privacy/requests/${id}/close`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Closure temporarily unavailable' }),
  }), { times: 1 });
  const closeRequest = card.getByRole('button', { name: 'Close request', exact: true });
  await closeRequest.focus();
  await expect(closeRequest).toBeFocused();
  await page.keyboard.press('Enter');
  const closeError = page.getByRole('alert');
  await expect(closeError).toContainText('Closure temporarily unavailable');
  await expect(closeError).toBeFocused();
  await expect(card.getByLabel('Private resolution note (5–1000 characters)')).toHaveValue(resolutionNote);
  await closeRequest.focus();
  await expect(closeRequest).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toContainText('Closed');
  await expect(card.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(card.locator('form')).toHaveCount(0);
  await card.getByText('Private review history', { exact: true }).click();
  const closedHistory = card.locator('.privacy-history');
  await expect(closedHistory).toContainText('Closure');
  await expect(closedHistory).toContainText('Resolution recorded; retention rules reviewed before any deletion.');
  const learnerContext = await browser.newContext();
  try {
    expect((await learnerContext.request.post('/api/v1/auth/login', { data: { email, password } })).status()).toBe(200);
    const learner = await learnerContext.newPage();
    await learner.goto('/my-learning');
    await expect(learner.locator('#privacy-request-list')).toContainText('Closed');
    await expect(learner.locator('body')).not.toContainText('retention policy');
    await expect(learner.locator('body')).not.toContainText('retention rules');
    await expect(learner.getByRole('link', { name: 'Privacy requests', exact: true })).toHaveCount(0);
    expect((await learnerContext.request.get(`/api/v1/admin/privacy/requests/${id}/history`)).status()).toBe(403);
    await learner.locator('#privacy-deletion-request').click();
    await expect(learner.locator('#privacy-request-list')).toContainText('Open');
    await expect(learner.locator('#privacy-request-list')).toContainText('Closed');
  } finally {
    await learnerContext.close();
  }
});
