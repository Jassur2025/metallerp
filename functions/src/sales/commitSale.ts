/**
 * commitSale — Callable Cloud Function
 *
 * The SERVER reads product prices, computes totals, deducts stock,
 * updates client debt, writes order + transactions + ledger entries
 * in a single Firestore transaction.
 *
 * The CLIENT only sends:
 *   - items: Array<{ productId, quantity }>
 *   - clientId: string
 *   - paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed'
 *   - paymentCurrency?: 'USD' | 'UZS'  (only for cash)
 *   - amountPaid?: number  (for mixed: how much paid now, USD)
 *   - workflowOrderId?: string  (if converting from workflow)
 *   - sellerId?: string
 *   - sellerName?: string
 *   - customerName: string
 *
 * ALL prices, exchange rate, VAT rate, totals — computed on SERVER.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  assertString,
  assertArray,
  assertOneOf,
  assertPositiveNumber,
  safeNum,
  round2,
} from "../utils/validation";
import { generateSaleLedgerEntries, cashAccount } from "../utils/finance";
import { checkRateLimit } from "../utils/rateLimiter";
import { checkIdempotencyKey, writeIdempotencyKey, isValidRequestId } from "../utils/idempotency";

// ─── Types ──────────────────────────────────────────────────

interface SaleItemInput {
  productId: string;
  quantity: number;
}

interface CommitSaleInput {
  items: SaleItemInput[];
  clientId: string;
  customerName: string;
  paymentMethod: "cash" | "bank" | "card" | "debt" | "mixed";
  paymentCurrency?: "USD" | "UZS";
  amountPaid?: number; // USD — for mixed payments
  workflowOrderId?: string;
  sellerId?: string;
  sellerName?: string;
  requestId?: string; // Idempotency key (UUID v4) — prevents duplicate sales
}

const PAYMENT_METHODS = ["cash", "bank", "card", "debt", "mixed"] as const;
const PAYMENT_CURRENCIES = ["USD", "UZS"] as const;

// ─── ID generators (mirrors client IdGenerator) ─────────────

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

function generateTransactionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TX-${ts}-${rand}`;
}

// ─── Cloud Function ─────────────────────────────────────────

export const commitSale = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: true,
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const userEmail = request.auth.token.email || request.auth.uid;
    const uid = request.auth.uid;

    // 1b. Role check — only admin or active employees can create sales
    const userDoc = await getFirestore().doc(`users/${uid}`).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      // Fallback: check employees collection for active status
      const empDoc = await getFirestore().doc(`employees/${uid}`).get();
      if (!empDoc.exists || empDoc.data()?.status === "inactive") {
        throw new HttpsError(
          "permission-denied",
          "You do not have permission to create sales",
        );
      }
    }

    // 2. Rate limiting
    await checkRateLimit(uid, "commitSale");

    // 3. Parse & validate input
    const data = request.data as CommitSaleInput;

    assertArray(data.items, "items");
    assertString(data.clientId, "clientId");
    assertString(data.customerName, "customerName");
    assertOneOf(data.paymentMethod, PAYMENT_METHODS, "paymentMethod");

    if (data.paymentCurrency) {
      assertOneOf(data.paymentCurrency, PAYMENT_CURRENCIES, "paymentCurrency");
    }

    // Validate each item
    for (const item of data.items) {
      assertString(item.productId, "item.productId");
      assertPositiveNumber(item.quantity, "item.quantity");
    }

    const db = getFirestore();
    const nowIso = new Date().toISOString();
    const orderId = generateOrderId();

    // 3b. Idempotency: validate requestId format if provided
    const requestId = data.requestId;
    if (requestId !== undefined && !isValidRequestId(requestId)) {
      throw new HttpsError("invalid-argument", "requestId must be a valid UUID v4");
    }

    // 3. Run atomic Firestore transaction
    const result = await db.runTransaction(async (tx) => {
      // ── Idempotency check ───────────────────────────────
      if (requestId) {
        const cached = await checkIdempotencyKey<{
          orderId: string;
          totalAmountUSD: number;
          totalAmountUZS: number;
          vatAmount: number;
          totalCOGS: number;
          amountPaid: number;
          debtUSD: number;
          cashPaidUSD: number;
          paymentMethod: string;
          paymentCurrency: string;
          exchangeRate: number;
          customerName: string;
          date: string;
          transactions: unknown[];
          createdBy: string;
        }>(tx, db, requestId);
        if (cached) {
          return { ...cached, _idempotent: true as const };
        }
      }

      // ── Read phase ──────────────────────────────────────

      // 3a. Read settings (exchange rate, VAT rate)
      const settingsSnap = await tx.get(db.doc("settings/general"));
      const settings = settingsSnap.exists ? settingsSnap.data()! : {};
      const exchangeRate = safeNum(settings.defaultExchangeRate) || 12800;
      const vatRate = safeNum(settings.vatRate) || 12;

      // 3b. Aggregate quantities per product
      const qtyByProduct = new Map<string, number>();
      for (const item of data.items) {
        qtyByProduct.set(
          item.productId,
          (qtyByProduct.get(item.productId) || 0) + item.quantity,
        );
      }

      // 3c. Read all products
      const productEntries = Array.from(qtyByProduct.entries());
      const productRefs = productEntries.map(([id]) => db.doc(`products/${id}`));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      const productMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      for (let i = 0; i < productEntries.length; i++) {
        const [productId, requestedQty] = productEntries[i];
        const snap = productSnaps[i];

        if (!snap.exists) {
          throw new HttpsError("not-found", `Product ${productId} not found`);
        }

        const currentQty = safeNum(snap.data()!.quantity);
        if (currentQty < requestedQty) {
          throw new HttpsError(
            "failed-precondition",
            `Insufficient stock for ${snap.data()!.name || productId}: ` +
            `available ${currentQty}, requested ${requestedQty}`,
          );
        }
        productMap.set(productId, snap);
      }

      // 3d. Read client
      const clientRef = db.doc(`clients/${data.clientId}`);
      const clientSnap = await tx.get(clientRef);

      // 3e. Read order doc (should NOT exist)
      const orderRef = db.doc(`orders/${orderId}`);
      const orderSnap = await tx.get(orderRef);
      if (orderSnap.exists) {
        throw new HttpsError("already-exists", `Order ${orderId} already exists`);
      }

      // 3f. Read workflow order if applicable
      let workflowRef: FirebaseFirestore.DocumentReference | null = null;
      let workflowSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (data.workflowOrderId) {
        workflowRef = db.doc(`workflowOrders/${data.workflowOrderId}`);
        workflowSnap = await tx.get(workflowRef);
        if (!workflowSnap.exists) {
          throw new HttpsError("not-found", `Workflow order ${data.workflowOrderId} not found`);
        }
      }

      // 3g. Read next report number from settings
      const nextReportNo = safeNum(settings.nextReportNo) || 1;

      // ── Compute phase (SERVER calculates everything) ───

      // Build order items with SERVER-side prices
      const orderItems: Array<{
        productId: string;
        productName: string;
        dimensions: string;
        quantity: number;
        priceAtSale: number;
        costAtSale: number;
        unit: string;
        total: number;
      }> = [];

      let subtotalUSD = 0;
      let totalCOGS = 0;

      for (const inputItem of data.items) {
        const snap = productMap.get(inputItem.productId)!;
        const pData = snap.data()!;

        const priceAtSale = safeNum(pData.pricePerUnit); // SERVER reads price
        const costAtSale = safeNum(pData.costPrice); // SERVER reads cost
        const qty = safeNum(inputItem.quantity);
        const lineTotal = round2(priceAtSale * qty);
        const lineCOGS = round2(costAtSale * qty);

        orderItems.push({
          productId: inputItem.productId,
          productName: pData.name || "",
          dimensions: pData.dimensions || "",
          quantity: qty,
          priceAtSale,
          costAtSale,
          unit: pData.unit || "м",
          total: lineTotal,
        });

        subtotalUSD += lineTotal;
        totalCOGS += lineCOGS;
      }

      subtotalUSD = round2(subtotalUSD);
      totalCOGS = round2(totalCOGS);

      // VAT & totals
      const vatAmount = round2(subtotalUSD * vatRate / 100);
      const totalAmountUSD = round2(subtotalUSD);
      const totalAmountUZS = round2(totalAmountUSD * exchangeRate);

      // Payment logic
      const paymentMethod = data.paymentMethod;
      const paymentCurrency = data.paymentCurrency || "USD";
      let amountPaid = 0;
      let debtUSD = 0;
      let paymentStatus: "paid" | "unpaid" | "partial" = "paid";

      if (paymentMethod === "debt") {
        amountPaid = 0;
        debtUSD = totalAmountUSD;
        paymentStatus = "unpaid";
      } else if (paymentMethod === "mixed") {
        amountPaid = round2(Math.min(safeNum(data.amountPaid), totalAmountUSD));
        debtUSD = round2(totalAmountUSD - amountPaid);
        paymentStatus = amountPaid > 0 ? "partial" : "unpaid";
      } else {
        // cash / bank / card — fully paid
        amountPaid = totalAmountUSD;
        debtUSD = 0;
        paymentStatus = "paid";
      }

      // ── Write phase ─────────────────────────────────────

      // 4a. Deduct product stock
      for (const [productId, soldQty] of productEntries) {
        const snap = productMap.get(productId)!;
        const pData = snap.data()!;
        const currentQty = safeNum(pData.quantity);
        const currentVersion = safeNum(pData._version);

        tx.update(snap.ref, {
          quantity: round2(currentQty - soldQty),
          updatedAt: nowIso,
          _version: currentVersion + 1,
        });
      }

      // 4b. Update/create client
      const purchaseDelta = totalAmountUSD;
      if (clientSnap.exists) {
        const cData = clientSnap.data()!;
        const currentPurchases = safeNum(cData.totalPurchases);
        const currentDebt = safeNum(cData.totalDebt);
        const currentVersion = safeNum(cData._version);

        tx.update(clientRef, {
          totalPurchases: round2(currentPurchases + purchaseDelta),
          totalDebt: round2(currentDebt + debtUSD),
          updatedAt: Timestamp.now(),
          _version: currentVersion + 1,
        });
      } else {
        // Create new client (rare: normally client exists)
        tx.set(clientRef, {
          name: data.customerName,
          phone: "",
          creditLimit: 0,
          totalPurchases: purchaseDelta,
          totalDebt: debtUSD,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          _version: 1,
        });
      }

      // 4c. Write order document
      const orderData = {
        id: orderId,
        reportNo: nextReportNo,
        date: nowIso,
        customerName: data.customerName,
        clientId: data.clientId,
        sellerId: data.sellerId || "",
        sellerName: data.sellerName || "",
        items: orderItems,
        subtotalAmount: subtotalUSD,
        vatRateSnapshot: vatRate,
        vatAmount,
        totalAmount: totalAmountUSD,
        exchangeRate,
        totalAmountUZS,
        status: "completed",
        paymentMethod,
        paymentStatus,
        paymentCurrency,
        amountPaid,
        createdBy: userEmail,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        _version: 1,
      };
      tx.set(orderRef, orderData);

      // 4d. Write payment transaction(s)
      const transactions: Array<{
        id: string;
        type: string;
        amount: number;
        currency: string;
        method: string;
        relatedId: string;
        orderId: string;
        description: string;
        date: string;
      }> = [];

      if (amountPaid > 0) {
        const txId = generateTransactionId();
        const txRef = db.doc(`transactions/${txId}`);
        const txData = {
          type: "client_payment",
          amount: amountPaid,
          currency: "USD",
          method: paymentMethod === "mixed" ? "cash" : paymentMethod,
          relatedId: data.clientId,
          orderId,
          description: `Оплата по заказу #${orderId}`,
          date: nowIso,
          createdAt: Timestamp.now(),
          updatedAt: nowIso,
          _version: 1,
        };
        tx.set(txRef, txData);
        transactions.push({ id: txId, ...txData });
      }

      if (debtUSD > 0) {
        const txId = generateTransactionId();
        const txRef = db.doc(`transactions/${txId}`);
        const txData = {
          type: "debt_obligation",
          amount: debtUSD,
          currency: "USD",
          method: "debt",
          relatedId: data.clientId,
          orderId,
          description: `Долг по заказу #${orderId}`,
          date: nowIso,
          createdAt: Timestamp.now(),
          updatedAt: nowIso,
          _version: 1,
        };
        tx.set(txRef, txData);
        transactions.push({ id: txId, ...txData });
      }

      // 4e. Update workflow order if applicable
      if (workflowRef && workflowSnap) {
        const wData = workflowSnap.data() || {};
        const wVersion = safeNum(wData._version);
        tx.update(workflowRef, {
          status: "completed",
          convertedToOrderId: orderId,
          convertedAt: nowIso,
          updatedAt: Timestamp.now(),
          _version: wVersion + 1,
        });
      }

      // 4f. Increment report number
      tx.update(db.doc("settings/general"), {
        nextReportNo: nextReportNo + 1,
      });

      // 4g. Write journal event (audit log)
      const journalRef = db.collection("journalEvents").doc();
      tx.set(journalRef, {
        action: "sale_completed",
        description: `Продажа #${orderId} — ${data.customerName} — $${totalAmountUSD}`,
        userId: request.auth!.uid,
        userEmail,
        metadata: {
          orderId,
          clientId: data.clientId,
          totalAmount: totalAmountUSD,
          itemCount: data.items.length,
          paymentMethod,
        },
        createdAt: nowIso,
      });

      // 4h. Write ledger entries INSIDE transaction (atomic with business data)
      const ledgerEntries = generateSaleLedgerEntries({
        orderId,
        customerName: data.customerName,
        date: nowIso,
        revenueUSD: totalAmountUSD,
        totalCOGS,
        vatAmount,
        exchangeRate,
        totalAmountUZS,
        paymentMethod,
        cashPaidUSD: amountPaid,
        debtUSD,
        paymentCurrency,
        createdBy: userEmail,
      });
      for (const entry of ledgerEntries) {
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      const txResult = {
        orderId,
        totalAmountUSD,
        totalAmountUZS,
        vatAmount,
        totalCOGS,
        amountPaid,
        debtUSD,
        cashPaidUSD: amountPaid,
        paymentMethod,
        paymentCurrency,
        exchangeRate,
        customerName: data.customerName,
        date: nowIso,
        transactions,
        createdBy: userEmail,
      };

      // 4i. Write idempotency key (inside transaction for atomicity)
      if (requestId) {
        writeIdempotencyKey(tx, db, requestId, "commitSale", uid, txResult as unknown as Record<string, unknown>);
      }

      return txResult;
    });

    return {
      success: true,
      orderId: result.orderId,
      totalAmount: result.totalAmountUSD,
      totalAmountUZS: result.totalAmountUZS,
    };
  },
);
