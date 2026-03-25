/**
 * deleteOrder — Callable Cloud Function (Задача B.4)
 *
 * Server-side soft-delete of an order with atomic:
 *   - Inventory restoration (product quantities returned)
 *   - Client debt reversal (unpaid portion removed)
 *   - Client totalPurchases reversal
 *   - Ledger СТОРНО (contra-entries with debit↔credit swap)
 *   - Journal event for audit trail
 *
 * Only reverses inventory/debt for completed orders.
 *
 * CLIENT sends:
 *   - orderId: string
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertString, safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";
import type { LedgerEntryData } from "../utils/finance";

// ─── Cloud Function ─────────────────────────────────────────

export const deleteOrder = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: false,
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
      throw new HttpsError("permission-denied", "Only admins can delete orders");
    }

    // 2. Rate limit (reuse processPayment bucket)
    await checkRateLimit(uid, "processPayment");

    // 3. Validate input
    const data = request.data as { orderId: string };
    assertString(data.orderId, "orderId");

    // 4. Atomic soft-delete with inventory + debt reversal + СТОРНО
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.doc(`orders/${data.orderId}`);
      const orderSnap = await tx.get(orderRef);

      if (!orderSnap.exists) {
        // Already deleted — idempotent
        return { alreadyDeleted: true, contraEntries: 0 };
      }

      const orderData = orderSnap.data()!;

      if (orderData._deleted) {
        // Already soft-deleted — idempotent
        return { alreadyDeleted: true, contraEntries: 0 };
      }

      const status = orderData.status as string;
      const items = (orderData.items || []) as Array<{
        productId?: string;
        quantity?: number;
      }>;
      const clientId = orderData.clientId as string | undefined;
      const totalAmount = safeNum(orderData.totalAmount);
      const amountPaid = safeNum(orderData.amountPaid);

      // Only reverse completed orders (they had inventory deducted + debt created)
      if (status === "completed") {
        // 4a. Restore product quantities
        const productUpdates = new Map<string, number>();
        for (const item of items) {
          if (item.productId && safeNum(item.quantity) > 0) {
            productUpdates.set(
              item.productId,
              (productUpdates.get(item.productId) || 0) + safeNum(item.quantity),
            );
          }
        }

        for (const [productId, qtyToRestore] of productUpdates) {
          const productRef = db.doc(`products/${productId}`);
          const productSnap = await tx.get(productRef);
          if (productSnap.exists) {
            const currentQty = safeNum(productSnap.data()!.quantity);
            const currentVersion = safeNum(productSnap.data()!._version);
            tx.update(productRef, {
              quantity: round2(currentQty + qtyToRestore),
              updatedAt: new Date().toISOString(),
              _version: currentVersion + 1,
            });
          }
        }

        // 4b. Reverse client debt + totalPurchases
        if (clientId) {
          const clientRef = db.doc(`clients/${clientId}`);
          const clientSnap = await tx.get(clientRef);
          if (clientSnap.exists) {
            const clientData = clientSnap.data()!;
            const currentDebt = safeNum(clientData.totalDebt);
            const currentPurchases = safeNum(clientData.totalPurchases);
            const currentVersion = safeNum(clientData._version);

            // Debt portion = total - paid
            const debtPortion = round2(totalAmount - amountPaid);
            const newDebt = round2(Math.max(0, currentDebt - debtPortion));
            const newPurchases = round2(Math.max(0, currentPurchases - totalAmount));

            tx.update(clientRef, {
              totalDebt: newDebt,
              totalPurchases: newPurchases,
              updatedAt: Timestamp.now(),
              _version: currentVersion + 1,
            });
          }
        }
      }

      // 5. Reverse ledger entries — СТОРНО (contra-entries inside transaction)
      const ledgerQuery = db
        .collection("ledgerEntries")
        .where("relatedType", "==", "order")
        .where("relatedId", "==", data.orderId);
      const ledgerSnaps = await tx.get(ledgerQuery);

      const nowIso = new Date().toISOString();
      for (const ledgerDoc of ledgerSnaps.docs) {
        const entry = ledgerDoc.data() as LedgerEntryData;
        tx.set(db.collection("ledgerEntries").doc(), {
          date: entry.date,
          debitAccount: entry.creditAccount,   // SWAP
          creditAccount: entry.debitAccount,    // SWAP
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

      // 6. Soft-delete the order
      tx.update(orderRef, {
        _deleted: true,
        _deletedAt: nowIso,
        _deletedBy: userEmail,
        updatedAt: Timestamp.now(),
      });

      // 7. Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "order_deleted",
        description: `Заказ #${data.orderId} удалён (статус: ${status}, $${round2(totalAmount)}, сторно: ${ledgerSnaps.size} проводок)`,
        userId: uid,
        userEmail,
        metadata: {
          orderId: data.orderId,
          status,
          totalAmount: round2(totalAmount),
          amountPaid: round2(amountPaid),
          clientId: clientId || null,
          productsRestored: status === "completed" ? items.length : 0,
          contraEntries: ledgerSnaps.size,
        },
        createdAt: nowIso,
      });

      return { alreadyDeleted: false, contraEntries: ledgerSnaps.size };
    });

    return {
      success: true,
      orderId: data.orderId,
      contraEntries: result.contraEntries,
    };
  },
);
