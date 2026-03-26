/**
 * deletePurchase — Callable Cloud Function (Задача B.4)
 *
 * Server-side soft-delete of a purchase with atomic:
 *   - Inventory reversal (product quantities reduced back)
 *   - Ledger СТОРНО (contra-entries with debit↔credit swap)
 *   - Journal event for audit trail
 *
 * CLIENT sends:
 *   - purchaseId: string
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertString, safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";
import type { LedgerEntryData } from "../utils/finance";

// ─── Cloud Function ─────────────────────────────────────────

export const deletePurchase = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: false,
    cors: true,
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
      throw new HttpsError("permission-denied", "Only admins can delete purchases");
    }

    // 2. Rate limit
    await checkRateLimit(uid, "processPayment");

    // 3. Validate input
    const data = request.data as { purchaseId: string };
    assertString(data.purchaseId, "purchaseId");

    // 4. Atomic soft-delete with inventory reversal + СТОРНО
    const result = await db.runTransaction(async (tx) => {
      const purchaseRef = db.doc(`purchases/${data.purchaseId}`);
      const purchaseSnap = await tx.get(purchaseRef);

      if (!purchaseSnap.exists) {
        // Already deleted — idempotent
        return { alreadyDeleted: true, contraEntries: 0 };
      }

      const purchaseData = purchaseSnap.data()!;

      if (purchaseData._deleted) {
        // Already soft-deleted — idempotent
        return { alreadyDeleted: true, contraEntries: 0 };
      }

      const items = (purchaseData.items || []) as Array<{
        productId?: string;
        quantity?: number;
      }>;
      const supplierName = (purchaseData.supplierName || "") as string;
      const supplierId = (purchaseData.supplierId || "") as string;
      const totalLandedAmount = safeNum(purchaseData.totalLandedAmount);
      const amountPaidUSD = safeNum(purchaseData.amountPaidUSD);

      // 4a. Reverse product quantities (remove what was added by this purchase)
      const productUpdates = new Map<string, number>();
      for (const item of items) {
        if (item.productId && safeNum(item.quantity) > 0) {
          productUpdates.set(
            item.productId,
            (productUpdates.get(item.productId) || 0) + safeNum(item.quantity),
          );
        }
      }

      for (const [productId, qtyToRemove] of productUpdates) {
        const productRef = db.doc(`products/${productId}`);
        const productSnap = await tx.get(productRef);
        if (productSnap.exists) {
          const currentQty = safeNum(productSnap.data()!.quantity);
          const currentVersion = safeNum(productSnap.data()!._version);
          tx.update(productRef, {
            quantity: round2(Math.max(0, currentQty - qtyToRemove)),
            updatedAt: new Date().toISOString(),
            _version: currentVersion + 1,
          });
        }
      }

      // 4b. Reverse supplier debt + totalPurchases
      if (supplierId) {
        const supplierRef = db.doc(`suppliers/${supplierId}`);
        const supplierSnap = await tx.get(supplierRef);
        if (supplierSnap.exists) {
          const sData = supplierSnap.data()!;
          const currentDebt = safeNum(sData.totalDebt);
          const currentPurchases = safeNum(sData.totalPurchases);
          const currentVersion = safeNum(sData._version);
          // Reverse the debt portion that was added on purchase creation
          const debtPortion = round2(totalLandedAmount - amountPaidUSD);
          tx.update(supplierRef, {
            totalDebt: round2(Math.max(0, currentDebt - debtPortion)),
            totalPurchases: round2(Math.max(0, currentPurchases - totalLandedAmount)),
            updatedAt: Timestamp.now(),
            _version: currentVersion + 1,
          });
        }
      }

      // 5. Reverse ledger entries — СТОРНО (contra-entries inside transaction)
      const ledgerQuery = db
        .collection("ledgerEntries")
        .where("relatedType", "==", "purchase")
        .where("relatedId", "==", data.purchaseId);
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
          relatedType: "purchase" as const,
          relatedId: data.purchaseId,
          ...(entry.periodId && { periodId: entry.periodId }),
          createdBy: userEmail,
          createdAt: nowIso,
          _isContra: true,
          _contraOf: ledgerDoc.id,
        });
      }

      // 6. Soft-delete the purchase
      tx.update(purchaseRef, {
        _deleted: true,
        _deletedAt: nowIso,
        _deletedBy: userEmail,
        updatedAt: Timestamp.now(),
      });

      // 7. Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "purchase_deleted",
        description: `Закупка #${data.purchaseId} удалена (${supplierName}, $${round2(totalLandedAmount)}, сторно: ${ledgerSnaps.size} проводок)`,
        userId: uid,
        userEmail,
        metadata: {
          purchaseId: data.purchaseId,
          supplierName,
          totalLandedAmount: round2(totalLandedAmount),
          productsReversed: productUpdates.size,
          contraEntries: ledgerSnaps.size,
        },
        createdAt: nowIso,
      });

      return { alreadyDeleted: false, contraEntries: ledgerSnaps.size };
    });

    return {
      success: true,
      purchaseId: data.purchaseId,
      contraEntries: result.contraEntries,
    };
  },
);
