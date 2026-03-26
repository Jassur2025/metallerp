/**
 * deleteFixedAsset — Callable Cloud Function (Задача B.7)
 *
 * Server-side soft-delete of a fixed asset with atomic:
 *   - Soft-delete (sets deletedAt timestamp instead of physical removal)
 *   - Derecognition ledger: remaining book value → expense (IAS 16.67)
 *   - Journal event for audit trail
 *
 * CLIENT sends:
 *   - assetId: string
 *
 * IAS 16.67: The carrying amount shall be derecognised on disposal
 * or when no future economic benefits are expected.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { assertString, safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";
import { AccountCode, type LedgerEntryData } from "../utils/finance";

// ─── Cloud Function ─────────────────────────────────────────

export const deleteFixedAsset = onCall(
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
      throw new HttpsError(
        "permission-denied",
        "Only admins can delete fixed assets",
      );
    }

    // 2. Validate input
    const data = request.data;
    assertString(data.assetId, "assetId");
    const assetId: string = data.assetId;

    // Rate limit
    await checkRateLimit(uid, "deleteFixedAsset");

    const nowIso = new Date().toISOString();

    // 3. Read asset inside transaction
    await db.runTransaction(async (tx) => {
      const assetRef = db.collection("fixedAssets").doc(assetId);
      const assetSnap = await tx.get(assetRef);

      if (!assetSnap.exists) {
        throw new HttpsError("not-found", `Asset ${assetId} not found`);
      }

      const assetData = assetSnap.data()!;

      // Already deleted?
      if (assetData.deletedAt) {
        throw new HttpsError("already-exists", "Asset already deleted");
      }

      const currentValue = safeNum(assetData.currentValue);
      const accumulatedDepreciation = safeNum(assetData.accumulatedDepreciation);
      const assetName = assetData.name || assetId;

      // 4. Soft-delete the asset
      tx.update(assetRef, {
        deletedAt: nowIso,
        deletedBy: userEmail,
      });

      // 5. Derecognition ledger entries (IAS 16.67)
      const ledgerEntries: LedgerEntryData[] = [];

      // If remaining book value > 0, recognize as expense (write-off loss)
      if (currentValue > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.DEPRECIATION_EXPENSE,
          creditAccount: AccountCode.ACCUM_DEPRECIATION,
          amount: round2(currentValue),
          description: `Списание ОС: ${assetName} — остаточная стоимость $${round2(currentValue)}`,
          relatedType: "depreciation",
          relatedId: assetId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      }

      for (const entry of ledgerEntries) {
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      // 6. Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "fixed_asset_deleted",
        description: `Списание ОС: ${assetName} (покупка: $${safeNum(assetData.purchaseCost)}, накоп. аморт.: $${round2(accumulatedDepreciation)}, ост. стоим.: $${round2(currentValue)})`,
        userId: uid,
        userEmail,
        metadata: {
          assetId,
          assetName,
          purchaseCost: safeNum(assetData.purchaseCost),
          accumulatedDepreciation: round2(accumulatedDepreciation),
          currentValue: round2(currentValue),
        },
        createdAt: nowIso,
      });
    });

    return { success: true, assetId };
  },
);
