import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { sheetsService } from '../services/sheetsService';
import { getErrorMessage } from '../utils/errorHandler';
import { Product, Order, Expense, FixedAsset, Client, Employee, Transaction, Purchase, JournalEvent } from '../types';

interface UseSheetsReturn {
  isLoading: boolean;
  error: string | null;
  saveProducts: (products: Product[]) => Promise<boolean>;
  saveOrders: (orders: Order[]) => Promise<boolean>;
  saveExpenses: (expenses: Expense[]) => Promise<boolean>;
  saveFixedAssets: (assets: FixedAsset[]) => Promise<boolean>;
  saveClients: (clients: Client[]) => Promise<boolean>;
  saveEmployees: (employees: Employee[]) => Promise<boolean>;
  saveTransactions: (transactions: Transaction[]) => Promise<boolean>;
  savePurchases: (purchases: Purchase[]) => Promise<boolean>;
  addJournalEvent: (event: JournalEvent) => Promise<boolean>;
  saveAll: (data: {
    products?: Product[];
    orders?: Order[];
    expenses?: Expense[];
    fixedAssets?: FixedAsset[];
    clients?: Client[];
    employees?: Employee[];
    transactions?: Transaction[];
    purchases?: Purchase[];
  }) => Promise<boolean>;
}

export const useSheets = (): UseSheetsReturn => {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown, context: string) => {
    const errorMessage = getErrorMessage(err);
    setError(errorMessage);
    toast.error(`${context}: ${errorMessage}`);
    console.error(`[${context}]`, err);
    return false;
  }, [toast]);

  const saveProducts = useCallback(async (products: Product[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllProducts(accessToken, products);
      toast.success(`Товары успешно сохранены (${products.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении товаров');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const saveOrders = useCallback(async (orders: Order[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllOrders(accessToken, orders);
      toast.success(`Заказы успешно сохранены (${orders.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении заказов');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const saveExpenses = useCallback(async (expenses: Expense[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllExpenses(accessToken, expenses);
      toast.success(`Расходы успешно сохранены (${expenses.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении расходов');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const saveFixedAssets = useCallback(async (assets: FixedAsset[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllFixedAssets(accessToken, assets);
      toast.success(`Основные средства успешно сохранены (${assets.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении основных средств');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const saveClients = useCallback(async (clients: Client[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllClients(accessToken, clients);
      toast.success(`Клиенты успешно сохранены (${clients.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении клиентов');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const saveEmployees = useCallback(async (employees: Employee[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllEmployees(accessToken, employees);
      toast.success(`Сотрудники успешно сохранены (${employees.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении сотрудников');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const saveTransactions = useCallback(async (transactions: Transaction[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllTransactions(accessToken, transactions);
      toast.success(`Транзакции успешно сохранены (${transactions.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении транзакций');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const savePurchases = useCallback(async (purchases: Purchase[]): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sheetsService.saveAllPurchases(accessToken, purchases);
      toast.success(`Закупки успешно сохранены (${purchases.length} шт.)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении закупок');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  const addJournalEvent = useCallback(async (event: JournalEvent): Promise<boolean> => {
    if (!accessToken) {
      // Journal events are not critical, so we don't show warning
      return false;
    }
    try {
      await sheetsService.addJournalEvent(accessToken, event);
      return true;
    } catch (err) {
      console.error('Failed to save journal event', err);
      return false;
    }
  }, [accessToken]);

  const saveAll = useCallback(async (data: {
    products?: Product[];
    orders?: Order[];
    expenses?: Expense[];
    fixedAssets?: FixedAsset[];
    clients?: Client[];
    employees?: Employee[];
    transactions?: Transaction[];
    purchases?: Purchase[];
  }): Promise<boolean> => {
    if (!accessToken) {
      toast.warning('Токен доступа не найден. Войдите заново.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const promises: Promise<void>[] = [];
      
      if (data.products) promises.push(sheetsService.saveAllProducts(accessToken, data.products));
      if (data.orders) promises.push(sheetsService.saveAllOrders(accessToken, data.orders));
      if (data.expenses) promises.push(sheetsService.saveAllExpenses(accessToken, data.expenses));
      if (data.fixedAssets) promises.push(sheetsService.saveAllFixedAssets(accessToken, data.fixedAssets));
      if (data.clients) promises.push(sheetsService.saveAllClients(accessToken, data.clients));
      if (data.employees) promises.push(sheetsService.saveAllEmployees(accessToken, data.employees));
      if (data.transactions) promises.push(sheetsService.saveAllTransactions(accessToken, data.transactions));
      if (data.purchases) promises.push(sheetsService.saveAllPurchases(accessToken, data.purchases));

      await Promise.all(promises);
      
      const savedCount = Object.keys(data).length;
      toast.success(`Все данные успешно сохранены (${savedCount} модулей)`);
      return true;
    } catch (err) {
      return handleError(err, 'Ошибка при сохранении данных');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast, handleError]);

  return {
    isLoading,
    error,
    saveProducts,
    saveOrders,
    saveExpenses,
    saveFixedAssets,
    saveClients,
    saveEmployees,
    saveTransactions,
    savePurchases,
    addJournalEvent,
    saveAll
  };
};








