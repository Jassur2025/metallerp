import type { Client, Employee, Expense, FixedAsset, JournalEvent, Order, Product, Purchase, Transaction, WorkflowOrder } from '../../types';
import { cacheService } from '../cacheService';
import { cachedFetch } from './cache';
import { clearRange, fetchSheets, writeRange } from './api';
import { mergeById, mergeByIdWithVersion, withIncrementedVersion, withIncrementedVersionBatch, hasVersionConflict } from './merge';
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

// Глобальные мьютексы для предотвращения одновременной записи
const writeLocks = new Map<string, Promise<void>>();

/**
 * Простой мьютекс для последовательной записи в одну таблицу
 */
async function withWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Ждём завершения предыдущей записи (если есть)
  const existingLock = writeLocks.get(key);
  if (existingLock) {
    logDev(`🔒 Ожидание завершения предыдущей записи для ${key}...`);
    await existingLock;
  }

  // Создаём новый лок
  let resolve: () => void;
  const newLock = new Promise<void>(r => { resolve = r; });
  writeLocks.set(key, newLock);

  try {
    return await fn();
  } finally {
    resolve!();
    writeLocks.delete(key);
  }
}

function filterDataRows(values: unknown[][]): unknown[][] {
  return values.filter((row) => Array.isArray(row) && row[0] && String(row[0]) !== 'ID');
}

/**
 * Вычисляет хеш массива ID + версий для быстрого сравнения
 */
function computeDataHash<T extends { id: string; _version?: number }>(items: T[]): string {
  return items.map(i => `${i.id}:${i._version ?? 0}`).sort().join('|');
}

/**
 * Callback для обработки конфликтов версий
 */
type ConflictHandler<T> = (conflicts: Array<{ local: T; remote: T }>) => void;

/**
 * Глобальный обработчик конфликтов (может быть установлен из UI)
 */
let globalConflictHandler: ConflictHandler<unknown> | null = null;

export function setConflictHandler<T>(handler: ConflictHandler<T> | null): void {
  globalConflictHandler = handler as ConflictHandler<unknown> | null;
}

function notifyConflicts<T>(conflicts: Array<{ local: T; remote: T }>, entityType: string): void {
  if (conflicts.length === 0) return;

  warnDev(`⚠️ Обнаружены конфликты версий в ${entityType}:`, conflicts.map(c => ({
    id: (c.local as { id: string }).id,
    localVersion: (c.local as { _version?: number })._version,
    remoteVersion: (c.remote as { _version?: number })._version
  })));

  if (globalConflictHandler) {
    globalConflictHandler(conflicts);
  }
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

/**
 * Максимальное количество попыток при конфликте записи
 */
const MAX_CONFLICT_RETRIES = 3;

/**
 * Безопасное сохранение: Экспорт данных из Firebase в Google Sheets.
 * 
 * Алгоритм (One-Way Sync):
 * 1. Блокировка записи (мьютекс) - предотвращаем параллельные записи.
 * 2. Полная перезапись диапазона данными из приложения.
 * 
 * ВАЖНО: Мы больше НЕ читаем данные из Sheets для слияния. Firebase - единственный источник правды.
 */
async function saveAllWithMerge<T>(
  cacheKey: string,
  accessToken: string,
  readRange: string, // Больше не используется для чтения, только как идентификатор
  clearA1: string,
  writeA1: string,
  localItems: T[],
  mapRow: (row: unknown[]) => T, // Больше не используется
  mapToRow: (t: T) => unknown[]
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not set');

  // Используем мьютекс для предотвращения одновременной записи
  return withWriteLock(cacheKey, async () => {
    try {
      logDev(`💾 Exporting ${cacheKey} to Sheets (Count: ${localItems.length})...`);

      const dataToWrite = localItems.map(mapToRow);

      // 1. Очищаем старые данные (чтобы не осталось "хвостов" если записей стало меньше)
      // ВАЖНО: Очищаем диапазон с запасом или используем динамическую очистку если возможно
      await clearRange(accessToken, clearA1);

      // 2. Если есть данные - пишем
      if (dataToWrite.length > 0) {
        await writeRange(accessToken, writeA1, dataToWrite);
      }

      // 3. Инвалидируем кэш (хотя он теперь используется только для чтения при старте, если нужно)
      cacheService.invalidate(cacheKey);

      logDev(`✅ ${cacheKey} успешно экспортирован в Google Sheets`);
    } catch (e) {
      errorDev(`Ошибка экспорта ${cacheKey}`, e);
      throw new Error(`Не удалось экспортировать ${cacheKey} в Google Sheets. Проверьте соединение.`);
    }
  });
}

export const sheetsService = {
  initialize: initializeSheets,

  // Workflow Orders
  getWorkflowOrders: (accessToken: string, useCache: boolean = true) =>
    getAll<WorkflowOrder>('workflowOrders', accessToken, 'WorkflowOrders!A2:Y', mapRowToWorkflowOrder, useCache),

  saveAllWorkflowOrders: (accessToken: string, workflowOrders: WorkflowOrder[]) =>
    saveAllWithMerge<WorkflowOrder>(
      'workflowOrders',
      accessToken,
      'WorkflowOrders!A2:Y',
      'WorkflowOrders!A2:Y',
      'WorkflowOrders!A2:Y',
      workflowOrders,
      mapRowToWorkflowOrder,
      mapWorkflowOrderToRow
    ),

  // Purchases (A-T: id, date, supplier, items, totalAmount, status, notes, paymentMethod, paidAmount, invoiceNumber, currency, createdAt, updatedAt, exchangeRate, paymentCurrency, amountPaidUSD, totalInvoiceAmountUZS, totalVatAmountUZS, totalWithoutVatUZS, warehouse)
  getPurchases: (accessToken: string, useCache: boolean = true) =>
    getAll<Purchase>('purchases', accessToken, 'Purchases!A2:T', mapRowToPurchase, useCache),

  saveAllPurchases: (accessToken: string, purchases: Purchase[]) =>
    saveAllWithMerge<Purchase>(
      'purchases',
      accessToken,
      'Purchases!A2:T',
      'Purchases!A2:T',
      'Purchases!A2:T',
      purchases,
      mapRowToPurchase,
      mapPurchaseToRow
    ),

  // Products (A-N: id, name, type, dimensions, steelGrade, quantity, unit, pricePerUnit, costPrice, minStockLevel, origin, warehouse, updatedAt, _version)
  getProducts: (accessToken: string, useCache: boolean = true) =>
    getAll<Product>('products', accessToken, 'Products!A2:N', mapRowToProduct, useCache),

  saveAllProducts: (accessToken: string, products: Product[]) =>
    saveAllWithMerge<Product>(
      'products',
      accessToken,
      'Products!A2:N',
      'Products!A2:N',
      'Products!A2:N',
      products,
      mapRowToProduct,
      mapProductToRow
    ),

  // Orders
  getOrders: (accessToken: string, useCache: boolean = true) =>
    getAll<Order>('orders', accessToken, 'Orders!A2:U', mapRowToOrder, useCache),

  saveAllOrders: (accessToken: string, orders: Order[]) =>
    saveAllWithMerge<Order>(
      'orders',
      accessToken,
      'Orders!A2:U',
      'Orders!A2:U',
      'Orders!A2:U',
      orders,
      mapRowToOrder,
      mapOrderToRow
    ),

  // Expenses
  getExpenses: (accessToken: string, useCache: boolean = true) =>
    getAll<Expense>('expenses', accessToken, 'Expenses!A2:I', mapRowToExpense, useCache),

  saveAllExpenses: (accessToken: string, expenses: Expense[]) =>
    saveAllWithMerge<Expense>(
      'expenses',
      accessToken,
      'Expenses!A2:I',
      'Expenses!A2:I',
      'Expenses!A2:I',
      expenses,
      mapRowToExpense,
      mapExpenseToRow
    ),

  // Fixed Assets
  getFixedAssets: (accessToken: string, useCache: boolean = true) =>
    getAll<FixedAsset>('fixedAssets', accessToken, 'FixedAssets!A2:K', mapRowToFixedAsset, useCache),

  saveAllFixedAssets: (accessToken: string, assets: FixedAsset[]) =>
    saveAllWithMerge<FixedAsset>(
      'fixedAssets',
      accessToken,
      'FixedAssets!A2:K',
      'FixedAssets!A2:K',
      'FixedAssets!A2:K',
      assets,
      mapRowToFixedAsset,
      mapFixedAssetToRow
    ),

  // Clients
  getClients: (accessToken: string, useCache: boolean = true) =>
    getAll<Client>('clients', accessToken, 'Clients!A2:R', mapRowToClient, useCache),

  saveAllClients: (accessToken: string, clients: Client[]) =>
    saveAllWithMerge<Client>(
      'clients',
      accessToken,
      'Clients!A2:R',
      'Clients!A2:R',
      'Clients!A2:R',
      clients,
      mapRowToClient,
      mapClientToRow
    ),

  // Employees
  getEmployees: (accessToken: string, useCache: boolean = true) =>
    getAll<Employee>('employees', accessToken, 'Staff!A2:P', mapRowToEmployee, useCache),

  saveAllEmployees: (accessToken: string, employees: Employee[]) =>
    saveAllWithMerge<Employee>(
      'employees',
      accessToken,
      'Staff!A2:P',
      'Staff!A2:P',
      'Staff!A2:P',
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
    getAll<Transaction>('transactions', accessToken, 'Transactions!A2:K', mapRowToTransaction, useCache),

  saveAllTransactions: (accessToken: string, transactions: Transaction[]) =>
    saveAllWithMerge<Transaction>(
      'transactions',
      accessToken,
      'Transactions!A2:K',
      'Transactions!A2:K',
      'Transactions!A2:K',
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
      'Orders!A2:U',
      'Products!A2:N',
      'Expenses!A2:I',
      'Clients!A2:R',
      'Transactions!A2:K',
      'FixedAssets!A2:K',
      'Purchases!A2:T',
      'WorkflowOrders!A2:Y',
      'Staff!A2:P',
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

// Re-export версионные утилиты для использования в компонентах
export { mergeById, mergeByIdWithVersion, withIncrementedVersion, withIncrementedVersionBatch, hasVersionConflict };

// Export конфликт-хендлер отдельно (он определён в этом файле)
// setConflictHandler уже экспортируется выше через export function


