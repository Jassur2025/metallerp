/**
 * Unit tests for errorHandler utility
 * 
 * To run: npm test -- errorHandler.test.ts
 */

import { describe, it, expect } from 'vitest';
import { getErrorMessage, isRetryableError } from '../../utils/errorHandler';

describe('errorHandler', () => {
  describe('getErrorMessage', () => {
    it('should return user-friendly message for PERMISSION_DENIED error', () => {
      const error = new Error('PERMISSION_DENIED: User does not have permission');
      const message = getErrorMessage(error);
      expect(message).toContain('Недостаточно прав доступа');
    });

    it('should return user-friendly message for NOT_FOUND error', () => {
      const error = new Error('NOT_FOUND: Spreadsheet not found');
      const message = getErrorMessage(error);
      expect(message).toContain('Таблица не найдена');
    });

    it('should return user-friendly message for UNAUTHENTICATED error', () => {
      const error = new Error('UNAUTHENTICATED: Token expired');
      const message = getErrorMessage(error);
      expect(message).toContain('Сессия истекла');
    });

    it('should return user-friendly message for QUOTA_EXCEEDED error', () => {
      const error = new Error('QUOTA_EXCEEDED: API quota exceeded');
      const message = getErrorMessage(error);
      expect(message).toContain('Превышен лимит запросов');
    });

    it('should return user-friendly message for INVALID_ARGUMENT error', () => {
      const error = new Error('INVALID_ARGUMENT: Invalid data');
      const message = getErrorMessage(error);
      expect(message).toContain('Неверные данные');
    });

    it('should return error message for unknown Error', () => {
      const error = new Error('Some unknown error');
      const message = getErrorMessage(error);
      expect(message).toBe('Some unknown error');
    });

    it('should return string as-is if error is a string', () => {
      const error = 'String error';
      const message = getErrorMessage(error);
      expect(message).toBe('String error');
    });

    it('should return default message for unknown error type', () => {
      const error = { some: 'object' };
      const message = getErrorMessage(error);
      expect(message).toContain('Произошла неизвестная ошибка');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for QUOTA_EXCEEDED error', () => {
      const error = new Error('QUOTA_EXCEEDED: API quota exceeded');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for DEADLINE_EXCEEDED error', () => {
      const error = new Error('DEADLINE_EXCEEDED: Request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for UNAVAILABLE error', () => {
      const error = new Error('UNAVAILABLE: Service unavailable');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable error', () => {
      const error = new Error('PERMISSION_DENIED: Access denied');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for non-Error type', () => {
      expect(isRetryableError('string')).toBe(false);
      expect(isRetryableError({})).toBe(false);
    });
  });
});














