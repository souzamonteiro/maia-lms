import { test, expect } from '@playwright/test';
test('administrator publishes; a learner enrolls and completes an article', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('E-mail', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('link', { name: 'Administrar', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).first().fill('Primeiros passos com Maia');
  await page.getByLabel('Endereço do curso').fill('primeiros-passos');
  await page
    .getByLabel('Resumo')
    .fill('Aprenda a criar seu primeiro projeto com a plataforma Maia.');
  await page.getByLabel('Acesso', { exact: true }).selectOption('ENROLLED_FREE');
  await page.getByLabel('Título do módulo').fill('Introdução');
  await page.getByLabel('Título', { exact: true }).nth(1).fill('Bem-vindo');
  await page
    .getByLabel('Conteúdo (texto)')
    .fill('Seu primeiro projeto começa aqui. <script>alert("xss")</script>');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.goto('/auth/register');
  await page.getByLabel('E-mail', { exact: true }).fill('learner@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Learner-test-password-123');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Conta criada');
  await page.goto('/auth/login');
  await page.getByLabel('E-mail', { exact: true }).fill('learner@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Learner-test-password-123');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meu aprendizado' })).toBeVisible();
  await page.goto('/courses/primeiros-passos');
  await page.getByRole('button', { name: 'Inscrever-se gratuitamente' }).click();
  await expect(page.getByText('Você está matriculado neste curso.')).toBeVisible();
  await page.getByRole('link', { name: 'Bem-vindo' }).click();
  await expect(page.locator('.lesson-body')).toContainText('<script>alert("xss")</script>');
  await page.getByRole('button', { name: 'Marcar como concluída' }).click();
  await expect(page.getByRole('button', { name: 'Aula concluída ✓' })).toBeVisible();
  await page.getByRole('link', { name: 'Meu aprendizado', exact: true }).click();
  await expect(page.getByText('1 de 1 aulas obrigatórias concluídas.')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Primeiros passos com Maia' })).toBeVisible();
  await page.screenshot({ path: 'test-results/catalog.png', fullPage: true });
});
