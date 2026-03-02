/**
 * ledgerEntryGenerators — Pure functions that produce LedgerEntry data
 * for each type of business event.
 *
 * These do NOT write to Firestore — they return arrays of entry objects
 * that are passed to `ledgerService.addEntries()`.
 *
 * Double-entry rules per NSBU Uzbekistan:
 *
 * SALE (cash):
 *   Дт 5010/5020/5110  Кт 9010   — Revenue (выручка)
 *   Дт 9110             Кт 2900   — COGS (списание себестоимости)
 *   Дт 9010             Кт 6410   — Output VAT (НДС к уплате)
 *
 * SALE (debt):
 *   Дт 4010             Кт 9010   — Revenue → receivable
 *   Дт 9110             Кт 2900   — COGS
 *   Дт 9010             Кт 6410   — Output VAT
 *
 * PAYMENT received:
 *   Дт 5010/5020/5110   Кт 4010   — Cash received → reduce receivable
 *
 * PURCHASE:
 *   Дт 2900             Кт 6010   — Inventory receipt (оприходование)
 *   Дт 4410             Кт 6010   — Input VAT (НДС к возмещению)
 *
 * PURCHASE payment:
 *   Дт 6010             Кт 5010/5020/5110 — Pay supplier
 *
 * EXPENSE:
 *   Дт 9420/9410        Кт 5010/5020/5110 — Expense
 */

import { AccountCode, LedgerEntry } from '../types/accounting';
import { Order, Purchase, Transaction } from '../types';

// ─── Helpers ──────────────────────────────────────────────────

type EntryInput = Omit<LedgerEntry, 'id' | 'periodId' | 'createdBy' | 'createdAt'>;

/** Map payment method + currency to the correct cash/bank account code */
function cashAccount(method: string, currency: string = 'USD'): AccountCode {
  if (method === 'bank') return AccountCode.BANK_UZS;
  if (method === 'card') return AccountCode.BANK_UZS; // card goes through bank settlement
  if (currency === 'UZS') return AccountCode.CASH_UZS;
  return AccountCode.CASH_USD;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const safe = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ─── Sale entries ─────────────────────────────────────────────

export interface SaleLedgerParams {
  order: Order;
  /** Total COGS in USD (sum of costAtSale × quantity for all items) */
  totalCOGS: number;
  /** VAT amount in USD */
  vatAmount: number;
  /** Transactions created for this sale (client_payment, debt_obligation) */
  transactions: Transaction[];
}

/**
 * Generate all ledger entries for a completed sale.
 *
 * Typical output (for a $100 sale + $70 COGS + 12% VAT, paid cash):
 *   Дт 5010  Кт 9010  $100.00 — Revenue
 *   Дт 9110  Кт 2900  $70.00  — COGS
 *   Дт 9010  Кт 6410  $12.00  — VAT
 *
 * For a debt sale:
 *   Дт 4010  Кт 9010  $100.00 — Revenue (receivable)
 *   Дт 9110  Кт 2900  $70.00  — COGS
 *   Дт 9010  Кт 6410  $12.00  — VAT
 *
 * For mixed payment (partially paid, partially debt):
 *   Дт 5010  Кт 9010  $60.00  — Partial cash revenue
 *   Дт 4010  Кт 9010  $40.00  — Partial receivable
 *   Дт 9110  Кт 2900  $70.00  — COGS
 *   Дт 9010  Кт 6410  $12.00  — VAT
 */
export function generateSaleEntries(params: SaleLedgerParams): EntryInput[] {
  const { order, totalCOGS, vatAmount, transactions } = params;
  const entries: EntryInput[] = [];
  const date = order.date;
  const orderId = order.id;
  const revenueUSD = round2(safe(order.totalAmount));

  if (revenueUSD <= 0) return entries;

  // 1. Revenue recognition — split by payment type
  const paidTxs = transactions.filter(tx => tx.type === 'client_payment');
  const debtTxs = transactions.filter(tx => tx.type === 'debt_obligation');

  // Cash/bank portion (from client_payment transactions)
  const cashPaidUSD = round2(paidTxs.reduce((sum, tx) => {
    if (tx.currency === 'USD') return sum + safe(tx.amount);
    // Convert UZS payments to USD for ledger (base currency)
    const rate = safe(tx.exchangeRate) || safe(order.exchangeRate) || 1;
    return sum + round2(safe(tx.amount) / rate);
  }, 0));

  if (cashPaidUSD > 0) {
    // Determine payment account from first payment transaction
    const method = paidTxs[0]?.method || order.paymentMethod || 'cash';
    const currency = paidTxs[0]?.currency || 'USD';

    entries.push({
      date,
      debitAccount: cashAccount(method, currency),
      creditAccount: AccountCode.REVENUE,
      amount: Math.min(cashPaidUSD, revenueUSD),
      amountUZS: safe(order.totalAmountUZS),
      exchangeRate: safe(order.exchangeRate),
      description: `Выручка от продажи #${orderId} (${order.customerName})`,
      relatedType: 'order',
      relatedId: orderId,
    });
  }

  // Debt portion (from debt_obligation transactions)
  const debtUSD = round2(debtTxs.reduce((sum, tx) => {
    if (tx.currency === 'USD') return sum + safe(tx.amount);
    const rate = safe(tx.exchangeRate) || safe(order.exchangeRate) || 1;
    return sum + round2(safe(tx.amount) / rate);
  }, 0));

  if (debtUSD > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.ACCOUNTS_RECEIVABLE,
      creditAccount: AccountCode.REVENUE,
      amount: Math.min(debtUSD, revenueUSD - Math.min(cashPaidUSD, revenueUSD)),
      exchangeRate: safe(order.exchangeRate),
      description: `Дебиторка: продажа в долг #${orderId} (${order.customerName})`,
      relatedType: 'order',
      relatedId: orderId,
    });
  }

  // 2. COGS — Себестоимость
  if (totalCOGS > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.COGS,
      creditAccount: AccountCode.INVENTORY,
      amount: round2(totalCOGS),
      description: `Себестоимость продажи #${orderId}`,
      relatedType: 'order',
      relatedId: orderId,
    });
  }

  // 3. Output VAT — НДС к уплате
  if (vatAmount > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.REVENUE,
      creditAccount: AccountCode.VAT_PAYABLE,
      amount: round2(vatAmount),
      description: `НДС начислен: продажа #${orderId}`,
      relatedType: 'order',
      relatedId: orderId,
    });
  }

  return entries;
}

// ─── Client payment entries ──────────────────────────────────

export interface PaymentLedgerParams {
  transaction: Transaction;
  exchangeRate?: number;
}

/**
 * Generate ledger entry for a client debt payment.
 *   Дт 5010/5020/5110   Кт 4010  — Cash received, reduce receivable
 */
export function generatePaymentEntry(params: PaymentLedgerParams): EntryInput | null {
  const { transaction, exchangeRate } = params;

  if (transaction.type !== 'client_payment') return null;

  const amountUSD = transaction.currency === 'USD'
    ? safe(transaction.amount)
    : round2(safe(transaction.amount) / (safe(transaction.exchangeRate) || safe(exchangeRate) || 1));

  if (amountUSD <= 0) return null;

  return {
    date: transaction.date,
    debitAccount: cashAccount(transaction.method || 'cash', transaction.currency),
    creditAccount: AccountCode.ACCOUNTS_RECEIVABLE,
    amount: round2(amountUSD),
    amountUZS: transaction.currency === 'UZS' ? safe(transaction.amount) : undefined,
    exchangeRate: safe(transaction.exchangeRate) || safe(exchangeRate),
    description: `Оплата долга: ${transaction.description || transaction.id}`,
    relatedType: 'transaction',
    relatedId: transaction.id,
  };
}

// ─── Purchase entries ─────────────────────────────────────────

export interface PurchaseLedgerParams {
  purchase: Purchase;
  /** Total landed cost in USD (w/o VAT) — the actual inventory value */
  totalInventoryUSD: number;
  /** Input VAT amount in USD */
  inputVatUSD: number;
  /** Amount paid now in USD (may be 0 if fully on credit) */
  amountPaidUSD: number;
}

/**
 * Generate all ledger entries for a completed purchase.
 *
 * Standard output:
 *   Дт 2900  Кт 6010  $X — Inventory receipt (оприходование)
 *   Дт 4410  Кт 6010  $Y — Input VAT (НДС к возмещению)
 *   Дт 6010  Кт 5010  $Z — Supplier payment (if paid now)
 */
export function generatePurchaseEntries(params: PurchaseLedgerParams): EntryInput[] {
  const { purchase, totalInventoryUSD, inputVatUSD, amountPaidUSD } = params;
  const entries: EntryInput[] = [];
  const date = purchase.date;
  const purchaseId = purchase.id;

  // 1. Inventory receipt — Оприходование ТМЗ
  if (totalInventoryUSD > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.INVENTORY,
      creditAccount: AccountCode.ACCOUNTS_PAYABLE,
      amount: round2(totalInventoryUSD),
      amountUZS: safe(purchase.totalInvoiceAmountUZS) - safe(purchase.totalVatAmountUZS),
      exchangeRate: safe(purchase.exchangeRate),
      description: `Оприходование: закупка #${purchaseId} (${purchase.supplierName})`,
      relatedType: 'purchase',
      relatedId: purchaseId,
    });
  }

  // 2. Input VAT — НДС к возмещению
  if (inputVatUSD > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.VAT_RECEIVABLE,
      creditAccount: AccountCode.ACCOUNTS_PAYABLE,
      amount: round2(inputVatUSD),
      exchangeRate: safe(purchase.exchangeRate),
      description: `НДС входящий: закупка #${purchaseId}`,
      relatedType: 'purchase',
      relatedId: purchaseId,
    });
  }

  // 3. Supplier payment — if paid (partially or fully)
  if (amountPaidUSD > 0) {
    const method = purchase.paymentMethod || 'cash';
    entries.push({
      date,
      debitAccount: AccountCode.ACCOUNTS_PAYABLE,
      creditAccount: cashAccount(method),
      amount: round2(amountPaidUSD),
      amountUZS: safe(purchase.amountPaid),
      exchangeRate: safe(purchase.exchangeRate),
      description: `Оплата поставщику: закупка #${purchaseId} (${purchase.supplierName})`,
      relatedType: 'purchase',
      relatedId: purchaseId,
    });
  }

  return entries;
}

// ─── Expense entries ──────────────────────────────────────────

export interface ExpenseLedgerParams {
  transaction: Transaction;
  /** PnL category: administrative | commercial | operational */
  pnlCategory?: string;
}

/**
 * Generate ledger entry for an expense.
 *   Дт 9420/9410  Кт 5010/5020/5110
 */
export function generateExpenseEntry(params: ExpenseLedgerParams): EntryInput | null {
  const { transaction, pnlCategory } = params;

  if (transaction.type !== 'expense') return null;

  const amountUSD = transaction.currency === 'USD'
    ? safe(transaction.amount)
    : round2(safe(transaction.amount) / (safe(transaction.exchangeRate) || 1));

  if (amountUSD <= 0) return null;

  // Default to admin expense; can be refined per category
  const expenseAccount = pnlCategory === 'commercial'
    ? AccountCode.COMMERCIAL_EXPENSES
    : AccountCode.ADMIN_EXPENSES;

  return {
    date: transaction.date,
    debitAccount: expenseAccount,
    creditAccount: cashAccount(transaction.method || 'cash', transaction.currency),
    amount: round2(amountUSD),
    amountUZS: transaction.currency === 'UZS' ? safe(transaction.amount) : undefined,
    exchangeRate: safe(transaction.exchangeRate),
    description: transaction.description || `Расход: ${transaction.id}`,
    relatedType: 'expense',
    relatedId: transaction.id,
  };
}
