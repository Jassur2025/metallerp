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
 * Вычисляет хеш массива ID для быстрого сравнения
 */
function computeDataHash<T extends { id: string }>(items: T[]): string {
  return items.map(i => i.id).sort().join('|');
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
 * Безопасное сохранение с защитой от race condition.
 * 
 * Алгоритм:
 * 1. Блокировка записи (мьютекс) - только один процесс пишет в таблицу
 * 2. Читаем актуальные данные из Google Sheets
 * 3. Merge локальных и удалённых данных
 * 4. Перед записью ещё раз проверяем - не изменились ли данные
 * 5. Если изменились - повторяем merge с новыми данными
 * 6. Записываем результат
 */
async function saveAllWithMerge<T extends { id: string; updatedAt?: string }>(
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

  // Используем мьютекс для предотвращения одновременной записи в одну таблицу
  return withWriteLock(cacheKey, async () => {
    let retries = 0;
    
    while (retries < MAX_CONFLICT_RETRIES) {
      // 1. Читаем актуальные данные
      let remoteItems: T[] = [];
      try {
        const data = await fetchSheets(accessToken, readRange);
        remoteItems = filterDataRows(data.values || []).map((r) => mapRow(r as unknown[]));
      } catch (e) {
        warnDev(`⚠️ Could not fetch remote ${cacheKey}, proceeding with local only`, e);
      }

      const initialHash = computeDataHash(remoteItems);

      // 2. Merge локальные и удалённые данные
      const merged = mergeById(localItems, remoteItems);
      logDev(`💾 Saving ${cacheKey}: merged=${merged.length} local=${localItems.length} remote=${remoteItems.length} (attempt ${retries + 1})`);

      // 3. Перед записью - проверяем не изменились ли данные (double-check)
      let currentRemote: T[] = [];
      try {
        const checkData = await fetchSheets(accessToken, readRange);
        currentRemote = filterDataRows(checkData.values || []).map((r) => mapRow(r as unknown[]));
      } catch (e) {
        // Если не удалось перечитать - пишем как есть
        warnDev(`⚠️ Could not re-check ${cacheKey} before write`, e);
      }

      const currentHash = computeDataHash(currentRemote);

      // 4. Если данные изменились между чтением и записью - conflict!
      if (initialHash !== currentHash && currentRemote.length > 0) {
        retries++;
        warnDev(`⚠️ Конфликт записи ${cacheKey}! Данные изменились другим пользователем. Повтор merge (попытка ${retries}/${MAX_CONFLICT_RETRIES})`);
        
        // Повторяем merge с новыми данными
        const reMerged = mergeById(localItems, currentRemote);
        
        if (reMerged.length === 0) {
          await clearRange(accessToken, clearA1);
          cacheService.invalidate(cacheKey);
          return;
        }

        const dataToWrite = reMerged.map(mapToRow);
        
        // Добавляем пустые строки если нужно
        if (currentRemote.length > reMerged.length) {
          const extraRowsCount = currentRemote.length - reMerged.length + 5;
          const columnsCount = dataToWrite[0].length;
          const emptyRow = new Array(columnsCount).fill('');
          for (let i = 0; i < extraRowsCount; i++) {
            dataToWrite.push(emptyRow);
          }
        }

        await writeRange(accessToken, writeA1, dataToWrite);
        cacheService.invalidate(cacheKey);
        logDev(`✅ ${cacheKey} сохранён после разрешения конфликта`);
        return;
      }

      // 5. Нет конфликта - пишем
      if (merged.length === 0) {
        await clearRange(accessToken, clearA1);
      } else {
        const dataToWrite = merged.map(mapToRow);

        if (remoteItems.length > merged.length) {
          const extraRowsCount = remoteItems.length - merged.length + 5;
          const columnsCount = dataToWrite[0].length;
          const emptyRow = new Array(columnsCount).fill('');
          for (let i = 0; i < extraRowsCount; i++) {
            dataToWrite.push(emptyRow);
          }
        }

        await writeRange(accessToken, writeA1, dataToWrite);
      }
      
      cacheService.invalidate(cacheKey);
      logDev(`✅ ${cacheKey} успешно сохранён`);
      return;
    }

    // Исчерпаны все попытки
    throw new Error(`Не удалось сохранить ${cacheKey}: слишком много конфликтов записи. Попробуйте ещё раз.`);
  });
}

export const sheetsService = {
  initialize: initializeSheets,

  // Workflow Orders
  getWorkflowOrders: (accessToken: string, useCache: boolean = true) =>
    getAll<WorkflowOrder>('workflowOrders', accessToken, 'WorkflowOrders!A2:X', mapRowToWorkflowOrder, useCache),

  saveAllWorkflowOrders: (accessToken: string, workflowOrders: WorkflowOrder[]) =>
    saveAllWithMerge<WorkflowOrder>(
      'workflowOrders',
      accessToken,
      'WorkflowOrders!A2:X',
      'WorkflowOrders!A2:X',
      'WorkflowOrders!A2:X',
      workflowOrders,
      mapRowToWorkflowOrder,
      mapWorkflowOrderToRow
    ),

  // Purchases
  getPurchases: (accessToken: string, useCache: boolean = true) =>
    getAll<Purchase>('purchases', accessToken, 'Purchases!A2:L', mapRowToPurchase, useCache),

  saveAllPurchases: (accessToken: string, purchases: Purchase[]) =>
    saveAllWithMerge<Purchase>(
      'purchases',
      accessToken,
      'Purchases!A2:L',
      'Purchases!A2:L',
      'Purchases!A2:L',
      purchases,
      mapRowToPurchase,
      mapPurchaseToRow
    ),

  // Products
  getProducts: (accessToken: string, useCache: boolean = true) =>
    getAll<Product>('products', accessToken, 'Products!A2:L', mapRowToProduct, useCache),

  saveAllProducts: (accessToken: string, products: Product[]) =>
    saveAllWithMerge<Product>(
      'products',
      accessToken,
      'Products!A2:L',
      'Products!A2:L',
      'Products!A2:L',
      products,
      mapRowToProduct,
      mapProductToRow
    ),

  // Orders
  getOrders: (accessToken: string, useCache: boolean = true) =>
    getAll<Order>('orders', accessToken, 'Orders!A2:R', mapRowToOrder, useCache),

  saveAllOrders: (accessToken: string, orders: Order[]) =>
    saveAllWithMerge<Order>(
      'orders',
      accessToken,
      'Orders!A2:R',
      'Orders!A2:R',
      'Orders!A2:R',
      orders,
      mapRowToOrder,
      mapOrderToRow
    ),

  // Expenses
  getExpenses: (accessToken: string, useCache: boolean = true) =>
    getAll<Expense>('expenses', accessToken, 'Expenses!A2:H', mapRowToExpense, useCache),

  saveAllExpenses: (accessToken: string, expenses: Expense[]) =>
    saveAllWithMerge<Expense>(
      'expenses',
      accessToken,
      'Expenses!A2:H',
      'Expenses!A2:H',
      'Expenses!A2:H',
      expenses,
      mapRowToExpense,
      mapExpenseToRow
    ),

  // Fixed Assets
  getFixedAssets: (accessToken: string, useCache: boolean = true) =>
    getAll<FixedAsset>('fixedAssets', accessToken, 'FixedAssets!A2:J', mapRowToFixedAsset, useCache),

  saveAllFixedAssets: (accessToken: string, assets: FixedAsset[]) =>
    saveAllWithMerge<FixedAsset>(
      'fixedAssets',
      accessToken,
      'FixedAssets!A2:J',
      'FixedAssets!A2:J',
      'FixedAssets!A2:J',
      assets,
      mapRowToFixedAsset,
      mapFixedAssetToRow
    ),

  // Clients
  getClients: (accessToken: string, useCache: boolean = true) =>
    getAll<Client>('clients', accessToken, 'Clients!A2:Q', mapRowToClient, useCache),

  saveAllClients: (accessToken: string, clients: Client[]) =>
    saveAllWithMerge<Client>(
      'clients',
      accessToken,
      'Clients!A2:Q',
      'Clients!A2:Q',
      'Clients!A2:Q',
      clients,
      mapRowToClient,
      mapClientToRow
    ),

  // Employees
  getEmployees: (accessToken: string, useCache: boolean = true) =>
    getAll<Employee>('employees', accessToken, 'Staff!A2:O', mapRowToEmployee, useCache),

  saveAllEmployees: (accessToken: string, employees: Employee[]) =>
    saveAllWithMerge<Employee>(
      'employees',
      accessToken,
      'Staff!A2:O',
      'Staff!A2:O',
      'Staff!A2:O',
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
    getAll<Transaction>('transactions', accessToken, 'Transactions!A2:J', mapRowToTransaction, useCache),

  saveAllTransactions: (accessToken: string, transactions: Transaction[]) =>
    saveAllWithMerge<Transaction>(
      'transactions',
      accessToken,
      'Transactions!A2:J',
      'Transactions!A2:J',
      'Transactions!A2:J',
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
      'Orders!A2:R',
      'Products!A2:L',
      'Expenses!A2:H',
      'Clients!A2:Q',
      'Transactions!A2:J',
      'FixedAssets!A2:J',
      'Purchases!A2:L',
      'WorkflowOrders!A2:X',
      'Staff!A2:O',
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








