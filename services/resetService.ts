/**
 * Reset Service — DISABLED (P0 security fix).
 *
 * Client-side mass-delete of 7+ collections was a critical data-wipe vector.
 * Any authenticated user could call resetAllData() from DevTools.
 *
 * If you need to reset data for a new deployment, use:
 *   - Firebase Console → Firestore → Delete collection
 *   - Or a dedicated admin CLI script run from a trusted environment
 *
 * @deprecated Removed in Pre-IPO audit. Do NOT re-enable.
 */

/* istanbul ignore next — intentionally empty */
export async function resetAllData(): Promise<never> {
  throw new Error(
    '[SECURITY] resetAllData has been permanently disabled. ' +
    'Use Firebase Console for administrative data operations.',
  );
}

/** @deprecated Kept for backward compatibility; no-op. */
export const COLLECTION_LABELS: Record<string, string> = {};
