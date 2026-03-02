/**
 * Idempotency Key Utilities for Cloud Functions.
 *
 * Prevents duplicate operations caused by double-clicks, network retries, etc.
 *
 * Pattern:
 *   1. Client generates a UUID (`requestId`) and sends it with each CF call.
 *   2. Inside `runTransaction`, read `idempotencyKeys/{requestId}`.
 *   3. If doc exists → return cached result (duplicate detected).
 *   4. If not → proceed with business logic, write idempotency key at end.
 *
 * The read inside `runTransaction` provides serializable isolation:
 * concurrent duplicates will contend on the same document lock.
 *
 * Keys auto-expire via TTL policy on `expiresAt` field (set in Firestore console).
 */

import { Timestamp } from "firebase-admin/firestore";

const IDEMPOTENCY_COLLECTION = "idempotencyKeys";

/** TTL: 24 hours from now */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyDoc {
  functionName: string;
  uid: string;
  result: Record<string, unknown>;
  createdAt: FirebaseFirestore.Timestamp;
  /** Firestore TTL field — set a TTL policy on this in Firebase Console */
  expiresAt: FirebaseFirestore.Timestamp;
}

/**
 * Check for an existing idempotency key inside a Firestore transaction.
 *
 * @returns The cached result if duplicate, or `null` if this is a new request.
 */
export async function checkIdempotencyKey<T extends Record<string, unknown>>(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  requestId: string,
): Promise<T | null> {
  const ref = db.doc(`${IDEMPOTENCY_COLLECTION}/${requestId}`);
  const snap = await tx.get(ref);

  if (snap.exists) {
    const data = snap.data() as IdempotencyDoc;
    return data.result as T;
  }

  return null;
}

/**
 * Write the idempotency key document inside the same Firestore transaction.
 * Must be called during the write phase of `runTransaction`.
 */
export function writeIdempotencyKey(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  requestId: string,
  functionName: string,
  uid: string,
  result: Record<string, unknown>,
): void {
  const ref = db.doc(`${IDEMPOTENCY_COLLECTION}/${requestId}`);
  const doc: IdempotencyDoc = {
    functionName,
    uid,
    result,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
  };
  tx.set(ref, doc);
}

/**
 * Validate a requestId format (UUID v4).
 * Returns true if valid, false if not.
 */
export function isValidRequestId(requestId: unknown): requestId is string {
  if (typeof requestId !== "string") return false;
  // Accept UUID v4 format: 8-4-4-4-12 hex chars
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
}
