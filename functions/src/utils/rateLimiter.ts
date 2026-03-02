/**
 * Simple per-user rate limiter using Firestore counters.
 *
 * Schema:   rateLimits/{uid}/functions/{functionName}
 * Document: { count: number, windowStart: Timestamp }
 *
 * Each window resets after `windowMs` milliseconds.
 * All operations use the Admin SDK (bypass client Firestore rules).
 */

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

interface RateLimitConfig {
  /** Maximum calls per window */
  maxCalls: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  commitSale: { maxCalls: 10, windowMs: 60_000 }, // 10/min
  commitPurchase: { maxCalls: 10, windowMs: 60_000 },
  processPayment: { maxCalls: 20, windowMs: 60_000 },
  computeBalance: { maxCalls: 1, windowMs: 60_000 }, // 1/min
};

/**
 * Check and increment the rate limit counter for a given user+function.
 * Throws `HttpsError('resource-exhausted', ...)` if limit exceeded.
 */
export async function checkRateLimit(
  uid: string,
  functionName: string,
  customConfig?: Partial<RateLimitConfig>,
): Promise<void> {
  const db = getFirestore();
  const config: RateLimitConfig = {
    ...DEFAULT_CONFIGS[functionName] || { maxCalls: 30, windowMs: 60_000 },
    ...customConfig,
  };

  const ref = db.doc(`rateLimits/${uid}/functions/${functionName}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      // First call — create counter
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }

    const data = snap.data()!;
    const windowStart = typeof data.windowStart === "number"
      ? data.windowStart
      : (data.windowStart as Timestamp)?.toMillis?.() || 0;
    const count = data.count || 0;

    // Window expired → reset
    if (now - windowStart >= config.windowMs) {
      tx.update(ref, { count: 1, windowStart: now });
      return;
    }

    // Within window — check limit
    if (count >= config.maxCalls) {
      const retryAfterSec = Math.ceil((windowStart + config.windowMs - now) / 1000);
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit exceeded for ${functionName}. ` +
        `Max ${config.maxCalls} calls per ${config.windowMs / 1000}s. ` +
        `Retry after ${retryAfterSec}s.`,
      );
    }

    // Increment
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}
