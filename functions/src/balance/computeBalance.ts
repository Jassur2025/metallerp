/**
 * computeBalance — Callable Cloud Function (Задача 7.1)
 *
 * Server-side balance computation. Reads all collections, computes
 * the full balance sheet (assets/liabilities/P&L), and writes result
 * to `balance/current` for clients to subscribe via onSnapshot.
 *
 * Rate-limited to 1 call/min per user (expensive read operation).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { safeNum, round2 } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";

// ─── Helpers (mirror client utils/finance.ts) ───────────────

const DEFAULT_EXCHANGE_RATE = 12800;

function getSafeRate(rate: unknown, defaultRate: number): number {
  const r = safeNum(rate);
  const safeDefault = defaultRate > 100 ? defaultRate : DEFAULT_EXCHANGE_RATE;
  return r > 100 ? r : safeDefault;
}

interface FinancialTotals {
  cashUSD: number;
  cashUZS: number;
  bankUZS: number;
  cardUZS: number;
}

/**
 * Server-side replica of client calculateBaseTotals.
 * Aggregates orders, transactions, expenses into cash/bank/card buckets.
 */
function calculateBaseTotals(
  orders: FirebaseFirestore.DocumentData[],
  transactions: FirebaseFirestore.DocumentData[],
  expenses: FirebaseFirestore.DocumentData[],
  defaultRate: number,
): FinancialTotals {
  let cashUSD = 0;
  let cashUZS = 0;
  let bankUZS = 0;
  let cardUZS = 0;
  const rate = getSafeRate(defaultRate, DEFAULT_EXCHANGE_RATE);

  // 1. Orders (Revenue)
  for (const o of orders) {
    if (o.paymentMethod === "cash") {
      if (o.paymentCurrency === "UZS") {
        cashUZS += safeNum(o.totalAmountUZS);
      } else {
        const paid = safeNum(o.amountPaid);
        const total = safeNum(o.totalAmount);
        cashUSD += paid > 0 ? paid : total;
      }
    } else if (o.paymentMethod === "bank") {
      bankUZS += safeNum(o.totalAmountUZS);
    } else if (o.paymentMethod === "card") {
      cardUZS += safeNum(o.totalAmountUZS);
    }
  }

  // 2. Transactions
  const orderIdSet = new Set(orders.map((o) => o.id));
  for (const t of transactions) {
    const amt = safeNum(t.amount);
    const isUSD = t.currency === "USD";
    const tRate = getSafeRate(t.exchangeRate, rate);

    // Resolve relatedOrder
    const relatedOrderId = t.orderId ||
      (t.relatedId?.startsWith("ORD-") ? t.relatedId : null) ||
      (t.description?.match(/ORD-[A-Z0-9-]+/i)?.[0] || null);
    const relatedOrderMethod = relatedOrderId
      ? orders.find((o) => o.id === relatedOrderId)?.paymentMethod
      : null;
    const isMixed = relatedOrderMethod === "mixed";
    const isDebtPayment = t.type === "client_payment" && !relatedOrderId;

    if (t.type === "client_payment") {
      if (isMixed || isDebtPayment) {
        if (t.method === "cash") {
          if (isUSD) cashUSD += amt; else cashUZS += amt;
        } else if (t.method === "bank") {
          bankUZS += isUSD ? amt * tRate : amt;
        } else if (t.method === "card") {
          cardUZS += isUSD ? amt * tRate : amt;
        }
      }
    } else if (t.type === "supplier_payment") {
      if (t.method === "cash") {
        if (isUSD) cashUSD -= amt; else cashUZS -= amt;
      } else if (t.method === "bank") {
        bankUZS -= isUSD ? amt * tRate : amt;
      } else if (t.method === "card") {
        cardUZS -= isUSD ? amt * tRate : amt;
      }
    } else if (t.type === "client_return" || t.type === "client_refund") {
      if (t.method === "cash") {
        if (isUSD) cashUSD -= amt; else cashUZS -= amt;
      } else if (t.method === "bank") {
        bankUZS -= isUSD ? amt * tRate : amt;
      } else if (t.method === "card") {
        cardUZS -= isUSD ? amt * tRate : amt;
      }
    } else if (t.type === "expense") {
      if (t.method === "cash") {
        if (isUSD) cashUSD -= amt; else cashUZS -= amt;
      } else if (t.method === "bank") {
        bankUZS -= isUSD ? amt * tRate : amt;
      } else if (t.method === "card") {
        cardUZS -= isUSD ? amt * tRate : amt;
      }
    }
  }

  // 3. Expenses not already in transactions
  const txIds = new Set(transactions.map((t) => t.id));
  for (const e of expenses) {
    if (txIds.has(e.id)) continue;
    const amt = safeNum(e.amount);
    const isUSD = e.currency === "USD";
    const eRate = getSafeRate(e.exchangeRate, rate);
    if (e.paymentMethod === "cash") {
      if (isUSD) cashUSD -= amt; else cashUZS -= amt;
    } else if (e.paymentMethod === "bank") {
      bankUZS -= isUSD ? amt * eRate : amt;
    } else if (e.paymentMethod === "card") {
      cardUZS -= isUSD ? amt * eRate : amt;
    }
  }

  return { cashUSD, cashUZS, bankUZS, cardUZS };
}

// ─── Cloud Function ─────────────────────────────────────────

export const computeBalance = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: false,
    cors: true,
    memory: "512MiB", // Larger — reads many collections
    timeoutSeconds: 120,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const uid = request.auth.uid;

    // 2. Rate limit (1/min)
    await checkRateLimit(uid, "computeBalance");

    const db = getFirestore();

    // 3. Read all collections in parallel
    const [
      productsSnap,
      ordersSnap,
      transactionsSnap,
      expensesSnap,
      clientsSnap,
      purchasesSnap,
      fixedAssetsSnap,
      settingsSnap,
    ] = await Promise.all([
      db.collection("products").where("_deleted", "!=", true).get(),
      db.collection("orders").where("_deleted", "!=", true).get(),
      db.collection("transactions").where("_deleted", "!=", true).get(),
      db.collection("expenses").where("_deleted", "!=", true).get(),
      db.collection("clients").where("_deleted", "!=", true).get(),
      db.collection("purchases").where("_deleted", "!=", true).get(),
      db.collection("fixedAssets").where("_deleted", "!=", true).get(),
      db.doc("settings/general").get(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Doc = Record<string, any>;
    const products: Doc[] = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const orders: Doc[] = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const transactions: Doc[] = transactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const expenses: Doc[] = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const clients: Doc[] = clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const purchases: Doc[] = purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const fixedAssets: Doc[] = fixedAssetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const settings = settingsSnap.exists ? settingsSnap.data()! : {};
    const currentRate = getSafeRate(settings.defaultExchangeRate, DEFAULT_EXCHANGE_RATE);

    // ═══ ASSETS ═══

    // 1. Inventory by warehouse
    const inventoryByWarehouse = {
      main: products
        .filter((p) => (p.warehouse || "main") === "main")
        .reduce((s, p) => s + safeNum(p.quantity) * safeNum(p.costPrice), 0),
      cloud: products
        .filter((p) => p.warehouse === "cloud")
        .reduce((s, p) => s + safeNum(p.quantity) * safeNum(p.costPrice), 0),
    };
    const inventoryValue = round2(inventoryByWarehouse.main + inventoryByWarehouse.cloud);

    // 2. Liquid assets
    const { cashUSD, cashUZS, bankUZS, cardUZS } = calculateBaseTotals(
      orders, transactions, expenses, safeNum(settings.defaultExchangeRate),
    );
    const totalCashUSD = round2(cashUSD + cashUZS / currentRate);
    const netBankUSD = round2(bankUZS / currentRate);
    const netCardUSD = round2(cardUZS / currentRate);
    const totalLiquidAssets = round2(totalCashUSD + netBankUSD + netCardUSD);

    // 3. Fixed assets
    const fixedAssetsValue = round2(
      fixedAssets.reduce((s, a) => s + safeNum(a.currentValue), 0),
    );

    // 4. Accounts receivable
    const accountsReceivable = round2(
      clients.reduce((s, c) => s + safeNum(c.totalDebt), 0),
    );

    const totalAssets = round2(inventoryValue + totalLiquidAssets + accountsReceivable + fixedAssetsValue);

    // ═══ PASSIVES ═══

    // 1. VAT
    const vatOutput = round2(orders.reduce((s, o) => s + safeNum(o.vatAmount), 0));
    const vatInput = round2(purchases.reduce((s, p) => {
      if (p.totalVatAmountUZS && safeNum(p.totalVatAmountUZS) > 0) {
        const pRate = safeNum(p.exchangeRate) || currentRate;
        return s + safeNum(p.totalVatAmountUZS) / pRate;
      }
      if (Array.isArray(p.items)) {
        const itemsVat = (p.items as Array<{ vatAmount?: number }>).reduce(
          (iv, item) => iv + safeNum(item.vatAmount), 0,
        );
        if (itemsVat > 0) {
          const pRate = safeNum(p.exchangeRate) || currentRate;
          return s + itemsVat / pRate;
        }
      }
      return s;
    }, 0));
    const vatLiability = round2(Math.max(0, vatOutput - vatInput));

    // 2. Accounts payable
    const accountsPayable = round2(purchases.reduce((s, p) => {
      const purchaseRate = safeNum(p.exchangeRate) || currentRate;
      if (p.totalInvoiceAmountUZS && safeNum(p.totalInvoiceAmountUZS) > 0) {
        const totalDebtUZS = safeNum(p.totalInvoiceAmountUZS) - safeNum(p.amountPaid);
        return s + Math.max(0, totalDebtUZS / purchaseRate);
      }
      const amountPaidUSD = p.amountPaidUSD !== undefined && p.amountPaidUSD !== null
        ? safeNum(p.amountPaidUSD)
        : safeNum(p.amountPaid);
      return s + Math.max(0, safeNum(p.totalInvoiceAmount) - amountPaidUSD);
    }, 0));

    // 3. Fixed assets payable
    const fixedAssetsPayable = round2(fixedAssets.reduce((s, fa) => {
      const paid = fa.amountPaid ?? fa.purchaseCost;
      return s + Math.max(0, safeNum(fa.purchaseCost) - safeNum(paid));
    }, 0));

    // 4. Equity
    const equity = round2(purchases.reduce((s, p) => {
      if (p.amountPaidUSD !== undefined) return s + safeNum(p.amountPaidUSD);
      return s + safeNum(p.amountPaid);
    }, 0));

    // 5. Fixed assets fund
    const fixedAssetsFund = round2(Math.max(0, fixedAssetsValue - fixedAssetsPayable));

    // ═══ P&L ═══
    const revenue = round2(orders.reduce((s, o) => s + safeNum(o.subtotalAmount), 0));
    const cogs = round2(orders.reduce((sumO, o) => {
      if (!Array.isArray(o.items)) return sumO;
      return sumO + (o.items as Array<{ quantity?: number; costAtSale?: number }>).reduce(
        (sumI, item) => sumI + safeNum(item.quantity) * safeNum(item.costAtSale), 0,
      );
    }, 0));
    const grossProfit = round2(revenue - cogs);
    const totalExpenses = round2(expenses.reduce((s, e) => {
      const eRate = safeNum(e.exchangeRate) || safeNum(settings.defaultExchangeRate) || 1;
      return s + (e.currency === "UZS" ? safeNum(e.amount) / eRate : safeNum(e.amount));
    }, 0));
    const totalDepreciation = round2(
      fixedAssets.reduce((s, fa) => s + safeNum(fa.accumulatedDepreciation), 0),
    );
    const netProfit = round2(grossProfit - totalExpenses - totalDepreciation);

    const retainedEarnings = round2(
      totalAssets - equity - fixedAssetsFund - vatLiability - accountsPayable - fixedAssetsPayable,
    );
    const totalPassives = round2(
      equity + fixedAssetsFund + retainedEarnings + vatLiability + accountsPayable + fixedAssetsPayable,
    );

    const balanceData = {
      inventoryValue,
      inventoryByWarehouse,
      cashUSD: round2(cashUSD),
      cashUZS: round2(cashUZS),
      bankUZS: round2(bankUZS),
      cardUZS: round2(cardUZS),
      totalCashUSD,
      netBankUSD,
      netCardUSD,
      totalLiquidAssets,
      fixedAssetsValue,
      accountsReceivable,
      totalAssets,
      vatOutput,
      vatInput,
      vatLiability,
      accountsPayable,
      fixedAssetsPayable,
      equity,
      fixedAssetsFund,
      retainedEarnings,
      totalPassives,
      revenue,
      cogs,
      grossProfit,
      totalExpenses,
      totalDepreciation,
      netProfit,
      corrections: [] as Array<{ id: string; type: string; originalAmount: number; correctedAmount: number; reason: string }>,
      exchangeRate: currentRate,
      computedAt: new Date().toISOString(),
    };

    // 4. Write to balance/current
    await db.doc("balance/current").set({
      ...balanceData,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, computedAt: balanceData.computedAt };
  },
);
