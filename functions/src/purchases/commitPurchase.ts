/**
 * commitPurchase — Callable Cloud Function (Задача 6.1)
 *
 * SERVER reads product data, computes weighted-average cost,
 * updates inventory, creates purchase + supplier debt, writes
 * ledger entries — all in a single Firestore transaction.
 *
 * CLIENT sends:
 *   - items: Array<{ productId, quantity, invoicePrice (UZS with VAT), vatAmount (UZS) }>
 *   - supplierName: string
 *   - overheads: { logistics, customsDuty, importVat, other } (all UZS)
 *   - paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed'
 *   - paymentCurrency?: 'USD' | 'UZS'
 *   - amountPaid?: number (UZS)
 *   - warehouse?: 'main' | 'cloud'
 *
 * SERVER computes: exchangeRate, landedCost, weighted-avg costPrice, totals
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  assertString,
  assertArray,
  assertOneOf,
  assertPositiveNumber,
  assertNonNegativeNumber,
  safeNum,
  round2,
} from "../utils/validation";
import {
  weightedAvgCost,
  AccountCode,
  cashAccount,
  LedgerEntryData,
} from "../utils/finance";
import { checkRateLimit } from "../utils/rateLimiter";
import { checkIdempotencyKey, writeIdempotencyKey, isValidRequestId } from "../utils/idempotency";

// ─── Types ──────────────────────────────────────────────────

interface PurchaseItemInput {
  productId: string;
  quantity: number;
  invoicePrice: number; // UZS per unit WITH VAT
  vatAmount: number; // UZS VAT per unit
}

interface PurchaseOverheadsInput {
  logistics: number;
  customsDuty: number;
  importVat: number;
  other: number;
}

interface CommitPurchaseInput {
  items: PurchaseItemInput[];
  supplierName: string;
  supplierId?: string; // Optional — if not provided, auto-resolve by supplierName
  clientId?: string; // Optional — link to client when supplier is also a client
  overheads: PurchaseOverheadsInput;
  paymentMethod: "cash" | "bank" | "card" | "debt" | "mixed";
  paymentCurrency?: "USD" | "UZS";
  amountPaid?: number; // UZS
  warehouse?: "main" | "cloud";
  requestId?: string; // Idempotency key (UUID v4) — prevents duplicate purchases
}

const PAYMENT_METHODS = ["cash", "bank", "card", "debt", "mixed"] as const;
const PAYMENT_CURRENCIES = ["USD", "UZS"] as const;

function generatePurchaseId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PUR-${ts}-${rand}`;
}

function generateTransactionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TX-${ts}-${rand}`;
}

// ─── Cloud Function ─────────────────────────────────────────

export const commitPurchase = onCall(
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
      throw new HttpsError("permission-denied", "Only admins can create purchases");
    }

    // 2. Rate limiting
    await checkRateLimit(uid, "commitPurchase");

    // 3. Validate input
    const data = request.data as CommitPurchaseInput;
    assertArray(data.items, "items");
    assertString(data.supplierName, "supplierName");
    assertOneOf(data.paymentMethod, PAYMENT_METHODS, "paymentMethod");
    if (data.paymentCurrency) {
      assertOneOf(data.paymentCurrency, PAYMENT_CURRENCIES, "paymentCurrency");
    }

    for (const item of data.items) {
      assertString(item.productId, "item.productId");
      assertPositiveNumber(item.quantity, "item.quantity");
      assertPositiveNumber(item.invoicePrice, "item.invoicePrice");
      assertNonNegativeNumber(item.vatAmount, "item.vatAmount");
    }

    const overheads = data.overheads || { logistics: 0, customsDuty: 0, importVat: 0, other: 0 };
    const nowIso = new Date().toISOString();
    const purchaseId = generatePurchaseId();

    // 3b. Idempotency: validate requestId format if provided
    const requestId = data.requestId;
    if (requestId !== undefined && !isValidRequestId(requestId)) {
      throw new HttpsError("invalid-argument", "requestId must be a valid UUID v4");
    }

    // 4. Atomic Firestore transaction
    const result = await db.runTransaction(async (tx) => {
      // ── Idempotency check ───────────────────────────────
      if (requestId) {
        const cached = await checkIdempotencyKey<{
          purchaseId: string;
          totalLandedAmountUSD: number;
          totalInvoiceAmountUZS: number;
          totalVatAmountUZS: number;
          amountPaidUSD: number;
          exchangeRate: number;
          createdBy: string;
          date: string;
          supplierName: string;
          paymentMethod: string;
          paymentCurrency: string;
        }>(tx, db, requestId);
        if (cached) {
          return { ...cached, _idempotent: true as const };
        }
      }

      // ── Read phase ──────────────────────────────────────

      // Read settings
      const settingsSnap = await tx.get(db.doc("settings/general"));
      const settings = settingsSnap.exists ? settingsSnap.data()! : {};
      const exchangeRate = safeNum(settings.defaultExchangeRate) || 12800;

      // Resolve supplier (for debt tracking)
      let resolvedSupplierId: string | null = null;
      let supplierRef: FirebaseFirestore.DocumentReference | null = null;
      let supplierData: FirebaseFirestore.DocumentData | null = null;

      if (data.supplierId) {
        // Explicit supplierId provided
        supplierRef = db.doc(`suppliers/${data.supplierId}`);
        const supplierSnap = await tx.get(supplierRef);
        if (supplierSnap.exists) {
          resolvedSupplierId = data.supplierId;
          supplierData = supplierSnap.data()!;
        }
      } else {
        // Auto-resolve by name
        const supplierQuery = db.collection("suppliers")
          .where("name", "==", data.supplierName)
          .limit(1);
        const supplierSnaps = await tx.get(supplierQuery);
        if (!supplierSnaps.empty) {
          const doc = supplierSnaps.docs[0];
          resolvedSupplierId = doc.id;
          supplierRef = doc.ref;
          supplierData = doc.data();
        }
      }

      // Resolve client (when supplier is also a client — for netting/balance tracking)
      let resolvedClientId: string | null = null;
      let clientRef: FirebaseFirestore.DocumentReference | null = null;
      let clientData: FirebaseFirestore.DocumentData | null = null;

      if (data.clientId) {
        clientRef = db.doc(`clients/${data.clientId}`);
        const clientSnap = await tx.get(clientRef);
        if (clientSnap.exists) {
          resolvedClientId = data.clientId;
          clientData = clientSnap.data()!;
        }
      } else {
        // Auto-resolve client by supplierName
        const clientQuery = db.collection("clients")
          .where("name", "==", data.supplierName)
          .limit(1);
        const clientSnaps = await tx.get(clientQuery);
        if (!clientSnaps.empty) {
          const cDoc = clientSnaps.docs[0];
          resolvedClientId = cDoc.id;
          clientRef = cDoc.ref;
          clientData = cDoc.data();
        }
      }

      // Aggregate per-product
      const qtyByProduct = new Map<string, number>();
      for (const item of data.items) {
        qtyByProduct.set(
          item.productId,
          (qtyByProduct.get(item.productId) || 0) + item.quantity,
        );
      }

      // Read all products
      const productEntries = Array.from(qtyByProduct.entries());
      const productSnaps = await Promise.all(
        productEntries.map(([id]) => tx.get(db.doc(`products/${id}`))),
      );
      const productMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      for (let i = 0; i < productEntries.length; i++) {
        const [productId] = productEntries[i];
        const snap = productSnaps[i];
        if (!snap.exists) {
          throw new HttpsError("not-found", `Product ${productId} not found`);
        }
        productMap.set(productId, snap);
      }

      // ── Compute phase ─────────────────────────────────

      // Compute totals for overhead distribution
      const totalOverheadUZS = safeNum(overheads.logistics) + safeNum(overheads.customsDuty)
        + safeNum(overheads.importVat) + safeNum(overheads.other);
      const totalItemsInvoiceUZS = data.items.reduce(
        (s, it) => s + safeNum(it.invoicePrice) * safeNum(it.quantity), 0,
      );

      // Build purchase items with server-computed landed costs
      const purchaseItems: Array<Record<string, unknown>> = [];
      let totalLandedAmountUSD = 0;
      let totalInvoiceAmountUZS = 0;
      let totalVatAmountUZS = 0;

      for (const item of data.items) {
        const qty = safeNum(item.quantity);
        const invoicePrice = safeNum(item.invoicePrice); // UZS per unit WITH VAT
        const vatPerUnit = safeNum(item.vatAmount);
        const invoicePriceNoVat = invoicePrice - vatPerUnit;

        // Overhead distribution proportional to invoice amount
        const lineInvoiceUZS = invoicePrice * qty;
        const overheadShare = totalItemsInvoiceUZS > 0
          ? round2(totalOverheadUZS * lineInvoiceUZS / totalItemsInvoiceUZS)
          : 0;
        const landedCostPerUnit = round2(
          (invoicePriceNoVat + overheadShare / qty) / exchangeRate,
        );

        const snap = productMap.get(item.productId)!;
        const prd = snap.data()!;

        purchaseItems.push({
          productId: item.productId,
          productName: prd.name || "",
          dimensions: prd.dimensions || "",
          quantity: qty,
          unit: prd.unit || "м",
          invoicePrice,
          invoicePriceWithoutVat: invoicePriceNoVat,
          vatAmount: vatPerUnit * qty,
          landedCost: landedCostPerUnit,
          totalLineCost: round2(landedCostPerUnit * qty),
          totalLineCostUZS: round2(invoicePrice * qty),
          warehouse: data.warehouse || "main",
        });

        totalLandedAmountUSD += round2(landedCostPerUnit * qty);
        totalInvoiceAmountUZS += round2(invoicePrice * qty);
        totalVatAmountUZS += round2(vatPerUnit * qty);
      }

      totalLandedAmountUSD = round2(totalLandedAmountUSD);
      totalInvoiceAmountUZS = round2(totalInvoiceAmountUZS);
      totalVatAmountUZS = round2(totalVatAmountUZS);
      const totalWithoutVatUZS = round2(totalInvoiceAmountUZS - totalVatAmountUZS);

      // Payment logic
      const amountPaidUZS = data.paymentMethod === "debt" ? 0 : safeNum(data.amountPaid);
      const amountPaidUSD = round2(amountPaidUZS / exchangeRate);
      const paymentStatus = amountPaidUZS >= totalInvoiceAmountUZS ? "paid"
        : amountPaidUZS > 0 ? "partial" : "unpaid";

      // ── Write phase ─────────────────────────────────────

      // Update products: add stock + weighted avg cost
      for (const item of data.items) {
        const snap = productMap.get(item.productId)!;
        const prd = snap.data()!;
        const currentQty = safeNum(prd.quantity);
        const currentCost = safeNum(prd.costPrice);
        const currentVersion = safeNum(prd._version);
        const addedQty = safeNum(item.quantity);
        const vatPerUnit = safeNum(item.vatAmount);
        const invoiceNoVat = safeNum(item.invoicePrice) - vatPerUnit;
        const overheadSharePerUnit = totalItemsInvoiceUZS > 0
          ? totalOverheadUZS * safeNum(item.invoicePrice) / totalItemsInvoiceUZS / addedQty
          : 0;
        const newCostPerUnit = round2(
          (invoiceNoVat + overheadSharePerUnit) / exchangeRate,
        );

        tx.update(snap.ref, {
          quantity: round2(currentQty + addedQty),
          costPrice: weightedAvgCost(currentQty, currentCost, addedQty, newCostPerUnit),
          updatedAt: nowIso,
          _version: currentVersion + 1,
        });
      }

      // Update supplier debt + totalPurchases
      if (supplierRef && supplierData && resolvedSupplierId) {
        const currentDebt = safeNum(supplierData.totalDebt);
        const currentPurchases = safeNum(supplierData.totalPurchases);
        const currentVersion = safeNum(supplierData._version);
        const debtPortion = round2(totalLandedAmountUSD - amountPaidUSD);

        tx.update(supplierRef, {
          totalDebt: round2(Math.max(0, currentDebt + debtPortion)),
          totalPurchases: round2(currentPurchases + totalLandedAmountUSD),
          updatedAt: Timestamp.now(),
          _version: currentVersion + 1,
        });
      }

      // Update client's purchasesFromUs (track how much we bought from this client)
      if (clientRef && clientData && resolvedClientId) {
        const currentPurchasesFromClient = safeNum(clientData.totalPurchasesFromUs);
        const clientVersion = safeNum(clientData._version);

        tx.update(clientRef, {
          totalPurchasesFromUs: round2(currentPurchasesFromClient + totalLandedAmountUSD),
          updatedAt: Timestamp.now(),
          _version: clientVersion + 1,
        });
      }

      // Create purchase document
      const purchaseRef = db.doc(`purchases/${purchaseId}`);
      tx.set(purchaseRef, {
        id: purchaseId,
        date: nowIso,
        supplierName: data.supplierName,
        ...(resolvedSupplierId && { supplierId: resolvedSupplierId }),
        ...(resolvedClientId && { clientId: resolvedClientId }),
        status: "completed",
        items: purchaseItems,
        overheads: {
          logistics: safeNum(overheads.logistics),
          customsDuty: safeNum(overheads.customsDuty),
          importVat: safeNum(overheads.importVat),
          other: safeNum(overheads.other),
        },
        totalInvoiceAmountUZS,
        totalVatAmountUZS,
        totalWithoutVatUZS,
        totalInvoiceAmount: round2(totalInvoiceAmountUZS / exchangeRate),
        totalLandedAmount: totalLandedAmountUSD,
        exchangeRate,
        paymentMethod: data.paymentMethod,
        paymentCurrency: data.paymentCurrency || "UZS",
        paymentStatus,
        amountPaid: amountPaidUZS,
        amountPaidUSD,
        warehouse: data.warehouse || "main",
        createdBy: userEmail,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        _version: 1,
      });

      // Create payment transaction if paid
      if (amountPaidUSD > 0) {
        const txId = generateTransactionId();
        tx.set(db.doc(`transactions/${txId}`), {
          type: "supplier_payment",
          amount: amountPaidUSD,
          currency: "USD",
          method: data.paymentMethod === "mixed" ? "cash" : data.paymentMethod,
          relatedId: purchaseId,
          ...(resolvedSupplierId && { supplierId: resolvedSupplierId }),
          ...(resolvedClientId && { clientId: resolvedClientId }),
          description: `Оплата закупки #${purchaseId} (${data.supplierName})`,
          date: nowIso,
          createdAt: Timestamp.now(),
          updatedAt: nowIso,
          _version: 1,
        });
      }

      // Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "purchase_completed",
        description: `Закупка #${purchaseId} — ${data.supplierName} — $${totalLandedAmountUSD}`,
        userId: uid,
        userEmail,
        metadata: {
          purchaseId,
          supplierName: data.supplierName,
          totalLandedAmount: totalLandedAmountUSD,
          itemCount: data.items.length,
        },
        createdAt: nowIso,
      });

      // Write ledger entries INSIDE transaction (atomic with business data)
      const ledgerEntries: LedgerEntryData[] = [];

      // Дт 2900 Кт 6010 — Inventory receipt
      if (totalLandedAmountUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.INVENTORY,
          creditAccount: AccountCode.ACCOUNTS_PAYABLE,
          amount: totalLandedAmountUSD,
          amountUZS: totalInvoiceAmountUZS - totalVatAmountUZS,
          exchangeRate,
          description: `Оприходование: закупка #${purchaseId} (${data.supplierName})`,
          relatedType: "purchase",
          relatedId: purchaseId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      }

      // Дт 4410 Кт 6010 — Input VAT
      const inputVatUSD = round2(totalVatAmountUZS / exchangeRate);
      if (inputVatUSD > 0) {
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.VAT_RECEIVABLE,
          creditAccount: AccountCode.ACCOUNTS_PAYABLE,
          amount: inputVatUSD,
          exchangeRate,
          description: `НДС входящий: закупка #${purchaseId}`,
          relatedType: "purchase",
          relatedId: purchaseId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      }

      // Дт 6010 Кт 5010/5020/5110 — Supplier payment
      if (amountPaidUSD > 0) {
        const method = data.paymentMethod === "mixed" ? "cash" : data.paymentMethod;
        ledgerEntries.push({
          date: nowIso,
          debitAccount: AccountCode.ACCOUNTS_PAYABLE,
          creditAccount: cashAccount(method, data.paymentCurrency || "UZS"),
          amount: amountPaidUSD,
          exchangeRate,
          description: `Оплата поставщику: закупка #${purchaseId}`,
          relatedType: "purchase",
          relatedId: purchaseId,
          createdBy: userEmail,
          createdAt: nowIso,
        });
      }

      for (const entry of ledgerEntries) {
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      const txResult = {
        purchaseId,
        totalLandedAmountUSD,
        totalInvoiceAmountUZS,
        totalVatAmountUZS,
        amountPaidUSD,
        exchangeRate,
        createdBy: userEmail,
        date: nowIso,
        supplierName: data.supplierName,
        supplierId: resolvedSupplierId,
        clientId: resolvedClientId,
        paymentMethod: data.paymentMethod,
        paymentCurrency: data.paymentCurrency || "UZS",
      };

      // Write idempotency key (inside transaction for atomicity)
      if (requestId) {
        writeIdempotencyKey(tx, db, requestId, "commitPurchase", uid, txResult as unknown as Record<string, unknown>);
      }

      return txResult;
    });

    return {
      success: true,
      purchaseId: result.purchaseId,
      totalLandedAmount: result.totalLandedAmountUSD,
    };
  },
);
// Placeholder — will be implemented when purchase CF is scheduled
export {};
