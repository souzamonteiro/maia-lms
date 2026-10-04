import { test, expect } from './fixtures';

test('public certificate verification renders only approved fields and current status', async ({ page }) => {
  await page.route('**/api/v1/certificates/verify/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        learnerName: '<Ada Lovelace>',
        courseTitle: 'Analytical Engines',
        workloadMinutes: 90,
        issuerName: 'Maia Academy',
        issuedAt: '2026-10-03T12:00:00.000Z',
        status: 'valid',
      }),
    });
  });

  const response = await page.goto(`/certificates/verify/${'A'.repeat(43)}`);
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  await expect(page.getByRole('heading', { name: 'Certificate verification' })).toBeVisible();
  await expect(page.locator('.certificate-status')).toContainText('Valid certificate');
  await expect(page.locator('.certificate-facts')).toContainText('Ada Lovelace');
  await expect(page.locator('.certificate-facts')).toContainText('Analytical Engines');
  await expect(page.locator('.certificate-facts')).toContainText('90 minutes');
  await expect(page.locator('.certificate-facts')).toContainText('Maia Academy');
  await expect(page.locator('.certificate-facts img')).toHaveCount(0);
  await expect(page.locator('.certificate-verification')).not.toContainText('payloadHash');

  await page.unroute('**/api/v1/certificates/verify/**');
  await page.route('**/api/v1/certificates/verify/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        learnerName: 'Ada Lovelace',
        courseTitle: 'Analytical Engines',
        workloadMinutes: 90,
        issuerName: 'Maia Academy',
        issuedAt: '2026-10-03T12:00:00.000Z',
        status: 'revoked',
      }),
    });
  });
  await page.goto(`/certificates/verify/${'C'.repeat(43)}`);
  await expect(page.locator('.certificate-status')).toContainText('Revoked certificate');

  await page.unroute('**/api/v1/certificates/verify/**');
  await page.route('**/api/v1/certificates/verify/**', async route => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Certificate not found', code: 'CERTIFICATE_NOT_FOUND' }),
    });
  });
  await page.goto(`/certificates/verify/${'D'.repeat(43)}`);
  await expect(page.locator('.certificate-status')).toContainText('This certificate could not be found.');
});

test('My Learning lists certificates and only offers downloads for ready PDFs', async ({ page }) => {
  await page.route('**/api/v1/me/certificates', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          publicCode: 'A'.repeat(43),
          issuedAt: '2026-10-03T12:00:00.000Z',
          status: 'valid',
          pdfStatus: 'PENDING',
          courseTitle: 'Pending PDF course',
          learnerName: 'Ada Lovelace',
          verificationPath: `/certificates/verify/${'A'.repeat(43)}`,
          downloadPath: null,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          publicCode: 'B'.repeat(43),
          issuedAt: '2026-10-02T12:00:00.000Z',
          status: 'revoked',
          pdfStatus: 'READY',
          courseTitle: 'Ready PDF course',
          learnerName: 'Ada Lovelace',
          verificationPath: `/certificates/verify/${'B'.repeat(43)}`,
          downloadPath: '/api/v1/me/certificates/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/pdf',
        },
      ]),
    });
  });
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Administer', exact: true })).toBeVisible();
  await page.goto('/my-learning');

  const certificates = page.locator('.learner-certificates');
  await expect(certificates.getByRole('heading', { name: 'My certificates' })).toBeVisible();
  const pending = certificates.locator('.certificate-entry').filter({ hasText: 'Pending PDF course' });
  await expect(pending).toContainText('PDF is being prepared');
  await expect(pending.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
  await expect(pending.getByRole('link', { name: 'Verify certificate' })).toHaveAttribute(
    'href',
    `/certificates/verify/${'A'.repeat(43)}`,
  );

  const ready = certificates.locator('.certificate-entry').filter({ hasText: 'Ready PDF course' });
  await expect(ready).toContainText('Revoked certificate');
  await expect(ready).toContainText('PDF ready');
  await expect(ready.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
    'href',
    '/api/v1/me/certificates/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/pdf',
  );
});
