import { test, expect } from './fixtures';

test('administrator revokes and reissues a certificate with private reasons and lineage', async ({ page }) => {
  const predecessorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let state: 'valid' | 'revoked' = 'valid';
  let successorId: string | null = null;
  let reason = '';

  await page.route('**/api/v1/admin/certificates**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname === '/api/v1/admin/certificates' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: successorId ? 2 : 1,
          limit: 50,
          offset: 0,
          items: [
            {
              id: predecessorId,
              enrollment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              public_code: 'A'.repeat(43),
              confirmed_name: 'Ada Lovelace',
              issued_at: '2026-10-03T12:00:00.000Z',
              revoked_at: state === 'revoked' ? '2026-10-04T12:00:00.000Z' : null,
              reason: state === 'revoked' ? reason : null,
              pdf_status: 'READY',
              supersedes_id: null,
              course_title: 'Analytical Engines',
              email: 'ada@example.com',
              successor_id: successorId,
            },
          ],
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/revoke') && method === 'PATCH') {
      reason = request.postDataJSON().reason;
      state = 'revoked';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ changed: true }) });
      return;
    }
    if (url.pathname.endsWith('/reissue') && method === 'POST') {
      reason = request.postDataJSON().reason;
      successorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ certificate: { id: successorId } }),
      });
      return;
    }
    if (url.pathname.endsWith('/history') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: predecessorId,
              public_code: 'A'.repeat(43),
              confirmed_name: 'Ada Lovelace',
              issued_at: '2026-10-03T12:00:00.000Z',
              revoked_at: '2026-10-04T12:00:00.000Z',
              reason,
              supersedes_id: null,
              successor_id: successorId,
            },
            ...(successorId ? [{
              id: successorId,
              public_code: 'B'.repeat(43),
              confirmed_name: 'Ada Lovelace',
              issued_at: '2026-10-04T12:01:00.000Z',
              revoked_at: null,
              reason: null,
              supersedes_id: predecessorId,
              successor_id: null,
            }] : []),
          ],
          events: [
            { actor_id: 'admin-id', action: 'certificate.revoke', occurred_at: '2026-10-04T12:00:00.000Z', metadata: JSON.stringify({ reason }) },
            ...(successorId ? [{ actor_id: 'admin-id', action: 'certificate.reissue', occurred_at: '2026-10-04T12:01:00.000Z', metadata: JSON.stringify({ reason }) }] : []),
          ],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage certificates', exact: true })).toBeVisible();
  await page.goto('/admin/certificates');
  const item = page.locator('.admin-certificate').filter({ hasText: 'ada@example.com' });
  await expect(item).toContainText('Valid certificate');

  page.once('dialog', dialog => dialog.accept('Incorrect issuer record confirmed.'));
  await item.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await expect(item).toContainText('Revoked certificate');
  await expect(item).toContainText('Incorrect issuer record confirmed.');
  await expect(item.getByRole('button', { name: 'Reissue certificate', exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.accept('Replacement approved by support.'));
  await item.getByRole('button', { name: 'Reissue certificate', exact: true }).click();
  await expect(page.locator('#message')).toContainText('Replacement certificate issued');
  await item.getByText('History and lineage', { exact: true }).click();
  await expect(item).toContainText('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await expect(item).toContainText('Replacement approved by support.');
  await expect(
    item.locator(`#certificate-history-${predecessorId}`).getByRole('link', { name: 'A'.repeat(43) }),
  ).toHaveAttribute('href', `/certificates/verify/${'A'.repeat(43)}`);
  await expect(
    item.locator(`#certificate-history-${successorId}`).getByRole('link', { name: predecessorId }),
  ).toHaveAttribute('href', `#certificate-history-${predecessorId}`);
  await expect(item.getByRole('button', { name: 'Reissue certificate', exact: true })).toHaveCount(0);
});
