import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for MetalMaster ERP
 * 
 * Usage:
 *   npm run test:e2e          — Run all E2E tests
 *   npm run test:e2e:ui       — Run with Playwright UI  
 *   npm run test:e2e:headed   — Run with visible browser
 *
 * Requirements:
 *   - Firebase Auth Emulator running on port 9099
 *   - Firestore Emulator running on port 8080
 *   - Dev server running on port 3000
 *
 * See e2e/README.md for setup instructions.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Sequential — tests share Firestore state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker — tests depend on shared state
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Asia/Tashkent',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start dev server before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
