/**
 * runDepreciation — Callable Cloud Function (Задача B.6)
 *
 * Server-side monthly depreciation with atomic:
 *   - Asset currentValue / accumulatedDepreciation updates
 *   - Ledger entries: Дт 9430 (DEPRECIATION_EXPENSE) / Кт 0200 (ACCUM_DEPRECIATION)
 *   - Journal event for audit trail
 *   - Idempotency: skips assets already depreciated for this month
 *
 * CLIENT sends: (no payload needed — operates on all fixed assets)
 *
 * IAS 16.55: Depreciation begins when asset is available for use.
 * IAS 16.6:  Depreciable amount = cost - residual value (residual = 0 here).
 * Method: Straight-line (IAS 16.62).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { checkRateLimit } from "../utils/rateLimiter";
import { safeNum, round2 } from "../utils/validation";
import { AccountCode, type LedgerEntryData } from "../utils/finance";

// ─── Cloud Function ─────────────────────────────────────────

export const runDepreciation = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: false,
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 60,
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
      throw new HttpsError(
        "permission-denied",
        "Only admins can run depreciation",
      );
    }

    // Rate limit: 1 per minute (prevent double-clicks)
    await checkRateLimit(uid, "runDepreciation", {
      maxCalls: 1,
      windowMs: 60_000,
    });

    // 2. Current month key for idempotency
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
    const nowIso = now.toISOString();
    const todayStr = nowIso.split("T")[0];

    // 3. Read all fixed assets
    const assetsSnap = await db.collection("fixedAssets").get();
    if (assetsSnap.empty) {
      return { depreciated: 0, totalDepreciation: 0, message: "No assets found" };
    }

    // 4. Calculate depreciation for each asset
    interface DepreciationItem {
      docId: string;
      name: string;
      depreciation: number;
      newCurrentValue: number;
      newAccumulated: number;
    }

    const items: DepreciationItem[] = [];

    for (const doc of assetsSnap.docs) {
      const data = doc.data();

      const depreciationRate = safeNum(data.depreciationRate);
      const currentValue = safeNum(data.currentValue);
      const purchaseCost = safeNum(data.purchaseCost);
      const accumulatedDepreciation = safeNum(data.accumulatedDepreciation);

      // Skip non-depreciable or fully depreciated
      if (depreciationRate === 0 || currentValue <= 0) continue;

      // IAS 16.55: Skip if not yet in service
      const purchaseDate = new Date(data.purchaseDate || "2020-01-01");
      const purchaseMonth = purchaseDate.getFullYear() * 12 + purchaseDate.getMonth();
      if (purchaseMonth > currentMonthIndex) continue;

      // Idempotency: skip if already depreciated this month
      const lastDepMonth = data.lastDepreciationMonth as string | undefined;
      if (lastDepMonth === currentMonthKey) continue;

      // IAS 16.6: Depreciable amount = cost - residual (residual = 0)
      const residualValue = 0;
      const depreciableAmount = Math.max(0, purchaseCost - residualValue);

      // Monthly rate = annual / 12 (straight-line)
      const monthlyRate = depreciationRate / 100 / 12;
      const depreciationAmount = depreciableAmount * monthlyRate;

      // Don't depreciate below residual value
      const maxDepreciation = Math.max(0, currentValue - residualValue);
      const actualDepreciation = round2(Math.min(depreciationAmount, maxDepreciation));

      if (actualDepreciation <= 0) continue;

      items.push({
        docId: doc.id,
        name: data.name || doc.id,
        depreciation: actualDepreciation,
        newCurrentValue: round2(currentValue - actualDepreciation),
        newAccumulated: round2(accumulatedDepreciation + actualDepreciation),
      });
    }

    if (items.length === 0) {
      return {
        depreciated: 0,
        totalDepreciation: 0,
        message: "All assets already depreciated for this month or fully depreciated",
      };
    }

    // 5. Firestore transaction: update assets + write ledger + journal
    // Firestore limit: 500 writes per transaction. Each asset = 1 update + 1 ledger entry.
    // Plus 1 journal event. Max assets = (500 - 1) / 2 = 249. That's fine for an ERP.
    const totalDep = round2(items.reduce((s, i) => s + i.depreciation, 0));

    await db.runTransaction(async (tx) => {
      // 5a. Update each asset
      for (const item of items) {
        const assetRef = db.collection("fixedAssets").doc(item.docId);
        tx.update(assetRef, {
          currentValue: item.newCurrentValue,
          accumulatedDepreciation: item.newAccumulated,
          lastDepreciationDate: todayStr,
          lastDepreciationMonth: currentMonthKey,
        });
      }

      // 5b. Create ledger entries — one per asset
      for (const item of items) {
        const entry: LedgerEntryData = {
          date: nowIso,
          debitAccount: AccountCode.DEPRECIATION_EXPENSE,
          creditAccount: AccountCode.ACCUM_DEPRECIATION,
          amount: item.depreciation,
          description: `Амортизация: ${item.name} (${currentMonthKey})`,
          relatedType: "depreciation",
          relatedId: item.docId,
          periodId: currentMonthKey,
          createdBy: userEmail,
          createdAt: nowIso,
        };
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      // 5c. Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "depreciation_run",
        description: `Амортизация за ${currentMonthKey} — ${items.length} активов — $${totalDep}`,
        userId: uid,
        userEmail,
        metadata: {
          monthKey: currentMonthKey,
          assetsCount: items.length,
          totalDepreciation: totalDep,
          items: items.map((i) => ({
            id: i.docId,
            name: i.name,
            amount: i.depreciation,
          })),
        },
        createdAt: nowIso,
      });
    });

    return {
      depreciated: items.length,
      totalDepreciation: totalDep,
      monthKey: currentMonthKey,
      message: `Depreciation applied to ${items.length} assets, total $${totalDep}`,
    };
  },
);
