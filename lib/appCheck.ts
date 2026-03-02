/**
 * Firebase App Check — prevents unauthorized API access
 *
 * Uses reCAPTCHA Enterprise as the attestation provider in production.
 * In development/E2E mode, uses the debug provider which prints a debug token
 * to the console (register that token in Firebase Console → App Check → Apps → Manage debug tokens).
 *
 * Setup in Firebase Console:
 * 1. Go to App Check section
 * 2. Register your web app with reCAPTCHA Enterprise provider
 * 3. Copy the site key → set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY in .env
 * 4. For local dev: enable debug mode, register the debug token printed in console
 *
 * @see https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
 */

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getApp } from 'firebase/app';
import { logger } from '../utils/logger';

/**
 * Initialize Firebase App Check.
 * Call this ONCE at app startup (in main.tsx or App.tsx), after Firebase is initialized.
 *
 * Gracefully no-ops if site key is not configured.
 */
export function initializeAppCheckService(): void {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

  // Skip in E2E test mode — don't need App Check for test auth
  if (import.meta.env.VITE_E2E_TEST === 'true') {
    logger.info('AppCheck', 'Skipped — E2E test mode');
    return;
  }

  // In development, enable debug mode for the App Check debug provider
  if (import.meta.env.DEV) {
    // This tells Firebase to use the debug token instead of reCAPTCHA
    // The debug token will be printed to the console — register it in Firebase Console
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    logger.info('AppCheck', 'Debug mode enabled — check console for debug token');
  }

  if (!siteKey) {
    logger.warn(
      'AppCheck',
      'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY not set — App Check disabled. ' +
      'Set it in .env to enable protection against unauthorized API access.'
    );
    return;
  }

  try {
    const app = getApp();
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      // Automatically refresh the token before it expires
      isTokenAutoRefreshEnabled: true,
    });
    logger.info('AppCheck', 'Initialized with reCAPTCHA Enterprise');
  } catch (error) {
    // Non-fatal — app works without App Check, just less secure
    logger.error('AppCheck', 'Failed to initialize:', error);
  }
}
