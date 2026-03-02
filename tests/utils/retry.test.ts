/**
 * Unit tests for retry utility
 *
 * Covers:
 *  - withRetry — success, retries, exhaustion, shouldRetry filtering
 *  - sleep — delay behavior
 *  - withRetryDecorator — function wrapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, sleep, withRetryDecorator } from '../../utils/retry';

// ─── withRetry ──────────────────────────────────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first successful call', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100 });
    
    // Advance past the first retry delay
    await vi.advanceTimersByTimeAsync(200);
    
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting max retries', async () => {
    const error = new TypeError('Failed to fetch');
    const fn = vi.fn().mockRejectedValue(error);

    // Use real timers and very short delays so retries actually complete quickly
    vi.useRealTimers();

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 1 })
    ).rejects.toThrow('Failed to fetch');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries

    // Restore fake timers for remaining tests
    vi.useFakeTimers();
  });

  it('does not retry non-retryable errors (401)', async () => {
    const error = new Error('401 Unauthorized');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('401');
    expect(fn).toHaveBeenCalledTimes(1); // no retry
  });

  it('does not retry 403 errors', async () => {
    const error = new Error('403 PERMISSION_DENIED');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('403');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry 404 errors', async () => {
    const error = new Error('NOT_FOUND 404');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('NOT_FOUND');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 rate limit', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 QUOTA_EXCEEDED'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    await vi.advanceTimersByTimeAsync(500);
    
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 server error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      .mockResolvedValueOnce('done');

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 10 });
    await vi.advanceTimersByTimeAsync(500);
    
    const result = await promise;
    expect(result).toBe('done');
  });

  it('calls onRetry callback with correct args', async () => {
    const onRetry = vi.fn();
    const error = new TypeError('Failed to fetch');
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100, onRetry });
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, error, expect.any(Number));
  });

  it('respects custom shouldRetry', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom error'));

    await expect(
      withRetry(fn, { maxRetries: 3, shouldRetry: () => false })
    ).rejects.toThrow('custom error');
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxDelay cap', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 5000, maxDelay: 100, onRetry });
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    // All delays should be capped at maxDelay (100ms)
    for (const call of onRetry.mock.calls) {
      expect(call[2]).toBeLessThanOrEqual(100);
    }
  });
});

// ─── sleep ──────────────────────────────────────────────────────────────────

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after specified delay', async () => {
    let resolved = false;
    const p = sleep(500).then(() => { resolved = true; });
    
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    await p;
    expect(resolved).toBe(true);
  });
});

// ─── withRetryDecorator ─────────────────────────────────────────────────────

describe('withRetryDecorator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('wraps function with retry behavior', async () => {
    const inner = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(42);

    const wrapped = withRetryDecorator(inner, { maxRetries: 2, baseDelay: 10 });
    const promise = wrapped();
    await vi.advanceTimersByTimeAsync(500);
    
    const result = await promise;
    expect(result).toBe(42);
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
