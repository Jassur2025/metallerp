/**
 * Unit tests for batchWriter (generateDeterministicId) and logger utilities
 *
 * Covers:
 *  - generateDeterministicId — determinism, format, different inputs
 *  - logger — level filtering, console method routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDeterministicId } from '../../utils/batchWriter';

// ─── generateDeterministicId ────────────────────────────────────────────────

describe('generateDeterministicId', () => {
  it('returns string starting with id_', () => {
    const id = generateDeterministicId('test-input');
    expect(id).toMatch(/^id_[0-9a-f]+$/);
  });

  it('is deterministic — same input gives same output', () => {
    const a = generateDeterministicId('hello world');
    const b = generateDeterministicId('hello world');
    expect(a).toBe(b);
  });

  it('different inputs produce different IDs', () => {
    const a = generateDeterministicId('input-1');
    const b = generateDeterministicId('input-2');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const id = generateDeterministicId('');
    expect(id).toBe('id_0');
  });

  it('handles special characters', () => {
    const id = generateDeterministicId('кириллица & symbols! @#$');
    expect(id).toMatch(/^id_[0-9a-f]+$/);
  });

  it('handles long strings', () => {
    const long = 'x'.repeat(10000);
    const id = generateDeterministicId(long);
    expect(id).toMatch(/^id_/);
  });
});

// ─── logger ─────────────────────────────────────────────────────────────────

describe('logger', () => {
  // We need to test with a fresh import to control isDev
  // Since isDev reads import.meta.env.DEV which is true in test (vitest),
  // all levels should log in test mode

  let logger: typeof import('../../utils/logger').logger;

  beforeEach(async () => {
    // Re-import to get fresh module
    const mod = await import('../../utils/logger');
    logger = mod.logger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.error calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('TestCtx', 'something failed', { detail: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[TestCtx]');
    expect(spy.mock.calls[0][1]).toBe('something failed');
  });

  it('logger.warn calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('Ctx', 'warning msg');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain('[Ctx]');
  });

  it('logger.info calls console.log in dev mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('Ctx', 'info msg');
    // In vitest (DEV=true), should log
    expect(spy).toHaveBeenCalled();
  });

  it('logger.debug calls console.debug in dev mode', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('Ctx', 'debug msg');
    expect(spy).toHaveBeenCalled();
  });

  it('passes extra data arguments through', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Ctx', 'msg', 'extra1', { extra2: true });
    expect(spy.mock.calls[0].length).toBe(4); // prefix, msg, extra1, extra2
  });
});
