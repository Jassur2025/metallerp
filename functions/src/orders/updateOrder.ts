/**
 * updateOrder — Callable Cloud Function
 *
 * Server-side order update with atomic:
 *   - Client debt + totalPurchases adjustment
 *   - Ledger СТОРНО (contra-entries) + new entries
 *   - Journal event for audit trail
 *
 * CLIENT sends:
 *   - orderId: string
 *   - updates: Partial<Order>
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertString, safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";
import {
  generateSaleLedgerEntries,
  type LedgerEntryData,
} from "../utils/finance";

interface UpdateOrderInput {
  orderId: string;
  updates: Record<string, unknown>;
}

// ─── Cloud Function ─────────────────────────────────────────

export const updateOrder = onCall(
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

    // 2. Rate limit
    await checkRateLimit(uid, "processPayment");

    // 3. Validate input
    const data = request.data as UpdateOrderInput;
    assertString(data.orderId, "orderId");
    if (!data.updates || typeof data.updates !== "object") {
      throw new HttpsError("invalid-argument", "updates must be an object");
    }

    // 4. Atomic transaction
    await db.runTransaction(async (tx) => {
      const orderRef = db.doc(`orders/${data.orderId}`);
      const orderSnap = await tx.get(orderRef);

      if (!orderSnap.exists) {
        throw new HttpsError("not-found", `Order ${data.orderId} not found`);
      }

      const oldOrder = orderSnap.data()!;
      if (oldOrder._deleted) {
        throw new HttpsError("failed-precondition", "Cannot update deleted order");
      }

      const mergedOrder = { ...oldOrder, ...data.updates };
      const nowIso = new Date().toISOString();

      // Only adjust debt/purchases for completed orders
      const isCompleted = oldOrder.status === "completed";
      const clientId = (mergedOrder.clientId as string) || undefined;

      if (isCompleted && clientId) {
        const oldTotal = safeNum(oldOrder.totalAmount);
        const newTotal = safeNum(mergedOrder.totalAmount);
        const oldPaid = safeNum(oldOrder.amountPaid);
        const newPaid = safeNum(mergedOrder.amountPaid);
        const oldDebtPortion = round2(oldTotal - oldPaid);
        const newDebtPortion = round2(newTotal - newPaid);

        if (oldTotal !== newTotal || oldPaid !== newPaid) {
          const clientRef = db.doc(`clients/${clientId}`);
          const clientSnap = await tx.get(clientRef);
          if (clientSnap.exists) {
            const clientData = clientSnap.data()!;
            const currentDebt = safeNum(clientData.totalDebt);
            const currentPurchases = safeNum(clientData.totalPurchases);

            const debtDelta = round2(newDebtPortion - oldDebtPortion);
            const purchasesDelta = round2(newTotal - oldTotal);

            tx.update(clientRef, {
              totalDebt: round2(Math.max(0, currentDebt + debtDelta)),
              totalPurchases: round2(Math.max(0, currentPurchases + purchasesDelta)),
              updatedAt: Timestamp.now(),
              _version: safeNum(clientData._version) + 1,
            });
          }
        }
      }

      // ── СТОРНО: reverse old ledger entries ───────────────
      const ledgerQuery = db
        .collection("ledgerEntries")
        .where("relatedType", "==", "order")
        .where("relatedId", "==", data.orderId);
      const ledgerSnaps = await tx.get(ledgerQuery);

      for (const ledgerDoc of ledgerSnaps.docs) {
        const entry = ledgerDoc.data() as LedgerEntryData;
        if ((entry as unknown as Record<string, unknown>)._isContra) continue;
        tx.set(db.collection("ledgerEntries").doc(), {
          date: entry.date,
          debitAccount: entry.creditAccount, // SWAP
          creditAccount: entry.debitAccount, // SWAP
          amount: entry.amount,
          ...(entry.amountUZS != null && { amountUZS: entry.amountUZS }),
          ...(entry.exchangeRate != null && { exchangeRate: entry.exchangeRate }),
          description: `СТОРНО: ${entry.description}`,
          relatedType: "order" as const,
          relatedId: data.orderId,
          ...(entry.periodId && { periodId: entry.periodId }),
          createdBy: userEmail,
          createdAt: nowIso,
          _isContra: true,
          _contraOf: ledgerDoc.id,
        });
      }

      // ── Create new ledger entries from merged order ──────
      const newTotal = safeNum(mergedOrder.totalAmount);
      if (newTotal > 0) {
        const newEntries = generateSaleLedgerEntries({
          orderId: data.orderId,
          customerName: (mergedOrder.customerName as string) || "",
          date: nowIso,
          revenueUSD: newTotal,
          totalCOGS: safeNum(mergedOrder.totalCOGS),
          vatAmount: safeNum(mergedOrder.vatAmount),
          exchangeRate: safeNum(mergedOrder.exchangeRate),
          totalAmountUZS: safeNum(mergedOrder.totalAmountUZS),
          paymentMethod: (mergedOrder.paymentMethod as string) || "cash",
          cashPaidUSD: safeNum(mergedOrder.amountPaid),
          debtUSD: round2(newTotal - safeNum(mergedOrder.amountPaid)),
          paymentCurrency: (mergedOrder.paymentCurrency as string) || "USD",
          createdBy: userEmail,
        });
        for (const entry of newEntries) {
          tx.set(db.collection("ledgerEntries").doc(), entry);
        }
      }

      // Update order document
      tx.update(orderRef, {
        ...data.updates,
        updatedAt: nowIso,
        _version: safeNum(oldOrder._version) + 1,
      });

      // Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "order_updated",
        description: `Заказ #${data.orderId} обновлён (сторно: ${ledgerSnaps.size} проводок)`,
        userId: uid,
        userEmail,
        metadata: { orderId: data.orderId, updates: data.updates },
        createdAt: nowIso,
      });
    });

    return { success: true, orderId: data.orderId };
  },
);
