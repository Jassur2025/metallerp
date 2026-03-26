/**
 * generateReport — Callable Cloud Function (Задача 13.2)
 *
 * Server-side aggregation for PnL, CashFlow, and VatReport.
 * Client sends report type + date range, server computes aggregates
 * and returns ready-made result. No more loading ALL data into browser.
 *
 * CLIENT sends:
 *   - reportType: 'pnl' | 'cashflow' | 'vat'
 *   - dateFrom: string (ISO)
 *   - dateTo: string (ISO)
 *   - year?: number (for PnL annual view)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { safeNum, round2, assertString, assertOneOf } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimiter";

const REPORT_TYPES = ["pnl", "cashflow", "vat"] as const;
const DEFAULT_EXCHANGE_RATE = 12800;

function getSafeRate(rate: unknown, defaultRate: number): number {
  const r = safeNum(rate);
  const safeDefault = defaultRate > 100 ? defaultRate : DEFAULT_EXCHANGE_RATE;
  return r > 100 ? r : safeDefault;
}

function inRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

// ─── PnL Report ─────────────────────────────────────────────

interface MonthData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  opexAdmin: number;
  opexOperational: number;
  opexCommercial: number;
  opexTotal: number;
  depreciation: number;
  netProfit: number;
}

function generatePnL(
  orders: FirebaseFirestore.DocumentData[],
  expenses: FirebaseFirestore.DocumentData[],
  fixedAssets: FirebaseFirestore.DocumentData[],
  year: number,
  defaultRate: number,
  dateFrom?: string,
  dateTo?: string,
) {
  const rate = getSafeRate(defaultRate, DEFAULT_EXCHANGE_RATE);
  const months: MonthData[] = Array.from({ length: 12 }, () => ({
    revenue: 0, cogs: 0, grossProfit: 0,
    opexAdmin: 0, opexOperational: 0, opexCommercial: 0, opexTotal: 0,
    depreciation: 0, netProfit: 0,
  }));

  // Custom date range filter
  const start = dateFrom ? new Date(dateFrom) : new Date(year, 0, 1);
  const end = dateTo ? new Date(dateTo) : new Date(year, 11, 31, 23, 59, 59, 999);
  if (dateTo) end.setHours(23, 59, 59, 999);

  // Orders
  for (const o of orders) {
    const d = new Date(o.date);
    if (d < start || d > end) continue;
    const m = d.getMonth();
    const rev = safeNum(o.subtotalAmount);
    months[m].revenue += rev;
    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        months[m].cogs += safeNum(item.quantity) * safeNum(item.costAtSale);
      }
    }
  }

  // Expenses
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d < start || d > end) continue;
    const m = d.getMonth();
    const eRate = safeNum(e.exchangeRate) || rate;
    const amtUSD = e.currency === "UZS" ? safeNum(e.amount) / eRate : safeNum(e.amount);
    const cat = e.pnlCategory || "administrative";
    if (cat === "commercial") months[m].opexCommercial += amtUSD;
    else if (cat === "operational") months[m].opexOperational += amtUSD;
    else months[m].opexAdmin += amtUSD;
  }

  // Depreciation (monthly = annual / 12)
  const monthlyDep = fixedAssets.reduce((s, fa) => {
    const annualRate = safeNum(fa.depreciationRate) / 100;
    return s + safeNum(fa.currentValue) * annualRate / 12;
  }, 0);

  // Compute derived fields
  let totalRevenue = 0, totalCOGS = 0, totalOpex = 0, totalDep = 0;
  for (let i = 0; i < 12; i++) {
    months[i].cogs = round2(months[i].cogs);
    months[i].revenue = round2(months[i].revenue);
    months[i].grossProfit = round2(months[i].revenue - months[i].cogs);
    months[i].opexAdmin = round2(months[i].opexAdmin);
    months[i].opexOperational = round2(months[i].opexOperational);
    months[i].opexCommercial = round2(months[i].opexCommercial);
    months[i].opexTotal = round2(months[i].opexAdmin + months[i].opexOperational + months[i].opexCommercial);
    months[i].depreciation = round2(monthlyDep);
    months[i].netProfit = round2(months[i].grossProfit - months[i].opexTotal - months[i].depreciation);

    totalRevenue += months[i].revenue;
    totalCOGS += months[i].cogs;
    totalOpex += months[i].opexTotal;
    totalDep += months[i].depreciation;
  }

  return {
    year,
    months,
    totals: {
      revenue: round2(totalRevenue),
      cogs: round2(totalCOGS),
      grossProfit: round2(totalRevenue - totalCOGS),
      opexTotal: round2(totalOpex),
      depreciation: round2(totalDep),
      netProfit: round2(totalRevenue - totalCOGS - totalOpex - totalDep),
    },
  };
}

// ─── CashFlow Report ────────────────────────────────────────

interface CashFlowMonth {
  month: number;
  inflows: number;
  outflows: number;
  net: number;
  byCash: number;
  byBank: number;
  byCard: number;
}

function generateCashFlow(
  orders: FirebaseFirestore.DocumentData[],
  transactions: FirebaseFirestore.DocumentData[],
  expenses: FirebaseFirestore.DocumentData[],
  year: number,
  defaultRate: number,
  dateFrom?: string,
  dateTo?: string,
) {
  const rate = getSafeRate(defaultRate, DEFAULT_EXCHANGE_RATE);
  const months: CashFlowMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i, inflows: 0, outflows: 0, net: 0, byCash: 0, byBank: 0, byCard: 0,
  }));

  const start = dateFrom ? new Date(dateFrom) : new Date(year, 0, 1);
  const end = dateTo ? new Date(dateTo) : new Date(year, 11, 31, 23, 59, 59, 999);
  if (dateTo) end.setHours(23, 59, 59, 999);

  // Orders (inflows)
  for (const o of orders) {
    const d = new Date(o.date);
    if (d < start || d > end) continue;
    if (o.paymentMethod === "debt") continue;
    const m = d.getMonth();
    const amt = safeNum(o.totalAmount);
    months[m].inflows += amt;
    if (o.paymentMethod === "cash") months[m].byCash += amt;
    else if (o.paymentMethod === "bank") months[m].byBank += amt;
    else if (o.paymentMethod === "card") months[m].byCard += amt;
  }

  // Transactions
  for (const t of transactions) {
    const d = new Date(t.date);
    if (d < start || d > end) continue;
    const m = d.getMonth();
    const amt = safeNum(t.amount);
    const isInflow = t.type === "client_payment";
    const isOutflow = ["supplier_payment", "expense", "client_return", "client_refund"].includes(t.type);

    if (isInflow) {
      months[m].inflows += amt;
      if (t.method === "cash") months[m].byCash += amt;
      else if (t.method === "bank") months[m].byBank += amt;
      else if (t.method === "card") months[m].byCard += amt;
    } else if (isOutflow) {
      months[m].outflows += amt;
    }
  }

  // Expenses not in transactions
  const txIds = new Set(transactions.map((t) => t.id));
  for (const e of expenses) {
    if (txIds.has(e.id)) continue;
    const d = new Date(e.date);
    if (d < start || d > end) continue;
    const m = d.getMonth();
    const eRate = safeNum(e.exchangeRate) || rate;
    const amtUSD = e.currency === "UZS" ? safeNum(e.amount) / eRate : safeNum(e.amount);
    months[m].outflows += amtUSD;
  }

  // Round and compute net
  let totalInflows = 0, totalOutflows = 0;
  for (const mo of months) {
    mo.inflows = round2(mo.inflows);
    mo.outflows = round2(mo.outflows);
    mo.net = round2(mo.inflows - mo.outflows);
    mo.byCash = round2(mo.byCash);
    mo.byBank = round2(mo.byBank);
    mo.byCard = round2(mo.byCard);
    totalInflows += mo.inflows;
    totalOutflows += mo.outflows;
  }

  return {
    year,
    months,
    totals: {
      inflows: round2(totalInflows),
      outflows: round2(totalOutflows),
      net: round2(totalInflows - totalOutflows),
    },
  };
}

// ─── VAT Report ─────────────────────────────────────────────

function generateVat(
  purchases: FirebaseFirestore.DocumentData[],
  orders: FirebaseFirestore.DocumentData[],
  expenses: FirebaseFirestore.DocumentData[],
  defaultRate: number,
  dateFrom: string,
  dateTo: string,
) {
  const rate = getSafeRate(defaultRate, DEFAULT_EXCHANGE_RATE);
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  end.setHours(23, 59, 59, 999);

  // Input VAT from purchases
  let inputVatPurchases = 0;
  let inputCustomsDuty = 0;
  const filteredPurchases = purchases.filter((p) => inRange(p.date, start, end));
  for (const p of filteredPurchases) {
    const pRate = safeNum(p.exchangeRate) || rate;
    if (p.totalVatAmountUZS && safeNum(p.totalVatAmountUZS) > 0) {
      inputVatPurchases += safeNum(p.totalVatAmountUZS) / pRate;
    } else if (Array.isArray(p.items)) {
      for (const item of p.items) {
        inputVatPurchases += safeNum(item.vatAmount) / pRate;
      }
    }
    if (p.overheads) {
      inputCustomsDuty += safeNum(p.overheads.customsDuty) / pRate;
    }
  }

  // Input VAT from expenses
  let inputVatExpenses = 0;
  const filteredExpenses = expenses.filter((e) => inRange(e.date, start, end) && safeNum(e.vatAmount) > 0);
  for (const e of filteredExpenses) {
    const eRate = safeNum(e.exchangeRate) || rate;
    inputVatExpenses += e.currency === "UZS"
      ? safeNum(e.vatAmount) / eRate
      : safeNum(e.vatAmount);
  }

  const totalInputVat = round2(inputVatPurchases + inputVatExpenses + inputCustomsDuty);

  // Output VAT from orders
  let outputVat = 0;
  const filteredOrders = orders.filter((o) => inRange(o.date, start, end));
  for (const o of filteredOrders) {
    outputVat += safeNum(o.vatAmount);
  }
  outputVat = round2(outputVat);

  const vatPayable = round2(Math.max(0, outputVat - totalInputVat));
  const vatRefundable = round2(Math.max(0, totalInputVat - outputVat));

  return {
    period: { from: dateFrom, to: dateTo },
    inputVat: {
      purchases: round2(inputVatPurchases),
      expenses: round2(inputVatExpenses),
      customs: round2(inputCustomsDuty),
      total: totalInputVat,
    },
    outputVat,
    vatPayable,
    vatRefundable,
    purchaseCount: filteredPurchases.length,
    orderCount: filteredOrders.length,
    expenseCount: filteredExpenses.length,
    exchangeRate: rate,
  };
}

// ─── Cloud Function ─────────────────────────────────────────

export const generateReport = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: false,
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const uid = request.auth.uid;

    // Rate limit: 5/min
    await checkRateLimit(uid, "generateReport", { maxCalls: 5, windowMs: 60_000 });

    const data = request.data as {
      reportType: string;
      dateFrom?: string;
      dateTo?: string;
      year?: number;
    };

    assertOneOf(data.reportType, REPORT_TYPES, "reportType");

    const db = getFirestore();
    const settingsSnap = await db.doc("settings/general").get();
    const settings = settingsSnap.exists ? settingsSnap.data()! : {};
    const defaultRate = safeNum(settings.defaultExchangeRate) || DEFAULT_EXCHANGE_RATE;

    const year = data.year || new Date().getFullYear();
    const dateFrom = data.dateFrom;
    const dateTo = data.dateTo;

    if (data.reportType === "pnl") {
      const [ordersSnap, expensesSnap, fixedAssetsSnap] = await Promise.all([
        db.collection("orders").where("_deleted", "!=", true).get(),
        db.collection("expenses").where("_deleted", "!=", true).get(),
        db.collection("fixedAssets").where("_deleted", "!=", true).get(),
      ]);
      return generatePnL(
        ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        fixedAssetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        year, defaultRate, dateFrom, dateTo,
      );
    }

    if (data.reportType === "cashflow") {
      const [ordersSnap, transactionsSnap, expensesSnap] = await Promise.all([
        db.collection("orders").where("_deleted", "!=", true).get(),
        db.collection("transactions").where("_deleted", "!=", true).get(),
        db.collection("expenses").where("_deleted", "!=", true).get(),
      ]);
      return generateCashFlow(
        ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        transactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        year, defaultRate, dateFrom, dateTo,
      );
    }

    if (data.reportType === "vat") {
      if (!dateFrom || !dateTo) {
        throw new HttpsError("invalid-argument", "dateFrom and dateTo required for VAT report");
      }
      const [purchasesSnap, ordersSnap, expensesSnap] = await Promise.all([
        db.collection("purchases").where("_deleted", "!=", true).get(),
        db.collection("orders").where("_deleted", "!=", true).get(),
        db.collection("expenses").where("_deleted", "!=", true).get(),
      ]);
      return generateVat(
        purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        defaultRate, dateFrom, dateTo,
      );
    }

    throw new HttpsError("invalid-argument", `Unknown report type: ${data.reportType}`);
  },
);
