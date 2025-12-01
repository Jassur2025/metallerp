/**
 * Utility functions for error handling and user-friendly error messages
 */

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Extracts a user-friendly error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Check for Google Sheets API errors
    if (error.message.includes('PERMISSION_DENIED')) {
      return 'Недостаточно прав доступа. Проверьте разрешения Google Sheets.';
    }
    if (error.message.includes('NOT_FOUND')) {
      return 'Таблица не найдена. Проверьте ID таблицы в настройках.';
    }
    if (error.message.includes('UNAUTHENTICATED')) {
      return 'Сессия истекла. Пожалуйста, войдите заново.';
    }
    if (error.message.includes('QUOTA_EXCEEDED')) {
      return 'Превышен лимит запросов к Google Sheets API. Попробуйте позже.';
    }
    if (error.message.includes('INVALID_ARGUMENT')) {
      return 'Неверные данные. Проверьте введенные значения.';
    }
    if (error.message.includes('Spreadsheet ID not set')) {
      return 'ID таблицы не установлен. Укажите ID в настройках.';
    }
    
    return error.message;
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


