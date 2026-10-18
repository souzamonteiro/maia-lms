import { createHmac } from 'node:crypto';
import { expect, test } from './fixtures';

function totp(secret: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const character of secret) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:my-learning|auth\/login)$/);
  if (new URL(page.url()).pathname === '/my-learning') {
    await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
  }
}

test('administrator enables MFA, uses recovery and TOTP factors, then disables it securely', async ({ page }) => {
  await page.route('**/api/v1/auth/me', async route => {
    const response = await route.fetch();
    if (!response.ok) {
      await route.fulfill({ response });
      return;
    }
    const user = await response.json();
    await route.fulfill({ response, json: { ...user, locale: 'en' } });
  });
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
  const security = page.locator('.admin-mfa-settings');
  await expect(security).toContainText('Two-step verification is not enabled');
  await security.getByRole('button', { name: 'Set up authenticator' }).click();
  await expect(security.getByText(/^Setup key:/)).toBeVisible();
  const keyText = await security.locator('p').nth(1).textContent();
  const secret = keyText!.split(': ').at(-1)!;
  await security.getByLabel('Current six-digit code').fill(totp(secret));
  await security.getByRole('button', { name: 'Enable two-step verification' }).click();

  const recoveryCodes = (await security.locator('pre').textContent())!.trim().split('\n');
  expect(recoveryCodes).toHaveLength(10);
  await security.getByRole('button', { name: 'I saved these codes' }).click();
  await expect(security).toContainText('Two-step verification is enabled');
  await expect(security).toContainText('10 recovery codes remain');

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible();
  await page.getByLabel('Authenticator or recovery code').fill(recoveryCodes[0]);
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
  await expect(page.locator('.admin-mfa-settings')).toContainText('9 recovery codes remain');

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible();
  await page.getByLabel('Authenticator or recovery code').fill(totp(secret));
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();

  const activeSecurity = page.locator('.admin-mfa-settings');
  await activeSecurity.getByLabel('Current password').fill('Admin-test-password-123');
  await activeSecurity.getByLabel('Authenticator or recovery code').fill(recoveryCodes[1]);
  await activeSecurity.getByRole('button', { name: 'Disable two-step verification' }).click();
  await expect(page).toHaveURL(/\/auth\/login\?mfaDisabled=1$/);
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
  await expect(page.locator('.admin-mfa-settings')).toContainText('Two-step verification is not enabled');
});
