/**
 * Cache service for Google Sheets data
 * Implements TTL-based caching to reduce API calls
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const CACHE_PREFIX = 'metal_erp_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default TTL
const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

class CacheService {
  // In-memory fallback to keep working when localStorage is mocked or unavailable
  private memoryStore = new Map<string, string>();

  private getCacheKey(key: string) {
    return `${CACHE_PREFIX}${key}`;
  }

  private getFromStorage(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key);
        if (value !== null && value !== undefined) {
          return value;
        }
      }
    } catch (error) {
      errorDev(`Cache get error for key ${key}:`, error);
    }

    return this.memoryStore.get(key) ?? null;
  }

  private setInStorage(key: string, value: string): void {
    let stored = false;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        stored = true;
      }
    } catch (error) {
      errorDev(`Cache set error for key ${key}:`, error);
    }

    // Always keep a memory copy so tests/mocks without real storage still work
    this.memoryStore.set(key, value);

    // If storage failed because it was full, try clearing expired entries once
    if (!stored) {
      this.clearExpired();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch (retryError) {
        errorDev(`Cache set retry failed for key ${key}:`, retryError);
      }
    }
  }

  private removeFromStorage(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      errorDev(`Cache remove error for key ${key}:`, error);
    }
    this.memoryStore.delete(key);
  }

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const cacheKey = this.getCacheKey(key);

    try {
      const cached = this.getFromStorage(cacheKey);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - entry.timestamp > entry.ttl) {
        this.removeFromStorage(cacheKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      errorDev(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    const cacheKey = this.getCacheKey(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.setInStorage(cacheKey, JSON.stringify(entry));
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    const cacheKey = this.getCacheKey(key);
    this.removeFromStorage(cacheKey);
  }

  /**
   * Clear all expired cache entries
   */
  clearExpired(): void {
    const now = Date.now();

    const keysToRemove: string[] = [];

    const storageKeys = new Set<string>();

    // Collect keys from localStorage if available
    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIX)) {
            storageKeys.add(key);
          }
        }
      }
    } catch {
      // Ignore storage iteration issues
    }

    // Collect keys from memory fallback
    this.memoryStore.forEach((_, key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        storageKeys.add(key);
      }
    });

    storageKeys.forEach(key => {
      try {
        const cached = this.getFromStorage(key);
        if (cached) {
          const entry: CacheEntry<unknown> = JSON.parse(cached);
          if (now - entry.timestamp > entry.ttl) {
            keysToRemove.push(key);
          }
        }
      } catch {
        // Invalid cache entry, remove it
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => this.removeFromStorage(key));
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    const storageKeys = new Set<string>();

    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIX)) {
            storageKeys.add(key);
          }
        }
      }
    } catch {
      // Ignore storage iteration issues
    }

    this.memoryStore.forEach((_, key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        storageKeys.add(key);
      }
    });

    storageKeys.forEach(key => this.removeFromStorage(key));
  }

  /**
   * Invalidate cache for specific key (force refresh)
   */
  invalidate(key: string): void {
    this.remove(key);
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

export const cacheService = new CacheService();

// Clear expired cache on service load
cacheService.clearExpired();






