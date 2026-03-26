/**
 * processPayment — Callable Cloud Function (Задача 6.2)
 *
 * Atomically creates a payment transaction and updates client/supplier debt.
 * Supports: client_payment, supplier_payment, debt_obligation, client_return,
 *           client_refund, expense.
 *
 * CLIENT sends:
 *   - type: transaction type
 *   - amount: number (in `currency`)
 *   - currency: 'USD' | 'UZS'
 *   - method: 'cash' | 'bank' | 'card' | 'debt'
 *   - relatedId?: string (clientId or supplierId)
 *   - orderId?: string
 *   - description?: string
 *   - exchangeRate?: number (if UZS, default from settings)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  assertString,
  assertOneOf,
  assertPositiveNumber,
  safeNum,
  round2,
} from "../utils/validation";
import { AccountCode, cashAccount, LedgerEntryData } from "../utils/finance";
import { checkRateLimit } from "../utils/rateLimiter";
import { checkIdempotencyKey, writeIdempotencyKey, isValidRequestId } from "../utils/idempotency";

// ─── Types ──────────────────────────────────────────────────

const TX_TYPES = [
  "client_payment",
  "supplier_payment",
  "client_return",
  "debt_obligation",
  "client_refund",
  "expense",
] as const;
type TxType = (typeof TX_TYPES)[number];

const CURRENCIES = ["USD", "UZS"] as const;
const METHODS = ["cash", "bank", "card", "debt"] as const;

interface ProcessPaymentInput {
  type: TxType;
  amount: number;
  currency: "USD" | "UZS";
  method: "cash" | "bank" | "card" | "debt";
  relatedId?: string;
  orderId?: string;
  supplierId?: string; // Required for supplier_payment (resolves supplier for debt update)
  description?: string;
  exchangeRate?: number;
  requestId?: string; // Idempotency key (UUID v4) — prevents duplicate payments
}

function generateTransactionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TX-${ts}-${rand}`;
}

/** Convert amount to USD */
function toUSD(amount: number, currency: string, exchangeRate: number): number {
  if (currency === "UZS" && exchangeRate > 0) {
    return round2(amount / exchangeRate);
  }
  return round2(amount);
}

// ─── Cloud Function ─────────────────────────────────────────

export const processPayment = onCall(
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

    // Check admin or active employee
    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      const empDoc = await db.doc(`employees/${uid}`).get();
      if (!empDoc.exists || empDoc.data()?.status === "inactive") {
        throw new HttpsError("permission-denied", "Insufficient permissions");
      }
    }

    // 2. Rate limiting
    await checkRateLimit(uid, "processPayment");

    // 3. Validate input
    const data = request.data as ProcessPaymentInput;
    assertOneOf(data.type, TX_TYPES, "type");
    assertPositiveNumber(data.amount, "amount");
    assertOneOf(data.currency, CURRENCIES, "currency");
    assertOneOf(data.method, METHODS, "method");

    // relatedId required for debt-affecting types
    const debtTypes: string[] = ["client_payment", "debt_obligation", "client_return", "client_refund"];
    if (debtTypes.includes(data.type)) {
      assertString(data.relatedId, "relatedId");
    }

    const nowIso = new Date().toISOString();
    const txId = generateTransactionId();

    // 3b. Idempotency: validate requestId format if provided
    const requestId = data.requestId;
    if (requestId !== undefined && !isValidRequestId(requestId)) {
      throw new HttpsError("invalid-argument", "requestId must be a valid UUID v4");
    }

    // 4. Atomic transaction
    const result = await db.runTransaction(async (tx) => {
      // ── Idempotency check ───────────────────────────────
      if (requestId) {
        const cached = await checkIdempotencyKey<{
          txId: string;
          type: string;
          amountUSD: number;
          amountOriginal: number;
          currency: string;
          exchangeRate: number;
          method: string;
          relatedId?: string;
          debtDelta: number;
          createdBy: string;
          date: string;
        }>(tx, db, requestId);
        if (cached) {
          return { ...cached, _idempotent: true as const };
        }
      }

      // Read settings for exchange rate
      const settingsSnap = await tx.get(db.doc("settings/general"));
      const settings = settingsSnap.exists ? settingsSnap.data()! : {};
      const exchangeRate = safeNum(data.exchangeRate) || safeNum(settings.defaultExchangeRate) || 12800;

      const amountUSD = toUSD(data.amount, data.currency, exchangeRate);

      // Read related entity (client or supplier) if applicable
      let debtDelta = 0;
      let entityRef: FirebaseFirestore.DocumentReference | null = null;
      let entityData: FirebaseFirestore.DocumentData | null = null;

      if (data.type === "supplier_payment" && data.supplierId) {
        // Supplier payment: use explicit supplierId
        const supplierRef = db.doc(`suppliers/${data.supplierId}`);
        const supplierSnap = await tx.get(supplierRef);
        if (supplierSnap.exists) {
          entityRef = supplierRef;
          entityData = supplierSnap.data()!;
        }
      } else if (data.relatedId) {
        // Try clients first, then suppliers
        const clientRef = db.doc(`clients/${data.relatedId}`);
        const clientSnap = await tx.get(clientRef);
        if (clientSnap.exists) {
          entityRef = clientRef;
          entityData = clientSnap.data()!;
        } else if (data.type === "supplier_payment") {
          const supplierRef = db.doc(`suppliers/${data.relatedId}`);
          const supplierSnap = await tx.get(supplierRef);
          if (supplierSnap.exists) {
            entityRef = supplierRef;
            entityData = supplierSnap.data()!;
          }
        }
      }

      // Compute debt delta
      switch (data.type) {
        case "client_payment":
          debtDelta = -amountUSD; // Reduces client debt
          break;
        case "debt_obligation":
          debtDelta = amountUSD; // Increases client debt
          break;
        case "client_return":
          debtDelta = amountUSD; // Restoring debt (return = undo payment)
          break;
        case "client_refund":
          debtDelta = -amountUSD; // Reducing debt (refund = undo debt)
          break;
        case "supplier_payment":
          debtDelta = -amountUSD; // Reduces supplier debt
          break;
        default:
          debtDelta = 0;
      }

      // ── Write phase ─────────────────────────────────────

      // Create transaction document
      tx.set(db.doc(`transactions/${txId}`), {
        id: txId,
        type: data.type,
        amount: amountUSD,
        amountOriginal: data.amount,
        currency: data.currency,
        exchangeRate,
        method: data.method,
        relatedId: data.relatedId || null,
        orderId: data.orderId || null,
        supplierId: data.supplierId || null,
        description: data.description || "",
        date: nowIso,
        createdBy: userEmail,
        createdAt: Timestamp.now(),
        updatedAt: nowIso,
        _version: 1,
      });

      // Update entity debt if applicable
      if (entityRef && entityData && debtDelta !== 0) {
        const currentDebt = safeNum(entityData.totalDebt);
        const currentVersion = safeNum(entityData._version);
        tx.update(entityRef, {
          totalDebt: round2(Math.max(0, currentDebt + debtDelta)),
          updatedAt: Timestamp.now(),
          _version: currentVersion + 1,
        });
      }

      // Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "payment_processed",
        description: `Транзакция #${txId} — ${data.type} — $${amountUSD}`,
        userId: uid,
        userEmail,
        metadata: { txId, type: data.type, amountUSD, relatedId: data.relatedId },
        createdAt: nowIso,
      });

      // 5. Write ledger entries INSIDE transaction (atomic with business data)
      const ledgerEntries: LedgerEntryData[] = [];

      if (data.type === "client_payment" && amountUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: cashAccount(data.method, data.currency),
          creditAccount: AccountCode.ACCOUNTS_RECEIVABLE,
          amount: amountUSD,
          exchangeRate,
          description: `Оплата от клиента: ${txId}`,
          relatedType: "transaction",
          relatedId: txId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      } else if (data.type === "supplier_payment" && amountUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.ACCOUNTS_PAYABLE,
          creditAccount: cashAccount(data.method, data.currency),
          amount: amountUSD,
          exchangeRate,
          description: `Оплата поставщику: ${txId}`,
          relatedType: "transaction",
          relatedId: txId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      } else if (data.type === "expense" && amountUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.ADMIN_EXPENSES,
          creditAccount: cashAccount(data.method, data.currency),
          amount: amountUSD,
          exchangeRate,
          description: `Расход: ${txId}`,
          relatedType: "transaction",
          relatedId: txId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      } else if (data.type === "client_return" && amountUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.ACCOUNTS_RECEIVABLE,
          creditAccount: cashAccount(data.method, data.currency),
          amount: amountUSD,
          exchangeRate,
          description: `Возврат клиенту: ${txId}`,
          relatedType: "transaction",
          relatedId: txId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      } else if (data.type === "client_refund" && amountUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.REVENUE,
          creditAccount: AccountCode.ACCOUNTS_RECEIVABLE,
          amount: amountUSD,
          exchangeRate,
          description: `Возврат средств клиенту: ${txId}`,
          relatedType: "transaction",
          relatedId: txId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      }

      for (const entry of ledgerEntries) {
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      const txResult = {
        txId,
        type: data.type,
        amountUSD,
        amountOriginal: data.amount,
        currency: data.currency,
        exchangeRate,
        method: data.method,
        relatedId: data.relatedId,
        debtDelta,
        createdBy: userEmail,
        date: nowIso,
      };

      // Write idempotency key (inside transaction for atomicity)
      if (requestId) {
        writeIdempotencyKey(tx, db, requestId, "processPayment", uid, txResult as unknown as Record<string, unknown>);
      }

      return txResult;
    });

    return {
      success: true,
      txId: result.txId,
      amountUSD: result.amountUSD,
      type: result.type,
    };
  },
);
export {};
