import { defineConfig } from '@playwright/test';
const e2ePort = process.env.E2E_PORT ?? '4320';
const baseURL = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `${baseURL}/readyz`,
    reuseExistingServer: false,
  },
});
