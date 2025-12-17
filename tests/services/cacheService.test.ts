/**
 * Unit tests for cacheService
 * 
 * To run: npm test -- cacheService.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheService } from '../../services/cacheService';

describe('cacheService', () => {
  beforeEach(() => {
    // Clear all cache before each test
    cacheService.clearAll();
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'removeItem');
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const testData = { name: 'test', value: 123 };
      cacheService.set('test-key', testData, 1000);
      
      const retrieved = cacheService.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent key', () => {
      const retrieved = cacheService.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired cache', () => {
      const testData = { name: 'test' };
      cacheService.set('test-key', testData, 100); // 100ms TTL
      
      // Wait for cache to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const retrieved = cacheService.get('test-key');
          expect(retrieved).toBeNull();
          resolve(undefined);
        }, 150);
      });
    });

    it('should use default TTL if not specified', () => {
      const testData = { name: 'test' };
      cacheService.set('test-key', testData);
      
      const retrieved = cacheService.get('test-key');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('remove', () => {
    it('should remove cache entry', () => {
      cacheService.set('test-key', { data: 'test' });
      cacheService.remove('test-key');
      
      const retrieved = cacheService.get('test-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true if cache exists and is valid', () => {
      cacheService.set('test-key', { data: 'test' });
      expect(cacheService.has('test-key')).toBe(true);
    });

    it('should return false if cache does not exist', () => {
      expect(cacheService.has('non-existent')).toBe(false);
    });

    it('should return false if cache is expired', () => {
      cacheService.set('test-key', { data: 'test' }, 100);
      
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cacheService.has('test-key')).toBe(false);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('clearAll', () => {
    it('should clear all cache entries', () => {
      cacheService.set('key1', { data: '1' });
      cacheService.set('key2', { data: '2' });
      
      cacheService.clearAll();
      
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('should remove specific cache entry', () => {
      cacheService.set('key1', { data: '1' });
      cacheService.set('key2', { data: '2' });
      
      cacheService.invalidate('key1');
      
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).not.toBeNull();
    });
  });
});









