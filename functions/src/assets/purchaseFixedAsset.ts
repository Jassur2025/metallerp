/**
 * purchaseFixedAsset — Callable Cloud Function (Задача B.10)
 *
 * Server-side asset purchase with atomic:
 *   - Creates fixed asset document
 *   - Creates payment transaction (supplier_payment) if amountPaid > 0
 *   - Ledger entries:
 *       Дт 0100 (FIXED_ASSETS) / Кт 6010 (ACCOUNTS_PAYABLE) — full cost capitalization
 *       Дт 6010 (ACCOUNTS_PAYABLE) / Кт cash — paid amount
 *   - Journal event for audit trail
 *
 * CLIENT sends:
 *   - name: string
 *   - category: string (FixedAssetCategory value)
 *   - purchaseDate: string (ISO date)
 *   - purchaseCost: number (USD)
 *   - amountPaid: number (USD, 0..purchaseCost)
 *   - paymentMethod: 'cash' | 'bank' | 'card'
 *   - paymentCurrency: 'USD' | 'UZS'
 *   - exchangeRate: number
 *   - depreciationRate: number (annual %)
 *
 * IAS 16.15: Cost of an item of PPE shall be recognised as an asset.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { assertString, assertNonNegativeNumber, safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";
import { AccountCode, cashAccount, type LedgerEntryData } from "../utils/finance";

// ─── Cloud Function ─────────────────────────────────────────

export const purchaseFixedAsset = onCall(
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
      throw new HttpsError(
        "permission-denied",
        "Only admins can purchase fixed assets",
      );
    }

    // Rate limit
    await checkRateLimit(uid, "purchaseFixedAsset");

    // 2. Validate input
    const data = request.data;
    assertString(data.name, "name");
    assertString(data.category, "category");
    assertString(data.purchaseDate, "purchaseDate");

    const purchaseCost = safeNum(data.purchaseCost);
    const amountPaid = safeNum(data.amountPaid);
    const depreciationRate = safeNum(data.depreciationRate);
    const exchangeRate = safeNum(data.exchangeRate) || 12800;
    const paymentMethod: string = data.paymentMethod || "cash";
    const paymentCurrency: string = data.paymentCurrency || "UZS";

    if (purchaseCost <= 0) {
      throw new HttpsError("invalid-argument", "purchaseCost must be positive");
    }
    if (amountPaid < 0 || amountPaid > purchaseCost) {
      throw new HttpsError(
        "invalid-argument",
        "amountPaid must be between 0 and purchaseCost",
      );
    }

    const nowIso = new Date().toISOString();

    // Generate IDs
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const assetId = `FA-${ts}-${rand}`;
    const txId = `TX-${ts}-${rand}`;

    // 3. Firestore transaction: create asset + transaction + ledger + journal
    await db.runTransaction(async (tx) => {
      // 3a. Create fixed asset document
      const assetRef = db.collection("fixedAssets").doc(assetId);
      tx.set(assetRef, {
        id: assetId,
        name: data.name,
        category: data.category,
        purchaseDate: data.purchaseDate,
        purchaseCost,
        currentValue: purchaseCost,
        accumulatedDepreciation: 0,
        depreciationRate,
        paymentMethod,
        paymentCurrency,
        amountPaid,
        createdAt: Timestamp.now(),
        _version: 1,
      });

      // 3b. Create payment transaction if paid > 0
      if (amountPaid > 0) {
        const txRef = db.collection("transactions").doc(txId);
        const txAmount =
          paymentCurrency === "UZS"
            ? round2(amountPaid * exchangeRate)
            : amountPaid;

        tx.set(txRef, {
          id: txId,
          date: data.purchaseDate,
          type: "supplier_payment",
          amount: txAmount,
          currency: paymentCurrency,
          exchangeRate: paymentCurrency === "UZS" ? exchangeRate : null,
          method: paymentMethod,
          description: `Покупка ОС: ${data.name} (${data.category})${amountPaid < purchaseCost ? " (частичная оплата)" : ""}`,
          relatedId: assetId,
          createdAt: Timestamp.now(),
          _version: 1,
        });
      }

      // 3c. Ledger entries
      const ledgerEntries: LedgerEntryData[] = [];

      // Дт 0100 / Кт 6010 — Capitalize asset at full cost (IAS 16.15)
      ledgerEntries.push({
        date: nowIso,
        debitAccount: AccountCode.FIXED_ASSETS,
        creditAccount: AccountCode.ACCOUNTS_PAYABLE,
        amount: purchaseCost,
        exchangeRate,
        description: `Оприходование ОС: ${data.name} (${data.category})`,
        relatedType: "purchase",
        relatedId: assetId,
        createdBy: userEmail,
        createdAt: nowIso,
      });

      // Дт 6010 / Кт cash — Settle payable with payment
      if (amountPaid > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.ACCOUNTS_PAYABLE,
          creditAccount: cashAccount(paymentMethod, paymentCurrency),
          amount: amountPaid,
          exchangeRate,
          description: `Оплата за ОС: ${data.name}${amountPaid < purchaseCost ? " (частично)" : ""}`,
          relatedType: "purchase",
          relatedId: assetId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      }

      for (const entry of ledgerEntries) {
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      // 3d. Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "fixed_asset_purchased",
        description: `Покупка ОС: ${data.name} — $${purchaseCost}${amountPaid < purchaseCost ? ` (оплата: $${amountPaid})` : ""}`,
        userId: uid,
        userEmail,
        metadata: {
          assetId,
          name: data.name,
          category: data.category,
          purchaseCost,
          amountPaid,
          paymentMethod,
          transactionId: amountPaid > 0 ? txId : null,
        },
        createdAt: nowIso,
      });
    });

    return {
      assetId,
      transactionId: amountPaid > 0 ? txId : null,
      purchaseCost,
      amountPaid,
    };
  },
);
