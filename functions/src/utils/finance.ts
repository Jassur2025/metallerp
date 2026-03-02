/**
 * Financial utility functions — server-side copies of client utils.
 * These MUST stay in sync with the client-side ledgerEntryGenerators logic.
 *
 * All amounts are in USD (base currency) unless noted otherwise.
 * Exchange rate: 1 USD = X UZS.
 * VAT rate: loaded from settings, default 12%.
 */

import { safeNum, round2 } from "./validation";

// ─── Account Codes (NSBU Uzbekistan) ────────────────────────

export enum AccountCode {
  FIXED_ASSETS = "0100",
  ACCUM_DEPRECIATION = "0200",
  INVENTORY = "2900",
  ACCOUNTS_RECEIVABLE = "4010",
  VAT_RECEIVABLE = "4410",
  CASH_USD = "5010",
  CASH_UZS = "5020",
  BANK_UZS = "5110",
  ACCOUNTS_PAYABLE = "6010",
  VAT_PAYABLE = "6410",
  SALARY_PAYABLE = "6710",
  EQUITY = "8300",
  RETAINED_EARNINGS = "8700",
  REVENUE = "9010",
  COGS = "9110",
  COMMERCIAL_EXPENSES = "9410",
  ADMIN_EXPENSES = "9420",
  DEPRECIATION_EXPENSE = "9430",
}

// ─── Ledger Entry type ──────────────────────────────────────

export interface LedgerEntryData {
  date: string;
  debitAccount: AccountCode;
  creditAccount: AccountCode;
  amount: number;
  amountUZS?: number;
  exchangeRate?: number;
  description: string;
  relatedType?: "order" | "purchase" | "expense" | "transaction" | "depreciation";
  relatedId?: string;
  periodId?: string;
  createdBy: string;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────

/** Map payment method + currency → correct cash/bank account code */
export function cashAccount(
  method: string,
  currency: string = "USD",
): AccountCode {
  if (method === "bank") return AccountCode.BANK_UZS;
  if (method === "card") return AccountCode.BANK_UZS;
  if (currency === "UZS") return AccountCode.CASH_UZS;
  return AccountCode.CASH_USD;
}

/** Weighted average cost: (oldQty * oldCost + newQty * newCost) / (oldQty + newQty) */
export function weightedAvgCost(
  oldQty: number,
  oldCost: number,
  newQty: number,
  newCost: number,
): number {
  const totalQty = oldQty + newQty;
  if (totalQty <= 0) return 0;
  return round2((oldQty * oldCost + newQty * newCost) / totalQty);
}

// ─── Sale ledger entries ────────────────────────────────────

interface SaleLedgerInput {
  orderId: string;
  customerName: string;
  date: string;
  revenueUSD: number;
  totalCOGS: number;
  vatAmount: number;
  exchangeRate: number;
  totalAmountUZS: number;
  paymentMethod: string;
  cashPaidUSD: number;
  debtUSD: number;
  paymentCurrency: string;
  createdBy: string;
}

export function generateSaleLedgerEntries(input: SaleLedgerInput): LedgerEntryData[] {
  const entries: LedgerEntryData[] = [];
  const now = new Date().toISOString();
  const {
    orderId, customerName, date, revenueUSD, totalCOGS, vatAmount,
    exchangeRate, totalAmountUZS, paymentMethod, cashPaidUSD, debtUSD,
    paymentCurrency, createdBy,
  } = input;

  if (revenueUSD <= 0) return entries;

  // 1. Cash/bank revenue portion
  if (cashPaidUSD > 0) {
    entries.push({
      date,
      debitAccount: cashAccount(paymentMethod, paymentCurrency),
      creditAccount: AccountCode.REVENUE,
      amount: Math.min(round2(cashPaidUSD), revenueUSD),
      amountUZS: totalAmountUZS,
      exchangeRate: safeNum(exchangeRate),
      description: `Выручка от продажи #${orderId} (${customerName})`,
      relatedType: "order",
      relatedId: orderId,
      createdBy,
      createdAt: now,
    });
  }

  // 2. Debt portion → receivable
  if (debtUSD > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.ACCOUNTS_RECEIVABLE,
      creditAccount: AccountCode.REVENUE,
      amount: Math.min(round2(debtUSD), revenueUSD - Math.min(round2(cashPaidUSD), revenueUSD)),
      exchangeRate: safeNum(exchangeRate),
      description: `Дебиторка: продажа в долг #${orderId} (${customerName})`,
      relatedType: "order",
      relatedId: orderId,
      createdBy,
      createdAt: now,
    });
  }

  // 3. COGS
  if (totalCOGS > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.COGS,
      creditAccount: AccountCode.INVENTORY,
      amount: round2(totalCOGS),
      description: `Себестоимость продажи #${orderId}`,
      relatedType: "order",
      relatedId: orderId,
      createdBy,
      createdAt: now,
    });
  }

  // 4. Output VAT
  if (vatAmount > 0) {
    entries.push({
      date,
      debitAccount: AccountCode.REVENUE,
      creditAccount: AccountCode.VAT_PAYABLE,
      amount: round2(vatAmount),
      description: `НДС начислен: продажа #${orderId}`,
      relatedType: "order",
      relatedId: orderId,
      createdBy,
      createdAt: now,
    });
  }

  return entries;
}
