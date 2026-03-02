/**
 * Centralized Logger Utility
 * 
 * Replaces raw console.log/warn/error across the codebase.
 * - In DEV mode: logs everything to console with prefixes
 * - In PROD mode: only logs warnings and errors
 * - Supports pluggable error reporter (e.g. Sentry)
 * 
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('MyService', 'Operation completed', { id: '123' });
 *   logger.error('MyService', 'Failed to save', error);
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ErrorReporter = (context: string, message: string, data: unknown[]) => void;

interface Logger {
  debug: (context: string, message: string, ...data: unknown[]) => void;
  info: (context: string, message: string, ...data: unknown[]) => void;
  warn: (context: string, message: string, ...data: unknown[]) => void;
  error: (context: string, message: string, ...data: unknown[]) => void;
  /** Register an external error reporter (e.g. Sentry). Called on error() and warn(). */
  setErrorReporter: (reporter: ErrorReporter) => void;
}

let externalReporter: ErrorReporter | null = null;

function shouldLog(level: LogLevel): boolean {
  if (isDev) return true;
  // In production, only warn and error
  return level === 'warn' || level === 'error';
}

function formatPrefix(level: LogLevel, context: string): string {
  const icons: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };
  return `${icons[level]} [${context}]`;
}

export const logger: Logger = {
  debug(context: string, message: string, ...data: unknown[]) {
    if (!shouldLog('debug')) return;
    console.debug(formatPrefix('debug', context), message, ...data);
  },

  info(context: string, message: string, ...data: unknown[]) {
    if (!shouldLog('info')) return;
    console.log(formatPrefix('info', context), message, ...data);
  },

  warn(context: string, message: string, ...data: unknown[]) {
    if (!shouldLog('warn')) return;
    console.warn(formatPrefix('warn', context), message, ...data);
    externalReporter?.('WARN:' + context, message, data);
  },

  error(context: string, message: string, ...data: unknown[]) {
    if (!shouldLog('error')) return;
    console.error(formatPrefix('error', context), message, ...data);
    externalReporter?.('ERROR:' + context, message, data);
  },

  setErrorReporter(reporter: ErrorReporter) {
    externalReporter = reporter;
  },
};

/**
 * Install global unhandled error/rejection handlers.
 * Call once at app startup (e.g. in index.tsx).
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Global', 'Unhandled promise rejection', event.reason);
  });

  window.addEventListener('error', (event) => {
    logger.error('Global', 'Unhandled error', event.error || event.message);
  });
}

export default logger;
