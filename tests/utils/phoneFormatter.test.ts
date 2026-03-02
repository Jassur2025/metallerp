/**
 * Unit tests for phone formatting and validation utilities
 *
 * Covers:
 *  - cleanPhone
 *  - formatPhoneForTablet
 *  - validateUzbekistanPhone
 *  - checkAllPhones
 */

import { describe, it, expect } from 'vitest';
import {
  cleanPhone,
  formatPhoneForTablet,
  validateUzbekistanPhone,
  checkAllPhones,
} from '../../utils/phoneFormatter';

// ─── cleanPhone ─────────────────────────────────────────────────────────────

describe('cleanPhone', () => {
  it('removes spaces, dashes, parentheses, plus sign', () => {
    expect(cleanPhone('+998 (90) 123-45-67')).toBe('998901234567');
  });

  it('returns digits only from a clean number', () => {
    expect(cleanPhone('901234567')).toBe('901234567');
  });

  it('returns empty string for empty input', () => {
    expect(cleanPhone('')).toBe('');
  });

  it('removes letters and special chars', () => {
    expect(cleanPhone('abc123def')).toBe('123');
  });
});

// ─── formatPhoneForTablet ───────────────────────────────────────────────────

describe('formatPhoneForTablet', () => {
  it('formats 12-digit number with 998 prefix', () => {
    expect(formatPhoneForTablet('998901234567')).toBe('+998 90 123 45 67');
  });

  it('formats 9-digit number (without leading 8)', () => {
    expect(formatPhoneForTablet('901234567')).toBe('+998 90 123 45 67');
  });

  it('formats 9-digit number starting with 8 (old format)', () => {
    // 8 + 8-digit core => strips leading 8, adds +998
    expect(formatPhoneForTablet('890123456')).toBe('+998 90 123 45 6');
    // Actually 8XXXXXXXX (9 digits starting with 8) -> strips 8 -> 8 digits
    // The function slices(1) to get 8 digits, then formats
  });

  it('formats already-formatted input by cleaning first', () => {
    expect(formatPhoneForTablet('+998 90 123 45 67')).toBe('+998 90 123 45 67');
  });

  it('returns original for unrecognized formats', () => {
    expect(formatPhoneForTablet('123')).toBe('123');
  });

  it('handles 12-digit non-998 prefix', () => {
    // 12 digits not starting with 998 — still formats as generic 12-digit
    expect(formatPhoneForTablet('123456789012')).toBe('+123 45 678 90 12');
  });
});

// ─── validateUzbekistanPhone ────────────────────────────────────────────────

describe('validateUzbekistanPhone', () => {
  it('accepts valid 9-digit mobile (90-prefix)', () => {
    const result = validateUzbekistanPhone('901234567');
    expect(result.isValid).toBe(true);
    expect(result.formatted).toContain('+998');
  });

  it('accepts valid 12-digit with 998 prefix', () => {
    const result = validateUzbekistanPhone('998911234567');
    expect(result.isValid).toBe(true);
  });

  it('accepts all valid mobile prefixes', () => {
    const prefixes = ['90', '91', '93', '94', '95', '97', '98', '99', '70', '71', '77'];
    for (const prefix of prefixes) {
      const result = validateUzbekistanPhone(`${prefix}1234567`);
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects empty phone', () => {
    const result = validateUzbekistanPhone('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects invalid prefix (e.g. 80)', () => {
    const result = validateUzbekistanPhone('801234567');
    expect(result.isValid).toBe(false);
  });

  it('rejects too few digits', () => {
    const result = validateUzbekistanPhone('9012345');
    expect(result.isValid).toBe(false);
  });

  it('rejects numbers with invalid prefix after 998', () => {
    const result = validateUzbekistanPhone('998801234567');
    expect(result.isValid).toBe(false);
  });

  it('handles formatted input with spaces/dashes', () => {
    const result = validateUzbekistanPhone('+998 90 123-45-67');
    expect(result.isValid).toBe(true);
  });
});

// ─── checkAllPhones ─────────────────────────────────────────────────────────

describe('checkAllPhones', () => {
  it('categorizes valid phones', () => {
    const clients = [{ id: '1', name: 'A', phone: '901234567' }];
    const result = checkAllPhones(clients);
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('categorizes invalid phones', () => {
    const clients = [{ id: '1', name: 'A', phone: '111' }];
    const result = checkAllPhones(clients);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].error).toBeDefined();
  });

  it('categorizes missing phones', () => {
    const clients = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B', phone: '' },
      { id: '3', name: 'C', phone: '   ' },
    ];
    const result = checkAllPhones(clients);
    expect(result.missing).toHaveLength(3);
  });

  it('handles mixed clients', () => {
    const clients = [
      { id: '1', name: 'Valid', phone: '901234567' },
      { id: '2', name: 'Invalid', phone: '12' },
      { id: '3', name: 'Missing' },
    ];
    const result = checkAllPhones(clients);
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.missing).toHaveLength(1);
  });

  it('returns empty arrays for empty input', () => {
    const result = checkAllPhones([]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });
});
