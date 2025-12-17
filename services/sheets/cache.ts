import { cacheService } from '../cacheService';
import { errorDev, logDev, warnDev } from './logger';

export const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export async function cachedFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  useCache: boolean = true
): Promise<T> {
  if (useCache) {
    const cached = cacheService.get<T>(cacheKey);
    if (cached) {
      logDev(`📦 ${cacheKey} loaded from cache`);
      return cached;
    }
  }

  try {
    const data = await fetchFn();
    cacheService.set(cacheKey, data, CACHE_TTL);
    logDev(`📥 ${cacheKey} loaded from Google Sheets`);
    return data;
  } catch (e) {
    errorDev(`Failed to fetch ${cacheKey}`, e);
    const stale = cacheService.get<T>(cacheKey);
    if (stale) {
      warnDev(`⚠️ Using stale cache for ${cacheKey} due to fetch error`);
      return stale;
    }
    throw e;
  }
}



