/**
 * Utility для retry с exponential backoff
 * Обеспечивает устойчивость при сетевых ошибках и временных сбоях
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, nextDelay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error: unknown) => {
    // Retry на сетевые ошибки и некоторые HTTP ошибки
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return true; // Network error
    }
    
    if (error instanceof Error) {
      const message = error.message;
      // Retry на rate limit и временные ошибки
      if (message.includes('429') || message.includes('QUOTA_EXCEEDED')) return true;
      if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
      if (message.includes('ECONNRESET') || message.includes('ETIMEDOUT')) return true;
      // НЕ retry на авторизацию и пермишены
      if (message.includes('401') || message.includes('UNAUTHENTICATED')) return false;
      if (message.includes('403') || message.includes('PERMISSION_DENIED')) return false;
      if (message.includes('404') || message.includes('NOT_FOUND')) return false;
    }
    
    return false;
  },
  onRetry: () => {},
};

/**
 * Выполняет функцию с retry и exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const exponentialDelay = opts.baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelay);
      
      opts.onRetry(attempt + 1, error, delay);
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Обертка для fetch с retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, options);
    
    // Throw на retriable HTTP статусы чтобы retry сработал
    if (response.status === 429 || response.status >= 500) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
    }
    
    return response;
  }, retryOptions);
}

/**
 * Создает версию функции с retry
 */
export function withRetryDecorator<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: RetryOptions
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}
