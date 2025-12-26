import type { Client, Employee, Expense, FixedAsset, JournalEvent, Order, Product, Purchase, Transaction, WorkflowOrder } from '../../types';
import { cacheService } from '../cacheService';
import { cachedFetch } from './cache';
import { clearRange, fetchSheets, writeRange } from './api';
import { mergeById } from './merge';
import { initializeSheets } from './initialize';
import {
  mapClientToRow,
  mapEmployeeToRow,
  mapExpenseToRow,
  mapFixedAssetToRow,
  mapJournalEventToRow,
  mapOrderToRow,
  mapProductToRow,
  mapPurchaseToRow,
  mapRowToClient,
  mapRowToEmployee,
  mapRowToExpense,
  mapRowToFixedAsset,
  mapRowToJournalEvent,
  mapRowToOrder,
  mapRowToProduct,
  mapRowToPurchase,
  mapRowToTransaction,
  mapRowToWorkflowOrder,
  mapTransactionToRow,
  mapWorkflowOrderToRow,
} from './mappers';
import { getSpreadsheetId } from './spreadsheetId';
import { errorDev, logDev, warnDev } from './logger';

function filterDataRows(values: unknown[][]): unknown[][] {
  return values.filter((row) => Array.isArray(row) && row[0] && String(row[0]) !== 'ID');
}

async function getAll<T>(
  cacheKey: string,
  accessToken: string,
  range: string,
  mapRow: (row: unknown[]) => T,
  useCache: boolean
): Promise<T[]> {
  return cachedFetch(
    cacheKey,
    async () => {
      const data = await fetchSheets(accessToken, range);
      const rows = filterDataRows(data.values || []);
      return rows.map((r) => mapRow(r as unknown[]));
    },
    useCache
  );
}

async function saveAllWithMerge<T extends { id: string }>(
  cacheKey: string,
  accessToken: string,
  readRange: string,
  clearA1: string,
  writeA1: string,
  localItems: T[],
  mapRow: (row: unknown[]) => T,
  mapToRow: (t: T) => unknown[]
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not set');

  // Refresh
  let remoteItems: T[] = [];
  try {
    const data = await fetchSheets(accessToken, readRange);
    remoteItems = filterDataRows(data.values || []).map((r) => mapRow(r as unknown[]));
  } catch (e) {
    warnDev(`⚠️ Could not fetch remote ${cacheKey}, proceeding with local only`, e);
  }

  const merged = mergeById(localItems, remoteItems);
  logDev(`💾 Saving ${cacheKey}: merged=${merged.length} local=${localItems.length} remote=${remoteItems.length}`);

  await clearRange(accessToken, clearA1);
  await writeRange(accessToken, writeA1, merged.map(mapToRow));
  cacheService.invalidate(cacheKey);
}

export const sheetsService = {
  initialize: initializeSheets,

  // Workflow Orders
  getWorkflowOrders: (accessToken: string, useCache: boolean = true) =>
    getAll<WorkflowOrder>('workflowOrders', accessToken, 'WorkflowOrders!A2:U', mapRowToWorkflowOrder, useCache),

  saveAllWorkflowOrders: (accessToken: string, workflowOrders: WorkflowOrder[]) =>
    saveAllWithMerge<WorkflowOrder>(
      'workflowOrders',
      accessToken,
      'WorkflowOrders!A2:U',
      'WorkflowOrders!A2:U',
      'WorkflowOrders!A2:U',
      workflowOrders,
      mapRowToWorkflowOrder,
      mapWorkflowOrderToRow
    ),

  // Purchases
  getPurchases: (accessToken: string, useCache: boolean = true) =>
    getAll<Purchase>('purchases', accessToken, 'Purchases!A2:K', mapRowToPurchase, useCache),

  saveAllPurchases: (accessToken: string, purchases: Purchase[]) =>
    saveAllWithMerge<Purchase>(
      'purchases',
      accessToken,
      'Purchases!A2:K',
      'Purchases!A2:K',
      'Purchases!A2:K',
      purchases,
      mapRowToPurchase,
      mapPurchaseToRow
    ),

  // Products
  getProducts: (accessToken: string, useCache: boolean = true) =>
    getAll<Product>('products', accessToken, 'Products!A2:K', mapRowToProduct, useCache),

  saveAllProducts: (accessToken: string, products: Product[]) =>
    saveAllWithMerge<Product>(
      'products',
      accessToken,
      'Products!A2:K',
      'Products!A2:K',
      'Products!A2:K',
      products,
      mapRowToProduct,
      mapProductToRow
    ),

  // Orders
  getOrders: (accessToken: string, useCache: boolean = true) =>
    getAll<Order>('orders', accessToken, 'Orders!A2:P', mapRowToOrder, useCache),

  saveAllOrders: (accessToken: string, orders: Order[]) =>
    saveAllWithMerge<Order>(
      'orders',
      accessToken,
      'Orders!A2:P',
      'Orders!A2:P',
      'Orders!A2:P',
      orders,
      mapRowToOrder,
      mapOrderToRow
    ),

  // Expenses
  getExpenses: (accessToken: string, useCache: boolean = true) =>
    getAll<Expense>('expenses', accessToken, 'Expenses!A2:G', mapRowToExpense, useCache),

  saveAllExpenses: (accessToken: string, expenses: Expense[]) =>
    saveAllWithMerge<Expense>(
      'expenses',
      accessToken,
      'Expenses!A2:G',
      'Expenses!A2:G',
      'Expenses!A2:G',
      expenses,
      mapRowToExpense,
      mapExpenseToRow
    ),

  // Fixed Assets
  getFixedAssets: (accessToken: string, useCache: boolean = true) =>
    getAll<FixedAsset>('fixedAssets', accessToken, 'FixedAssets!A2:I', mapRowToFixedAsset, useCache),

  saveAllFixedAssets: (accessToken: string, assets: FixedAsset[]) =>
    saveAllWithMerge<FixedAsset>(
      'fixedAssets',
      accessToken,
      'FixedAssets!A2:I',
      'FixedAssets!A2:I',
      'FixedAssets!A2:I',
      assets,
      mapRowToFixedAsset,
      mapFixedAssetToRow
    ),

  // Clients
  getClients: (accessToken: string, useCache: boolean = true) =>
    getAll<Client>('clients', accessToken, 'Clients!A2:I', mapRowToClient, useCache),

  saveAllClients: (accessToken: string, clients: Client[]) =>
    saveAllWithMerge<Client>(
      'clients',
      accessToken,
      'Clients!A2:I',
      'Clients!A2:I',
      'Clients!A2:I',
      clients,
      mapRowToClient,
      mapClientToRow
    ),

  // Employees
  getEmployees: (accessToken: string, useCache: boolean = true) =>
    getAll<Employee>('employees', accessToken, 'Staff!A2:K', mapRowToEmployee, useCache),

  saveAllEmployees: (accessToken: string, employees: Employee[]) =>
    saveAllWithMerge<Employee>(
      'employees',
      accessToken,
      'Staff!A2:K',
      'Staff!A2:K',
      'Staff!A2:K',
      employees,
      mapRowToEmployee,
      mapEmployeeToRow
    ),

  testConnection: async (accessToken: string, providedId?: string) => {
    try {
      const spreadsheetId = providedId || getSpreadsheetId();
      if (!spreadsheetId) throw new Error('ID не установлен');

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Ошибка доступа');
      }
      return 'Успешно! Связь установлена.';
    } catch (e) {
      errorDev('testConnection error', e);
      throw e instanceof Error ? e : new Error('Ошибка соединения');
    }
  },

  // Transactions
  getTransactions: (accessToken: string, useCache: boolean = true) =>
    getAll<Transaction>('transactions', accessToken, 'Transactions!A2:I', mapRowToTransaction, useCache),

  saveAllTransactions: (accessToken: string, transactions: Transaction[]) =>
    saveAllWithMerge<Transaction>(
      'transactions',
      accessToken,
      'Transactions!A2:I',
      'Transactions!A2:I',
      'Transactions!A2:I',
      transactions,
      mapRowToTransaction,
      mapTransactionToRow
    ),

  // Journal
  getJournalEvents: (accessToken: string, useCache: boolean = true) =>
    getAll<JournalEvent>('journalEvents', accessToken, 'Journal!A2:M', mapRowToJournalEvent, useCache),

  addJournalEvent: async (accessToken: string, event: JournalEvent) => {
    try {
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) return;
      await fetchSheets(accessToken, 'Journal!A:M', 'POST', { values: [mapJournalEventToRow(event)] });
      cacheService.invalidate('journalEvents');
    } catch (e) {
      errorDev('addJournalEvent error', e);
      throw e;
    }
  },

  // Очистка всех данных для тестирования
  clearAllData: async (accessToken: string) => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) throw new Error('Spreadsheet ID not set');

    const ranges = [
      'Orders!A2:P',
      'Products!A2:K',
      'Expenses!A2:G',
      'Clients!A2:I',
      'Transactions!A2:I',
      'FixedAssets!A2:I',
      'Purchases!A2:K',
      'WorkflowOrders!A2:U',
      'Staff!A2:K',
      'Journal!A2:M',
    ];

    const errors: string[] = [];
    
    for (const range of ranges) {
      try {
        await clearRange(accessToken, range);
        logDev(`✅ Очищен: ${range}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnDev(`⚠️ Не удалось очистить ${range}: ${msg}`);
        errors.push(range.split('!')[0]);
      }
    }

    // Очистка локального кэша
    cacheService.invalidate('orders');
    cacheService.invalidate('products');
    cacheService.invalidate('expenses');
    cacheService.invalidate('clients');
    cacheService.invalidate('transactions');
    cacheService.invalidate('fixedAssets');
    cacheService.invalidate('purchases');
    cacheService.invalidate('workflowOrders');
    cacheService.invalidate('employees');
    cacheService.invalidate('journalEvents');

    if (errors.length > 0) {
      throw new Error(`Не удалось очистить: ${errors.join(', ')}`);
    }

    return 'Все данные успешно удалены!';
  },
};








