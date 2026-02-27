/**
 * Unit tests for ID generator utilities
 *
 * Covers:
 *  - generateId — format, uniqueness, counter
 *  - IdGenerator named generators
 *  - isValidId — format validation
 *  - generateBatchIds — bulk generation, uniqueness
 */

import { describe, it, expect } from 'vitest';
import { generateId, IdGenerator, isValidId, generateBatchIds } from '../../utils/idGenerator';

// ─── generateId ─────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('generates string with correct prefix', () => {
    const id = generateId('ORD');
    expect(id).toMatch(/^ORD-/);
  });

  it('generates string without prefix when none given', () => {
    const id = generateId();
    expect(id).not.toMatch(/^[A-Z]+-/); // no prefix at start
    expect(id.split('-').length).toBe(3); // timestamp-random-counter
  });

  it('generates unique IDs on successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId('T'));
    }
    expect(ids.size).toBe(100);
  });

  it('has at least 10 characters', () => {
    const id = generateId('A');
    expect(id.length).toBeGreaterThanOrEqual(10);
  });

  it('contains timestamp, random, and counter parts', () => {
    const id = generateId('PFX');
    const parts = id.split('-');
    expect(parts.length).toBe(4); // PFX-timestamp-random-counter
    expect(parts[0]).toBe('PFX');
    expect(parts[3]).toMatch(/^\d{3,}$/); // counter is digits
  });
});

// ─── IdGenerator named generators ───────────────────────────────────────────

describe('IdGenerator', () => {
  it('generates order IDs with ORD prefix', () => {
    expect(IdGenerator.order()).toMatch(/^ORD-/);
  });

  it('generates product IDs with PRD prefix', () => {
    expect(IdGenerator.product()).toMatch(/^PRD-/);
  });

  it('generates client IDs with CLI prefix', () => {
    expect(IdGenerator.client()).toMatch(/^CLI-/);
  });

  it('generates transaction IDs with TRX prefix', () => {
    expect(IdGenerator.transaction()).toMatch(/^TRX-/);
  });

  it('generates expense IDs with EXP prefix', () => {
    expect(IdGenerator.expense()).toMatch(/^EXP-/);
  });

  it('generates purchase IDs with PUR prefix', () => {
    expect(IdGenerator.purchase()).toMatch(/^PUR-/);
  });

  it('generates employee IDs with EMP prefix', () => {
    expect(IdGenerator.employee()).toMatch(/^EMP-/);
  });

  it('generates journal IDs with JRN prefix', () => {
    expect(IdGenerator.journal()).toMatch(/^JRN-/);
  });

  it('generates journalEvent IDs with JE prefix', () => {
    expect(IdGenerator.journalEvent()).toMatch(/^JE-/);
  });

  it('generates workflow IDs with WFL prefix', () => {
    expect(IdGenerator.workflow()).toMatch(/^WFL-/);
  });

  it('generates fixedAsset IDs with AST prefix', () => {
    expect(IdGenerator.fixedAsset()).toMatch(/^AST-/);
  });

  it('generates supplier IDs with SUP prefix', () => {
    expect(IdGenerator.supplier()).toMatch(/^SUP-/);
  });

  it('generates note IDs with NTE prefix', () => {
    expect(IdGenerator.note()).toMatch(/^NTE-/);
  });

  it('generic generate() uses custom prefix', () => {
    expect(IdGenerator.generate('CUSTOM')).toMatch(/^CUSTOM-/);
  });
});

// ─── isValidId ──────────────────────────────────────────────────────────────

describe('isValidId', () => {
  it('accepts valid generated IDs', () => {
    const id = generateId('ORD');
    expect(isValidId(id)).toBe(true);
  });

  it('accepts IDs with expected prefix', () => {
    const id = generateId('ORD');
    expect(isValidId(id, 'ORD')).toBe(true);
  });

  it('rejects IDs with wrong prefix', () => {
    const id = generateId('ORD');
    expect(isValidId(id, 'CLI')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidId('')).toBe(false);
  });

  it('rejects short strings', () => {
    expect(isValidId('abc')).toBe(false);
    expect(isValidId('12345')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidId(null as unknown as string)).toBe(false);
    expect(isValidId(undefined as unknown as string)).toBe(false);
  });

  it('accepts old-style numeric IDs (13+ digits) but returns true', () => {
    // Old-style IDs are still "valid" (the function returns true, just warns)
    expect(isValidId('1234567890123')).toBe(true);
  });
});

// ─── generateBatchIds ───────────────────────────────────────────────────────

describe('generateBatchIds', () => {
  it('generates the requested number of IDs', () => {
    const ids = generateBatchIds('B', 5);
    expect(ids).toHaveLength(5);
  });

  it('all IDs have correct prefix', () => {
    const ids = generateBatchIds('TEST', 3);
    for (const id of ids) {
      expect(id).toMatch(/^TEST-/);
    }
  });

  it('all IDs are unique', () => {
    const ids = generateBatchIds('U', 200);
    const unique = new Set(ids);
    expect(unique.size).toBe(200);
  });

  it('returns empty array for count=0', () => {
    const ids = generateBatchIds('Z', 0);
    expect(ids).toHaveLength(0);
  });
});
