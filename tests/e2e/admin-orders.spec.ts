import { expect, test } from './fixtures';

test('administrator issues partial and full refunds while access follows the refund policy', async ({ page, browser }) => {
  const courseSlug = `refund-course-${Date.now()}`;
  const learnerEmail = `refund-learner-${Date.now()}@example.com`;
  const learnerPassword = 'Refund-learner-password-123';

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage orders', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Administer', exact: true }).click();
  await page.locator('[name=title]').fill('Refund support course');
  await page.locator('[name=slug]').fill(courseSlug);
  await page.locator('[name=summary]').fill('A paid course for refund support workflow validation.');
  await page.locator('[name=accessMode]').selectOption('PAID');
  await page.locator('[name=priceAmountInput]').fill('25.99');
  await page.locator('[name=priceCurrency]').selectOption('BRL');
  await page.locator('.module-title').fill('Module');
  await page.locator('.lesson-title').fill('Lesson');
  await page.locator('.lesson-content').fill('Paid lesson content.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const courseCard = page.locator('#admin-list article').filter({ hasText: 'Refund support course' });
  await courseCard.getByRole('button', { name: 'Publish', exact: true }).click();
  const coursePath = await courseCard.getByRole('link', { name: 'View', exact: true }).getAttribute('href');
  expect(coursePath).toBeTruthy();

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
  await learnerPage.goto(coursePath!);
  await expect(learnerPage.getByRole('heading', { name: 'Refund support course' })).toBeVisible();
  const lessonPath = await learnerPage
    .getByRole('link', { name: 'Lesson', exact: true })
    .getAttribute('href');
  expect(lessonPath).toBeTruthy();
  const lessonId = new URL(lessonPath!, new URL(learnerPage.url()).origin).pathname.split('/').at(-1);
  const lessonApiPath = `/api/v1/lessons/${lessonId}`;
  expect((await learnerPage.request.get(lessonApiPath)).status()).toBe(403);
  await learnerPage.getByRole('button', { name: 'Buy course', exact: true }).click();
  await expect(learnerPage).toHaveURL(/\/dev\/fake-checkout\//);
  await learnerPage.getByRole('button', { name: 'Simulate approval', exact: true }).click();
  await expect(learnerPage).toHaveURL(/\/my-orders\?order=/);
  expect((await learnerPage.request.get(lessonApiPath)).status()).toBe(200);

  await page.goto('/admin/orders');
  await expect(page.getByRole('heading', { name: 'Manage orders' })).toBeVisible();
  await page.getByLabel('Search order ID, buyer email, or course', { exact: true }).fill(learnerEmail);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  let order = page.locator('.admin-order').filter({ hasText: learnerEmail });
  await expect(order).toContainText('Paid');
  await order.getByText('Issue refund', { exact: true }).click();
  const refundForm = order.locator('.admin-refund-form');
  await refundForm.getByLabel('Reason', { exact: true }).fill('Approved partial customer refund.');
  await refundForm.getByLabel('Amount (leave blank for remaining balance)', { exact: true }).fill('10.00');
  await refundForm.getByRole('button', { name: 'Submit refund', exact: true }).click();
  order = page.locator('.admin-order').filter({ hasText: learnerEmail });
  await expect(order).toContainText('Partially refunded');
  await order.getByText('Order history', { exact: true }).click();
  await expect(order).toContainText('Approved partial customer refund.');

  const partialAccess = await learnerPage.evaluate(async slug => {
    const response = await fetch('/api/v1/me/enrollments');
    const enrollments = await response.json();
    return enrollments.find((enrollment: { slug: string }) => enrollment.slug === slug)?.state;
  }, courseSlug);
  expect(partialAccess).toBe('active');
  expect((await learnerPage.request.get(lessonApiPath)).status()).toBe(200);

  await order.getByText('Issue refund', { exact: true }).click();
  const remainingRefundForm = order.locator('.admin-refund-form');
  await remainingRefundForm.getByLabel('Reason', { exact: true }).fill('Approved refund of remaining balance.');
  await remainingRefundForm.getByRole('button', { name: 'Submit refund', exact: true }).click();
  order = page.locator('.admin-order').filter({ hasText: learnerEmail });
  await expect(order).toContainText('Refunded');
  await order.getByText('Order history', { exact: true }).click();
  await expect(order).toContainText('Approved refund of remaining balance.');
  await expect(order).toContainText('Approved partial customer refund.');

  const fullRefundAccess = await learnerPage.evaluate(async slug => {
    const response = await fetch('/api/v1/me/enrollments');
    const enrollments = await response.json();
    return enrollments.find((enrollment: { slug: string }) => enrollment.slug === slug)?.state;
  }, courseSlug);
  expect(fullRefundAccess).toBe('revoked');
  expect((await learnerPage.request.get(lessonApiPath)).status()).toBe(403);
  await learnerContext.close();
});