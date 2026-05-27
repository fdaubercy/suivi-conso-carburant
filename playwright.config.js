// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright — Suivi Conso E85
 * Tests E2E sur le serveur de développement Vite (localhost:5173).
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /* Seuls les fichiers *.spec.js sont des tests Playwright ;
     les *.test.js sont réservés à Vitest. */
  testDir:   './tests',
  testMatch: '**/*.spec.js',

  /* Séquentiel : 1 seul worker pour la SPA */
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:5173/',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Démarre le serveur Vite avant les tests, réutilise s'il tourne déjà. */
  webServer: {
    command: 'npm run dev',
    url:     'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
