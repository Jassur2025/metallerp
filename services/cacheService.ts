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

class CacheService {
  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - entry.timestamp > entry.ttl) {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      // If storage is full, try to clear old cache entries
      this.clearExpired();
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl
        };
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
      } catch (retryError) {
        console.error(`Cache set retry failed for key ${key}:`, retryError);
      }
    }
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  }

  /**
   * Clear all expired cache entries
   */
  clearExpired(): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const entry: CacheEntry<any> = JSON.parse(cached);
            if (now - entry.timestamp > entry.ttl) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // Invalid cache entry, remove it
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
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



