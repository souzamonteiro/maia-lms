import { expect, test } from './fixtures';

test('author prices a course and learner gets access only after the local checkout approves', async ({
  page,
  browser,
}) => {
  const courseSlug = `paid-course-${Date.now()}`;
  const learnerEmail = `paid-learner-${Date.now()}@example.com`;
  const learnerPassword = 'Paid-learner-password-123';

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Administer', exact: true }).click();
  await page.locator('[name=title]').fill('Paid course checkout');
  await page.locator('[name=slug]').fill(courseSlug);
  await page.locator('[name=summary]').fill('A course with a server-controlled price.');
  await page.locator('[name=accessMode]').selectOption('PAID');
  await page.locator('[name=priceAmountInput]').fill('25.99');
  await page.locator('[name=priceCurrency]').selectOption('BRL');
  await page.locator('.module-title').fill('Module');
  await page.locator('.lesson-title').fill('Lesson');
  await page.locator('.lesson-content').fill('Paid lesson content.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const card = page.locator('#admin-list article').filter({ hasText: 'Paid course checkout' });
  await card.getByRole('button', { name: 'Publish', exact: true }).click();

  const learnerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const learnerPage = await learnerContext.newPage();
  const registered = await learnerContext.request.post('/api/v1/auth/register', {
    data: { email: learnerEmail, password: learnerPassword, locale: 'en' },
  });
  expect(registered.status()).toBe(201);
  await learnerPage.goto('/auth/login');
  await learnerPage.getByLabel('Email', { exact: true }).fill(learnerEmail);
  await learnerPage.getByLabel('Password', { exact: true }).fill(learnerPassword);
  await learnerPage.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(learnerPage.getByRole('heading', { name: 'My learning' })).toBeVisible();

  await learnerPage.goto(`/courses/${courseSlug}`);
  await expect(learnerPage.locator('.course-price')).toContainText('R$25.99');
  await learnerPage.getByRole('button', { name: 'Buy course', exact: true }).click();
  await expect(learnerPage).toHaveURL(/\/dev\/fake-checkout\//);
  await expect(learnerPage.getByRole('heading', { name: 'Local test checkout' })).toBeVisible();
  const pendingEnrollments = await learnerPage.evaluate(async () =>
    (await (await fetch('/api/v1/me/enrollments')).json()).map((item: { slug: string }) => item.slug),
  );
  expect(pendingEnrollments).not.toContain(courseSlug);
  await learnerPage.getByRole('button', { name: 'Simulate cancellation' }).click();
  await expect(learnerPage).toHaveURL(/\/my-orders\?order=/);
  await expect(learnerPage.locator('.order-entry').first()).toContainText('Canceled');
  const canceledEnrollments = await learnerPage.evaluate(async () =>
    (await (await fetch('/api/v1/me/enrollments')).json()).map((item: { slug: string }) => item.slug),
  );
  expect(canceledEnrollments).not.toContain(courseSlug);

  await learnerPage.goto(`/courses/${courseSlug}`);
  await learnerPage.getByRole('button', { name: 'Buy course', exact: true }).click();
  await expect(learnerPage).toHaveURL(/\/dev\/fake-checkout\//);
  await learnerPage.getByRole('button', { name: 'Simulate approval' }).click();
  await expect(learnerPage).toHaveURL(/\/my-orders\?order=/);
  await expect(learnerPage.locator('.order-entry').first()).toContainText('Paid');
  await learnerPage.getByRole('button', { name: 'Refresh payment status', exact: true }).first().click();
  await expect(learnerPage.locator('.order-entry').first()).toContainText('Paid');
  const approvedEnrollments = await learnerPage.evaluate(async () =>
    (await (await fetch('/api/v1/me/enrollments')).json()).map((item: { slug: string }) => item.slug),
  );
  expect(approvedEnrollments).toContain(courseSlug);
  await learnerContext.close();
});