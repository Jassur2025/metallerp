/**
 * updateTransaction — Callable Cloud Function (Задача 6.3)
 *
 * Server-side transaction update with atomic debt reversal.
 * Prevents TOCTOU: reads old transaction inside Firestore transaction,
 * reverses old debt impact, applies new debt impact.
 *
 * CLIENT sends:
 *   - txId: string
 *   - updates: Partial<{ type, amount, currency, exchangeRate, method, relatedId, orderId, description }>
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  assertString,
  assertOneOf,
  safeNum,
  round2,
} from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";

// ─── Types ──────────────────────────────────────────────────

const TX_TYPES = [
  "client_payment",
  "supplier_payment",
  "client_return",
  "debt_obligation",
  "client_refund",
  "expense",
] as const;

const DEBT_TYPES: string[] = ["client_payment", "debt_obligation", "client_return", "client_refund"];

interface UpdateTxInput {
  txId: string;
  updates: {
    type?: string;
    amount?: number;
    currency?: string;
    exchangeRate?: number;
    method?: string;
    relatedId?: string;
    orderId?: string;
    description?: string;
  };
}

/** Convert amount to USD */
function toUSD(tx: { amount?: number; currency?: string; exchangeRate?: number }): number {
  const amount = safeNum(tx.amount);
  if (tx.currency === "UZS" && tx.exchangeRate && tx.exchangeRate > 0) {
    return round2(amount / tx.exchangeRate);
  }
  return round2(amount);
}

// ─── Cloud Function ─────────────────────────────────────────

export const updateTransaction = onCall(
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
      const empDoc = await db.doc(`employees/${uid}`).get();
      if (!empDoc.exists || empDoc.data()?.status === "inactive") {
        throw new HttpsError("permission-denied", "Insufficient permissions");
      }
    }

    // 2. Rate limit (shares processPayment quota)
    await checkRateLimit(uid, "processPayment");

    // 3. Validate input
    const data = request.data as UpdateTxInput;
    assertString(data.txId, "txId");
    if (!data.updates || typeof data.updates !== "object") {
      throw new HttpsError("invalid-argument", "updates must be an object");
    }

    // Validate type if provided
    if (data.updates.type) {
      assertOneOf(data.updates.type, TX_TYPES, "updates.type");
    }

    // 4. Atomic transaction with TOCTOU prevention
    await db.runTransaction(async (tx) => {
      // Read transaction INSIDE Firestore transaction
      const txRef = db.doc(`transactions/${data.txId}`);
      const txSnap = await tx.get(txRef);

      if (!txSnap.exists) {
        throw new HttpsError("not-found", `Transaction ${data.txId} not found`);
      }

      const oldTx = txSnap.data()!;
      if (oldTx._deleted) {
        throw new HttpsError("failed-precondition", "Cannot update deleted transaction");
      }

      const oldType = oldTx.type as string;
      const oldRelatedId = oldTx.relatedId as string | undefined;
      const oldAffectsDebt = DEBT_TYPES.includes(oldType) && !!oldRelatedId;

      const newType = (data.updates.type || oldType) as string;
      const newRelatedId = data.updates.relatedId ?? oldRelatedId;
      const newAffectsDebt = DEBT_TYPES.includes(newType) && !!newRelatedId;

      // If neither old nor new affects debt, simple update
      if (!oldAffectsDebt && !newAffectsDebt) {
        tx.update(txRef, {
          ...data.updates,
          updatedAt: new Date().toISOString(),
          updatedBy: userEmail,
          _version: safeNum(oldTx._version) + 1,
        });
        return;
      }

      // Track adjusted debt values for entities
      const debtAdjustments = new Map<string, number>();

      // Reverse old debt impact
      if (oldAffectsDebt && oldRelatedId) {
        const clientRef = db.doc(`clients/${oldRelatedId}`);
        const clientSnap = await tx.get(clientRef);
        if (clientSnap.exists) {
          const currentDebt = safeNum(clientSnap.data()!.totalDebt);
          const oldAmountUSD = toUSD(oldTx);
          let reversedDebt = currentDebt;

          if (oldType === "client_payment") {
            reversedDebt = currentDebt + oldAmountUSD; // Undo payment reduction
          } else if (oldType === "debt_obligation") {
            reversedDebt = Math.max(0, currentDebt - oldAmountUSD); // Undo debt addition
          } else if (oldType === "client_return") {
            reversedDebt = Math.max(0, currentDebt - oldAmountUSD); // Undo return
          } else if (oldType === "client_refund") {
            reversedDebt = currentDebt + oldAmountUSD; // Undo refund
          }

          debtAdjustments.set(oldRelatedId, reversedDebt);
          tx.update(clientRef, {
            totalDebt: round2(reversedDebt),
            updatedAt: Timestamp.now(),
            _version: safeNum(clientSnap.data()!._version) + 1,
          });
        }
      }

      // Apply new debt impact
      if (newAffectsDebt && newRelatedId) {
        const clientRef = db.doc(`clients/${newRelatedId}`);

        // If same entity, use the already-adjusted value; otherwise read fresh
        let currentDebt: number;
        let currentVersion: number;

        if (debtAdjustments.has(newRelatedId)) {
          currentDebt = debtAdjustments.get(newRelatedId)!;
          // Version was already incremented above for the same entity
          currentVersion = 0; // Skip version update below
        } else {
          const clientSnap = await tx.get(clientRef);
          if (!clientSnap.exists) {
            // Entity not found, skip debt update
            tx.update(txRef, {
              ...data.updates,
              updatedAt: new Date().toISOString(),
              updatedBy: userEmail,
              _version: safeNum(oldTx._version) + 1,
            });
            return;
          }
          currentDebt = safeNum(clientSnap.data()!.totalDebt);
          currentVersion = safeNum(clientSnap.data()!._version);
        }

        const mergedTx = { ...oldTx, ...data.updates };
        const newAmountUSD = toUSD(mergedTx);
        let newDebt = currentDebt;

        if (newType === "client_payment") {
          newDebt = Math.max(0, currentDebt - newAmountUSD);
        } else if (newType === "debt_obligation") {
          newDebt = currentDebt + newAmountUSD;
        } else if (newType === "client_return") {
          newDebt = currentDebt + newAmountUSD;
        } else if (newType === "client_refund") {
          newDebt = Math.max(0, currentDebt - newAmountUSD);
        }

        const updatePayload: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
          totalDebt: round2(newDebt),
          updatedAt: Timestamp.now(),
        };
        if (currentVersion > 0) {
          updatePayload._version = currentVersion + 1;
        }
        tx.update(clientRef, updatePayload);
      }

      // Update transaction document
      tx.update(txRef, {
        ...data.updates,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
        _version: safeNum(oldTx._version) + 1,
      });

      // Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "transaction_updated",
        description: `Транзакция #${data.txId} обновлена`,
        userId: uid,
        userEmail,
        metadata: { txId: data.txId, oldType, newType, updates: data.updates },
        createdAt: new Date().toISOString(),
      });
    });

    return { success: true, txId: data.txId };
  },
);
