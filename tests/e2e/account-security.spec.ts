import { test, expect } from './fixtures';

test('learner changes password from account security and must sign in again', async ({ page }) => {
  const email = 'password-change@example.com';
  const oldPassword = 'Current-password-123';
  const newPassword = 'Updated-password-456';

  await page.goto('/auth/register');
  await expect(page.locator('#auth [name=email]')).toBeVisible();
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.locator('#languageSelect')).toBeEnabled();
  await page.locator('#auth [name=email]').fill(email);
  await page.locator('#auth [name=password]').fill(oldPassword);
  await page.locator('#auth button[type=submit]').click();
  await expect(page.getByRole('status')).toContainText('Account created');

  await page.goto('/auth/login');
  await expect(page.locator('#auth [name=email]')).toBeVisible();
  await page.locator('#auth [name=email]').fill(email);
  await page.locator('#auth [name=password]').fill(oldPassword);
  await page.locator('#auth button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account security' })).toBeVisible();
  await page.locator('#languageSelect').selectOption('pt-BR');
  await expect(page.locator('#languageSelect')).toBeEnabled();
  await page.getByLabel('Nome de exibição', { exact: true }).fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Perfil salvo.');

  for (const [locale, labels, mismatch] of [
    ['en', ['Current password', 'New password', 'Confirm new password', 'Change password'], 'The new passwords do not match.'],
    ['pt-BR', ['Senha atual', 'Nova senha', 'Confirme a nova senha', 'Alterar senha'], 'As novas senhas não coincidem.'],
    ['es', ['Contraseña actual', 'Nueva contraseña', 'Confirma la nueva contraseña', 'Cambiar contraseña'], 'Las nuevas contraseñas no coinciden.'],
  ]) {
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#languageSelect')).toBeEnabled();
    await page.getByLabel(labels[0], { exact: true }).fill(oldPassword);
    await page.getByLabel(labels[1], { exact: true }).fill(newPassword);
    await page.getByLabel(labels[2], { exact: true }).fill('Mismatch-password-789');
    await expect(page.getByLabel(labels[0], { exact: true })).toHaveValue(oldPassword);
    await expect(page.getByLabel(labels[1], { exact: true })).toHaveValue(newPassword);
    await expect(page.getByLabel(labels[2], { exact: true })).toHaveValue('Mismatch-password-789');
    await page.getByRole('button', { name: labels[3], exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(mismatch);
  }

  await page.locator('#languageSelect').selectOption('pt-BR');
  await page.getByLabel('Confirme a nova senha', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login\?passwordChanged=1$/);
  await expect(page.getByRole('status')).toContainText('Senha alterada');

  await page.locator('#auth [name=email]').fill(email);
  await page.locator('#auth [name=password]').fill(oldPassword);
  await page.locator('#auth button[type=submit]').click();
  await expect(page.getByRole('status')).toHaveText('E-mail ou senha inválidos.');

  await page.locator('#auth [name=password]').fill(newPassword);
  await page.locator('#auth button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Meu aprendizado' })).toBeVisible();
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toHaveValue('Ada Lovelace');
});
