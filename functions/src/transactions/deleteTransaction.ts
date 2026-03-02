/**
 * deleteTransaction — Callable Cloud Function (Задача 6.4)
 *
 * Server-side soft-delete with atomic debt reversal.
 * Reads the transaction INSIDE the Firestore transaction to prevent TOCTOU.
 *
 * CLIENT sends:
 *   - txId: string
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertString, safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";

// ─── Types ──────────────────────────────────────────────────

const DEBT_TYPES: string[] = ["client_payment", "debt_obligation", "client_return", "client_refund"];

/** Convert amount to USD */
function toUSD(tx: { amount?: number; currency?: string; exchangeRate?: number }): number {
  const amount = safeNum(tx.amount);
  if (tx.currency === "UZS" && tx.exchangeRate && tx.exchangeRate > 0) {
    return round2(amount / tx.exchangeRate);
  }
  return round2(amount);
}

// ─── Cloud Function ─────────────────────────────────────────

export const deleteTransaction = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: true,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    // 1. Auth + role check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const uid = request.auth.uid;
    const userEmail = request.auth.token.email || uid;

    const db = getFirestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can delete transactions");
    }

    // 2. Rate limit
    await checkRateLimit(uid, "processPayment");

    // 3. Validate input
    const data = request.data as { txId: string };
    assertString(data.txId, "txId");

    // 4. Atomic soft-delete with debt reversal
    await db.runTransaction(async (tx) => {
      // Read INSIDE transaction (prevents TOCTOU)
      const txRef = db.doc(`transactions/${data.txId}`);
      const txSnap = await tx.get(txRef);

      if (!txSnap.exists) {
        // Already deleted — idempotent
        return;
      }

      const txData = txSnap.data()!;

      if (txData._deleted) {
        // Already soft-deleted — idempotent
        return;
      }

      const txType = txData.type as string;
      const relatedId = txData.relatedId as string | undefined;

      // Reverse debt impact if applicable
      if (DEBT_TYPES.includes(txType) && relatedId) {
        const clientRef = db.doc(`clients/${relatedId}`);
        const clientSnap = await tx.get(clientRef);

        if (clientSnap.exists) {
          const currentDebt = safeNum(clientSnap.data()!.totalDebt);
          const amountUSD = toUSD(txData);
          const currentVersion = safeNum(clientSnap.data()!._version);
          let newDebt = currentDebt;

          if (txType === "client_payment") {
            // Deleting a payment → debt was NOT reduced
            newDebt = currentDebt + amountUSD;
          } else if (txType === "debt_obligation") {
            // Deleting a debt → debt was NOT added
            newDebt = Math.max(0, currentDebt - amountUSD);
          } else if (txType === "client_return") {
            // Deleting a return → debt was NOT increased
            newDebt = Math.max(0, currentDebt - amountUSD);
          } else if (txType === "client_refund") {
            // Deleting a refund → debt was NOT reduced
            newDebt = currentDebt + amountUSD;
          }

          tx.update(clientRef, {
            totalDebt: round2(newDebt),
            updatedAt: Timestamp.now(),
            _version: currentVersion + 1,
          });
        }
      }

      // Soft-delete the transaction (preserves audit trail)
      tx.update(txRef, {
        _deleted: true,
        _deletedAt: new Date().toISOString(),
        _deletedBy: userEmail,
        updatedAt: Timestamp.now(),
      });

      // Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "transaction_deleted",
        description: `Транзакция #${data.txId} удалена (${txType}, $${toUSD(txData)})`,
        userId: uid,
        userEmail,
        metadata: {
          txId: data.txId,
          type: txType,
          amount: toUSD(txData),
          relatedId,
        },
        createdAt: new Date().toISOString(),
      });
    });

    return { success: true, txId: data.txId };
  },
);
