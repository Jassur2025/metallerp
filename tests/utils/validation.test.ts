/**
 * Unit tests for validation utilities
 *
 * Covers:
 *  - validateEmail
 *  - validatePhone
 *  - validateRequired
 *  - validatePositiveNumber
 *  - validateNonNegativeNumber
 *  - validateClient (composite)
 *  - validateEmployee (composite)
 *  - validateProduct (composite)
 *  - debounce
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateClient,
  validateEmployee,
  validateProduct,
  debounce,
} from '../../utils/validation';

// ─── validateEmail ──────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co')).toBe(true);
    expect(validateEmail('a@b.cc')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('no-at-sign')).toBe(false);
    expect(validateEmail('@missing-local.com')).toBe(false);
    expect(validateEmail('missing@.com')).toBe(false);
    expect(validateEmail('spaces in@email.com')).toBe(false);
  });

  it('returns false for undefined/empty', () => {
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

// ─── validatePhone ──────────────────────────────────────────────────────────

describe('validatePhone', () => {
  it('accepts valid phone numbers (9-15 digits)', () => {
    expect(validatePhone('901234567')).toBe(true);          // 9 digits
    expect(validatePhone('998901234567')).toBe(true);       // 12 digits
    expect(validatePhone('123456789012345')).toBe(true);    // 15 digits
  });

  it('accepts phones with formatting characters (spaces, dashes, parens)', () => {
    // Note: validatePhone strips spaces, dashes, parens but NOT '+'
    expect(validatePhone('(90) 123-45-67')).toBe(true);
    expect(validatePhone('901 234 567')).toBe(true);
  });

  it('rejects phone with + prefix (not stripped by regex)', () => {
    // '+' is NOT in the strip set, so +998... has a non-digit char
    expect(validatePhone('+998 90 123-45-67')).toBe(false);
  });

  it('rejects too short', () => {
    expect(validatePhone('12345678')).toBe(false);          // 8 digits
  });

  it('rejects too long', () => {
    expect(validatePhone('1234567890123456')).toBe(false);  // 16 digits
  });

  it('returns false for undefined/empty', () => {
    expect(validatePhone(undefined)).toBe(false);
    expect(validatePhone('')).toBe(false);
  });
});

// ─── validateRequired ───────────────────────────────────────────────────────

describe('validateRequired', () => {
  it('accepts non-empty strings', () => {
    expect(validateRequired('hello')).toBe(true);
    expect(validateRequired(' a ')).toBe(true);
  });

  it('rejects empty/blank strings', () => {
    expect(validateRequired('')).toBe(false);
    expect(validateRequired('   ')).toBe(false);
  });

  it('accepts finite numbers including 0', () => {
    expect(validateRequired(0)).toBe(true);
    expect(validateRequired(42)).toBe(true);
    expect(validateRequired(-5)).toBe(true);
  });

  it('rejects NaN and Infinity', () => {
    expect(validateRequired(NaN)).toBe(false);
    expect(validateRequired(Infinity)).toBe(false);
    expect(validateRequired(-Infinity)).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(validateRequired(null)).toBe(false);
    expect(validateRequired(undefined)).toBe(false);
  });
});

// ─── validatePositiveNumber ─────────────────────────────────────────────────

describe('validatePositiveNumber', () => {
  it('accepts positive numbers', () => {
    expect(validatePositiveNumber(1)).toBe(true);
    expect(validatePositiveNumber(0.001)).toBe(true);
    expect(validatePositiveNumber(999999)).toBe(true);
  });

  it('rejects zero and negative', () => {
    expect(validatePositiveNumber(0)).toBe(false);
    expect(validatePositiveNumber(-1)).toBe(false);
  });

  it('accepts positive string numbers', () => {
    expect(validatePositiveNumber('5')).toBe(true);
    expect(validatePositiveNumber('0.5')).toBe(true);
  });

  it('rejects non-numeric strings', () => {
    expect(validatePositiveNumber('abc')).toBe(false);
    expect(validatePositiveNumber('')).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(validatePositiveNumber(Infinity)).toBe(false);
  });
});

// ─── validateNonNegativeNumber ──────────────────────────────────────────────

describe('validateNonNegativeNumber', () => {
  it('accepts zero and positive', () => {
    expect(validateNonNegativeNumber(0)).toBe(true);
    expect(validateNonNegativeNumber(100)).toBe(true);
  });

  it('accepts string zero', () => {
    expect(validateNonNegativeNumber('0')).toBe(true);
  });

  it('rejects negative numbers', () => {
    expect(validateNonNegativeNumber(-1)).toBe(false);
    expect(validateNonNegativeNumber('-5')).toBe(false);
  });

  it('rejects NaN', () => {
    expect(validateNonNegativeNumber(NaN)).toBe(false);
  });
});

// ─── validateClient ─────────────────────────────────────────────────────────

describe('validateClient', () => {
  it('passes with valid data', () => {
    const result = validateClient({ name: 'Client A', phone: '901234567' });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when name is missing', () => {
    const result = validateClient({ phone: '901234567' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Имя обязательно для заполнения');
  });

  it('fails when phone is missing', () => {
    const result = validateClient({ name: 'Client A' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Телефон обязателен для заполнения');
  });

  it('fails on invalid phone format', () => {
    const result = validateClient({ name: 'A', phone: '12' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Некорректный формат телефона');
  });

  it('fails on invalid email if provided', () => {
    const result = validateClient({ name: 'A', phone: '901234567', email: 'bad' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Некорректный формат email');
  });

  it('allows missing email (optional)', () => {
    const result = validateClient({ name: 'A', phone: '901234567' });
    expect(result.isValid).toBe(true);
  });

  it('fails on negative creditLimit', () => {
    const result = validateClient({ name: 'A', phone: '901234567', creditLimit: -100 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Кредитный лимит должен быть неотрицательным числом');
  });

  it('accumulates multiple errors', () => {
    const result = validateClient({ email: 'bad', creditLimit: -1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // name, phone, email, creditLimit
  });
});

// ─── validateEmployee ───────────────────────────────────────────────────────

describe('validateEmployee', () => {
  it('passes with valid data', () => {
    const result = validateEmployee({ name: 'John', email: 'j@x.com', position: 'Dev' });
    expect(result.isValid).toBe(true);
  });

  it('fails when name missing', () => {
    const result = validateEmployee({ email: 'j@x.com', position: 'Dev' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Имя обязательно для заполнения');
  });

  it('fails when email invalid', () => {
    const result = validateEmployee({ name: 'John', email: 'bad', position: 'Dev' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Некорректный формат email');
  });

  it('fails when position missing', () => {
    const result = validateEmployee({ name: 'John', email: 'j@x.com' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Должность обязательна для заполнения');
  });

  it('fails on negative salary', () => {
    const result = validateEmployee({ name: 'J', email: 'j@x.com', position: 'Dev', salary: -1 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Зарплата должна быть неотрицательным числом');
  });
});

// ─── validateProduct ────────────────────────────────────────────────────────

describe('validateProduct', () => {
  it('passes with valid data', () => {
    const result = validateProduct({ name: 'Pipe 50x50', quantity: 10, pricePerUnit: 100, costPrice: 80 });
    expect(result.isValid).toBe(true);
  });

  it('fails when name missing', () => {
    const result = validateProduct({});
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Название товара обязательно для заполнения');
  });

  it('fails on negative quantity', () => {
    const result = validateProduct({ name: 'X', quantity: -1 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Количество должно быть неотрицательным числом');
  });

  it('fails on negative pricePerUnit', () => {
    const result = validateProduct({ name: 'X', pricePerUnit: -5 });
    expect(result.isValid).toBe(false);
  });

  it('fails on negative costPrice', () => {
    const result = validateProduct({ name: 'X', costPrice: -1 });
    expect(result.isValid).toBe(false);
  });

  it('fails on negative minStockLevel', () => {
    const result = validateProduct({ name: 'X', minStockLevel: -1 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Минимальный остаток должен быть неотрицательным числом');
  });

  it('allows zero values', () => {
    const result = validateProduct({ name: 'X', quantity: 0, pricePerUnit: 0, costPrice: 0, minStockLevel: 0 });
    expect(result.isValid).toBe(true);
  });
});

// ─── debounce ───────────────────────────────────────────────────────────────

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('delays execution by specified wait time', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on successive calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(100);
    debounced(); // reset
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the original function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('uses the latest arguments when called multiple times', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });
});
