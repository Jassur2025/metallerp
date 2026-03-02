/**
 * Sentry Error Monitoring — initialisation & helpers.
 *
 * Only activates in production (VITE_SENTRY_DSN must be set).
 * Integrates with the existing `logger.setErrorReporter()` hook so every
 * `logger.error()` / `logger.warn()` call is forwarded to Sentry automatically.
 */
import * as Sentry from '@sentry/react';
import { logger } from '../utils/logger';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** Whether Sentry is actually active (DSN present + production build). */
export const isSentryEnabled = !!DSN && import.meta.env.PROD;

/**
 * Call once at app startup (before React renders).
 * Safe to call even without a DSN — it simply no-ops.
 */
export function initSentry(): void {
  if (!isSentryEnabled) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[Sentry] Skipped — DEV mode or VITE_SENTRY_DSN not set');
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,           // 'production' | 'development'
    release: `metalmaster-erp@${__APP_VERSION__}`, // replaced by Vite define
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Performance — sample 20 % of transactions in prod
    tracesSampleRate: 0.2,
    // Session Replay — capture 10 % normally, 100 % on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Filter noisy errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Network Error',
      'Failed to fetch',
      'Load failed',
    ],
  });

  // Wire logger → Sentry so existing logger.error/warn calls report automatically
  logger.setErrorReporter((context, message, data) => {
    const error = data.find((d): d is Error => d instanceof Error);
    if (error) {
      Sentry.captureException(error, { tags: { context }, extra: { message, data } });
    } else {
      Sentry.captureMessage(`${context}: ${message}`, {
        level: context.startsWith('ERROR') ? 'error' : 'warning',
        extra: { data },
      });
    }
  });
}

/**
 * Identify the current user in Sentry after login.
 */
export function setSentryUser(email: string | null, displayName?: string | null): void {
  if (!isSentryEnabled) return;
  if (email) {
    Sentry.setUser({ email, username: displayName || undefined });
  } else {
    Sentry.setUser(null);
  }
}

// Re-export Sentry for direct use (ErrorBoundary, etc.)
export { Sentry };
