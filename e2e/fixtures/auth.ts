import { test as base, Page } from '@playwright/test';

/**
 * Auth fixture for MetalMaster ERP E2E tests.
 * 
 * Strategy: Inject a mock Firebase user via localStorage and sessionStorage 
 * before the app loads. This bypasses Google OAuth popup entirely.
 *
 * How it works:
 * 1. The app checks `window.__E2E_AUTH_USER__` before initializing Firebase auth
 * 2. If set (via env VITE_E2E_TEST=true), AuthContext uses this mock user
 * 3. Tests set localStorage items that Firebase Auth SDK reads
 */

const TEST_USER = {
  uid: 'e2e-test-user-001',
  email: 'e2e-admin@metalmaster-test.com',
  displayName: 'E2E Test Admin',
  photoURL: '',
  emailVerified: true,
};

/**
 * Seed Firestore Auth persistence keys so Firebase SDK thinks the user is logged in.
 * This matches the format Firebase Auth uses with `browserLocalPersistence`.
 */
async function injectAuthState(page: Page): Promise<void> {
  // Navigate to origin first (needed to set localStorage for this origin)
  await page.goto('/');
  
  // Inject the E2E mock user flag before the app reads it  
  await page.evaluate((user) => {
    // Set the E2E flag that AuthContext reads
    (window as any).__E2E_AUTH_USER__ = user;
    
    // Store in localStorage for persistence across navigations
    localStorage.setItem('e2e_auth_user', JSON.stringify(user));
  }, TEST_USER);
}

/**
 * Wait for the app to fully load past the auth loading screen.
 */
async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the loading spinner to disappear OR sidebar to appear
  // The sidebar contains "Metal ERP" text
  await page.waitForSelector('aside', { timeout: 30_000 });
}

// ─── Custom Test Fixtures ────────────────────────────────────

type AuthFixtures = {
  /** An authenticated page — already logged in as admin */
  authedPage: Page;
};

/**
 * Extended Playwright test with auto-auth.
 * 
 * Usage:
 * ```ts
 * import { test, expect } from '../fixtures/auth';
 * 
 * test('my test', async ({ authedPage }) => {
 *   // authedPage is already authenticated
 *   await authedPage.getByText('Дашборд').click();
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    await injectAuthState(page);
    // Reload so app reads the injected auth state
    await page.reload();
    await waitForAppReady(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { TEST_USER };
