/**
 * Utility functions for error handling and user-friendly error messages
 */

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Extracts a user-friendly error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message;
    
    // Firebase / Network errors
    if (msg.includes('UNAUTHENTICATED') || msg.includes('401') || msg.includes('токен доступа истек')) {
      return 'Сессия истекла. Пожалуйста, войдите заново.';
    }
    if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('недостаточно прав')) {
      return 'Недостаточно прав доступа. Проверьте настройки Firebase.';
    }
    if (msg.includes('NOT_FOUND') || msg.includes('404')) {
      return 'Ресурс не найден. Проверьте настройки.';
    }
    if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429')) {
      return 'Превышен лимит запросов. Попробуйте позже.';
    }
    if (msg.includes('INVALID_ARGUMENT') || msg.includes('400')) {
      return 'Неверные данные. Проверьте введенные значения.';
    }
    if (msg.includes('Network') || msg.includes('Failed to fetch') || msg.includes('network')) {
      return 'Ошибка сети. Проверьте подключение к интернету.';
    }
    
    return msg;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Произошла неизвестная ошибка. Попробуйте еще раз.';
};

/**
 * Formats error for logging
 */
export const formatErrorForLogging = (error: unknown, context?: string): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}] ` : '';
  const errorMessage = getErrorMessage(error);
  
  return `${timestamp} ${contextStr}${errorMessage}`;
};

/**
 * Checks if error is retryable
 */
export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const retryableCodes = ['QUOTA_EXCEEDED', 'DEADLINE_EXCEEDED', 'UNAVAILABLE'];
    return retryableCodes.some(code => error.message.includes(code));
  }
  return false;
};


