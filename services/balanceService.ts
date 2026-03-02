/**
 * Balance Service - Firebase Firestore
 * Computes company balance (Assets/Liabilities) and caches in Firestore.
 * All calculation logic lives here, not in the UI component.
 */

import {
  db,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from '../lib/firebase';
import {
  Product, Order, Expense, FixedAsset, AppSettings,
  Transaction, Client, Purchase, WarehouseType, BalanceData
} from '../types';
import { calculateBaseTotals, CorrectionDetails, num, getSafeRate } from '../utils/finance';
import { logger } from '../utils/logger';

const BALANCE_COLLECTION = 'balance';
const BALANCE_DOC = 'current';

// ─── Helpers ───

const getRate = (rate: unknown, settings: AppSettings): number => {
  return getSafeRate(rate, num(settings.defaultExchangeRate));
};

// ─── Core Calculation ───

export interface ComputeBalanceInput {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  fixedAssets: FixedAsset[];
  settings: AppSettings;
  transactions: Transaction[];
  clients: Client[];
  purchases: Purchase[];
}

/**
 * Compute the full company balance from raw data.
 * Pure function — no side effects, no Firestore calls.
 */
export function computeBalance(input: ComputeBalanceInput): BalanceData {
  const {
    products = [],
    orders = [],
    expenses = [],
    fixedAssets = [],
    settings,
    transactions = [],
    clients = [],
    purchases = [],
  } = input;

  const currentRate = getRate(null, settings);

  // ═══ ASSETS ═══

  // 1. Inventory by warehouse (at cost price)
  const inventoryByWarehouse = {
    main: products
      .filter(p => (p.warehouse || WarehouseType.MAIN) === WarehouseType.MAIN)
      .reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0),
    cloud: products
      .filter(p => p.warehouse === WarehouseType.CLOUD)
      .reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0),
  };
  const inventoryValue = inventoryByWarehouse.main + inventoryByWarehouse.cloud;

  // 2. Liquid assets (Cash/Bank/Card) via centralized logic
  const { cashUSD, cashUZS, bankUZS, cardUZS, corrections } = calculateBaseTotals(
    orders, transactions, expenses, settings.defaultExchangeRate,
  );
  const totalCashUSD = cashUSD + (cashUZS / currentRate);
  const netBankUSD = bankUZS / currentRate;
  const netCardUSD = cardUZS / currentRate;
  const totalLiquidAssets = totalCashUSD + netBankUSD + netCardUSD;

  // 3. Fixed assets
  const fixedAssetsValue = fixedAssets.reduce((sum, a) => sum + (a.currentValue || 0), 0);

  // 4. Accounts receivable (client debts)
  const accountsReceivable = clients.reduce((sum, c) => sum + (c.totalDebt || 0), 0);

  const totalAssets = inventoryValue + totalLiquidAssets + accountsReceivable + fixedAssetsValue;

  // ═══ PASSIVES ═══

  // 1. VAT liability
  const vatOutput = orders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);
  const vatInput = purchases.reduce((sum, p) => {
    if (p.totalVatAmountUZS && p.totalVatAmountUZS > 0) {
      const pRate = p.exchangeRate || settings.defaultExchangeRate || currentRate;
      return sum + (p.totalVatAmountUZS / pRate);
    }
    if (p.items && Array.isArray(p.items)) {
      const itemsVat = p.items.reduce((s: number, item: { vatAmount?: number }) => s + (item.vatAmount || 0), 0);
      if (itemsVat > 0) {
        const pRate = p.exchangeRate || settings.defaultExchangeRate || currentRate;
        return sum + (itemsVat / pRate);
      }
    }
    return sum;
  }, 0);
  const vatLiability = Math.max(0, vatOutput - vatInput);

  // 2. Accounts payable (supplier debt)
  const accountsPayable = purchases.reduce((sum, p) => {
    const purchaseRate = p.exchangeRate || settings.defaultExchangeRate || currentRate;
    if (p.totalInvoiceAmountUZS && p.totalInvoiceAmountUZS > 0) {
      const totalDebtUZS = (p.totalInvoiceAmountUZS || 0) - (p.amountPaid || 0);
      return sum + Math.max(0, totalDebtUZS / purchaseRate);
    }
    const amountPaidUSD = (p.amountPaidUSD !== undefined && p.amountPaidUSD !== null)
      ? p.amountPaidUSD
      : (p.amountPaid || 0);
    return sum + Math.max(0, (p.totalInvoiceAmount || 0) - amountPaidUSD);
  }, 0);

  // 3. Fixed assets payable
  const fixedAssetsPayable = fixedAssets.reduce((sum, fa) => {
    const paid = fa.amountPaid ?? fa.purchaseCost;
    return sum + Math.max(0, fa.purchaseCost - paid);
  }, 0);

  // 4. Equity (capital invested in inventory)
  const equity = purchases.reduce((sum, p) => {
    if (p.amountPaidUSD !== undefined) return sum + (p.amountPaidUSD || 0);
    return sum + (p.amountPaid || 0);
  }, 0);

  // 5. Fixed assets fund
  const fixedAssetsFund = Math.max(0, fixedAssetsValue - fixedAssetsPayable);

  // ═══ P&L SUMMARY ═══

  const totalExpenses = expenses.reduce((sum, e) => {
    const rate = e.exchangeRate || settings.defaultExchangeRate || 1;
    return sum + (e.currency === 'UZS' ? (e.amount || 0) / rate : (e.amount || 0));
  }, 0);

  const revenue = orders.reduce((sum, o) => sum + (o.subtotalAmount || 0), 0);
  const cogs = orders.reduce((sumO, o) => {
    if (!o.items || !Array.isArray(o.items)) return sumO;
    return sumO + o.items.reduce((sumI, item) => sumI + ((item.quantity || 0) * (item.costAtSale || 0)), 0);
  }, 0);
  const grossProfit = revenue - cogs;
  const totalDepreciation = fixedAssets.reduce((sum, fa) => sum + (fa.accumulatedDepreciation || 0), 0);
  const netProfit = grossProfit - totalExpenses - totalDepreciation;

  // Retained earnings (balancing item: Assets = Passives)
  const retainedEarnings = totalAssets - equity - fixedAssetsFund - vatLiability - accountsPayable - fixedAssetsPayable;
  const totalPassives = equity + fixedAssetsFund + retainedEarnings + vatLiability + accountsPayable + fixedAssetsPayable;

  return {
    inventoryValue,
    inventoryByWarehouse,
    cashUSD, cashUZS, bankUZS, cardUZS,
    totalCashUSD, netBankUSD, netCardUSD, totalLiquidAssets,
    fixedAssetsValue,
    accountsReceivable,
    totalAssets,
    vatOutput, vatInput, vatLiability,
    accountsPayable,
    fixedAssetsPayable,
    equity,
    fixedAssetsFund,
    retainedEarnings,
    totalPassives,
    revenue, cogs, grossProfit,
    totalExpenses, totalDepreciation, netProfit,
    corrections,
    exchangeRate: currentRate,
    computedAt: new Date().toISOString(),
  };
}

// ─── Firestore Persistence ───

export const balanceService = {
  /**
   * Save computed balance snapshot to Firestore
   */
  async save(data: BalanceData): Promise<void> {
    try {
      const docRef = doc(db, BALANCE_COLLECTION, BALANCE_DOC);
      await setDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (error) {
      logger.error('BalanceService', 'Error saving balance:', error);
    }
  },

  /**
   * Get cached balance from Firestore
   */
  async get(): Promise<BalanceData | null> {
    try {
      const docRef = doc(db, BALANCE_COLLECTION, BALANCE_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const { updatedAt, ...data } = snap.data();
        return data as BalanceData;
      }
      return null;
    } catch (error) {
      logger.error('BalanceService', 'Error fetching balance:', error);
      return null;
    }
  },
};
