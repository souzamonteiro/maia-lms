import { test, expect } from './fixtures';

test('administrator inspects operational status and refreshes the summary', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link', { name: 'Operations', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
  for (const heading of [
    'Workers',
    'Media jobs',
    'Message queue',
    'Payments by state',
    'Storage',
    'Alerts',
    'Playback',
  ]) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText('0 playback requests in the last 7 days')).toBeVisible();
  await expect(page.locator('#ops-playback')).toContainText('Not measured');
  await expect(page.locator('#ops-playback-status dd')).toHaveText(['0', '0', '0', '0', '0']);
  expect((await page.request.get('/api/v1/lessons/missing-duration-test/video')).status()).toBe(404);
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.locator('#ops-updated')).toContainText('Updated');
  await expect(page.getByText('1 playback requests in the last 7 days')).toBeVisible();
  await expect(page.locator('#ops-playback-status dd')).toHaveText(['0', '0', '0', '1', '0']);
  // Exercise every bucket without inventing server failures in the fixture.
  await page.route('**/api/v1/admin/operations', async route => {
    const response = await route.fetch();
    const summary = await response.json();
    summary.playback.requests = 15;
    summary.playback.byResource = { mp4: 15 };
    summary.playback.byStatusClass = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
    summary.outbox.ready = 2;
    summary.outbox.oldestReadyDelaySeconds = 123;
    summary.emailTransport = { windowDays: 7, attempts: 5, accepted: 3, failed: 2, averageMs: 125 };
    await route.fulfill({ response, json: summary });
  });

  for (const [locale, measuredLabel, durationLabel] of [
    ['en', 'Responses with duration measured', 'Average response completion time'],
    ['pt-BR', 'Respostas com duração medida', 'Tempo médio até concluir a resposta'],
    ['es', 'Respuestas con duración medida', 'Tiempo medio hasta completar la respuesta'],
  ]) {
    await page.locator('#languageSelect').selectOption(locale);
    const measured = page.locator('#ops-playback > div').filter({ has: page.getByText(measuredLabel, { exact: true }) });
    await expect(measured.locator('dd')).toHaveText('1');
    const duration = page.locator('#ops-playback > div').filter({ hasText: durationLabel });
    await expect(duration.locator('dd')).toHaveText(/^[\d.,]+ ms$/);
    const queueLabel = locale === 'en' ? 'Messages ready for processing'
      : locale === 'pt-BR' ? 'Mensagens prontas para processamento' : 'Mensajes listos para procesar';
    await expect(page.locator('#ops-outbox > div').filter({
      has: page.getByText(queueLabel, { exact: true }),
    }).locator('dd')).toHaveText('2');
    await expect(page.locator('#ops-outbox')).toContainText('123 s');
    await expect(page.locator('#ops-email-transport dd')).toHaveText(['5', '3', '2', '125 ms']);
    await expect(page.getByRole('heading', {
      name: locale === 'en' ? 'Email transport · last 7 UTC days'
        : locale === 'pt-BR' ? 'Transporte de e-mail · últimos 7 dias UTC'
          : 'Transporte de correo · últimos 7 días UTC',
      exact: true,
    })).toBeVisible();
    await expect(page.locator('#ops-playback-status dd')).toHaveText(['1', '2', '3', '4', '5']);
    await expect(page.getByRole('heading', {
      name: locale === 'en' ? 'Media responses by HTTP status'
        : locale === 'pt-BR' ? 'Respostas de mídia por status HTTP'
          : 'Respuestas de medios por estado HTTP',
      exact: true,
    })).toBeVisible();
    await expect(page.locator('#ops-playback-status dt')).toHaveText(
      locale === 'en'
        ? ['1xx — Informational', '2xx — Successful responses', '3xx — Redirections', '4xx — Client errors', '5xx — Server errors']
        : locale === 'pt-BR'
          ? ['1xx — Informativas', '2xx — Respostas bem-sucedidas', '3xx — Redirecionamentos', '4xx — Erros do cliente', '5xx — Erros do servidor']
          : ['1xx — Informativas', '2xx — Respuestas correctas', '3xx — Redirecciones', '4xx — Errores del cliente', '5xx — Errores del servidor'],
    );
  }
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
  await page.route('**/api/v1/admin/operations', async route => {
    const response = await route.fetch();
    const summary = await response.json();
    summary.outbox.ready = 0;
    summary.outbox.oldestReadyDelaySeconds = null;
    summary.emailTransport = { windowDays: 7, attempts: 0, accepted: 0, failed: 0, averageMs: null };
    await route.fulfill({ response, json: summary });
  }, { times: 1 });
  await page.locator('#ops-refresh').click();
  await expect(page.locator('#ops-outbox')).toContainText('No messages ready');
  await expect(page.locator('#ops-email-transport dd')).toHaveText(['0', '0', '0', 'Not measured']);
});

test('storage measurement failures remain visible until a successful refresh in every locale', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  let storage: { availableBytes: number; totalBytes: number } | null = null;
  await page.route('**/api/v1/admin/operations', async route => {
    const response = await route.fetch();
    const summary = await response.json();
    summary.storage = storage;
    summary.alerts = summary.alerts.filter((code: string) => !code.startsWith('STORAGE_'));
    if (!storage) summary.alerts.push('STORAGE_UNAVAILABLE');
    else if (storage.availableBytes / storage.totalBytes < 0.1) summary.alerts.push('STORAGE_LOW');
    await route.fulfill({ response, json: summary });
  });
  await page.getByRole('link', { name: 'Operations', exact: true }).click();
  for (const [locale, unavailable, warning, low] of [
    ['en', 'Unavailable', 'Storage capacity could not be measured. Check the storage path and service permissions, then refresh.', 'Storage has less than 10% free space.'],
    ['pt-BR', 'Indisponível', 'Não foi possível medir a capacidade do armazenamento. Confira o caminho e as permissões do serviço e atualize.', 'O armazenamento tem menos de 10% de espaço livre.'],
    ['es', 'No disponible', 'No se pudo medir la capacidad del almacenamiento. Comprueba la ruta y los permisos del servicio y actualiza.', 'El almacenamiento tiene menos del 10% de espacio libre.'],
  ]) {
    storage = null;
    await page.locator('#languageSelect').selectOption(locale);
    await expect(page.locator('#ops-storage')).toHaveText(unavailable);
    await expect(page.locator('#ops-alerts')).toContainText(warning);
    await expect(page.locator('#ops-alerts')).not.toContainText(low);
    await expect(page.locator('#ops-error')).toBeEmpty();
    await expect(page.locator('#ops-snapshot')).toBeVisible();
    await expect(page.locator('#ops-playback-status dd')).toHaveCount(5);

    storage = { availableBytes: 9 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 };
    await page.locator('#ops-refresh').click();
    await expect(page.locator('#ops-alerts')).toContainText(low);
    await expect(page.locator('#ops-alerts')).not.toContainText(warning);
    await expect(page.locator('#ops-storage dd')).toHaveText(['9 GiB', '100 GiB']);

    storage = { availableBytes: 10 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 };
    await page.locator('#ops-refresh').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ops-storage dd')).toHaveText(['10 GiB', '100 GiB']);
    await expect(page.locator('#ops-alerts')).not.toContainText(warning);
    await expect(page.locator('#ops-alerts')).not.toContainText(low);
  }
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
});

test('operations distinguishes unavailable and outdated snapshots and recovers after retry', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Admin-test-password-123');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('link', { name: 'Operations', exact: true }).click();
    const snapshot = page.locator('#ops-snapshot');
    const updated = page.locator('#ops-updated');
    const error = page.locator('#ops-error');
    const refresh = page.locator('#ops-refresh');
    for (const [locale, unavailable, stale, loading] of [
      ['en', 'Operational status unavailable.', 'Showing outdated data from', 'Loading operational status…'],
      ['pt-BR', 'Status operacional indisponível.', 'Exibindo dados desatualizados de', 'Carregando status operacional…'],
      ['es', 'Estado operativo no disponible.', 'Se muestran datos desactualizados de', 'Cargando estado operativo…'],
    ]) {
        const [localeResponse] = await Promise.all([
          page.waitForResponse(response => response.url().endsWith('/api/v1/admin/operations')),
          page.locator('#languageSelect').selectOption(locale),
        ]);
        await localeResponse.finished();
        await expect(snapshot).toBeVisible();
      await expect(snapshot).toHaveAttribute('aria-busy', 'false');
      await page.route('**/api/v1/admin/operations', route => route.fulfill({
        status: 503, contentType: 'application/json',
        body: JSON.stringify({ error: 'Status temporarily unavailable' }),
      }), { times: 1 });
      await page.reload();
      await expect(updated).toContainText(unavailable);
      await expect(error).toHaveText('Status temporarily unavailable');
      await expect(error).toBeFocused();
      await expect(snapshot).toBeHidden();
      await expect(refresh).toBeEnabled();
      await refresh.focus();
      await page.keyboard.press('Enter');
      await expect(snapshot).toBeVisible();
      await expect(error).toBeEmpty();
      await expect(snapshot).toHaveAttribute('aria-busy', 'false');
      const timestamp = (await updated.textContent())!.replace(/^\S+\s/, '');
      const previousData = await snapshot.textContent();

      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/api/v1/admin/operations', async route => {
        await held;
        await route.fulfill({
          status: 503, contentType: 'application/json',
          body: JSON.stringify({ error: 'Refresh temporarily unavailable' }),
        });
      }, { times: 1 });
      try {
        await refresh.click();
        await expect(updated).toHaveText(loading);
        await expect(refresh).toBeDisabled();
        await expect(snapshot).toHaveAttribute('aria-busy', 'true');
      } finally {
        release();
      }
      await expect(updated).toContainText(stale);
      await expect(updated).toContainText(timestamp);
      await expect(error).toBeFocused();
      await expect(snapshot).toHaveText(previousData!);
      await expect(snapshot).toHaveAttribute('aria-busy', 'false');
      await expect(refresh).toBeEnabled();
      await refresh.focus();
      await page.keyboard.press('Enter');
      await expect(error).toBeEmpty();
      await expect(snapshot).toHaveAttribute('aria-busy', 'false');
      await expect(updated).not.toContainText(stale);
      await expect(updated).not.toHaveText(loading);
    }
    await page.locator('#languageSelect').selectOption('en');
    await expect(snapshot).toBeVisible();
});