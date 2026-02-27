/**
 * useBalance hook
 * Computes balance from current app data, caches to Firestore,
 * and returns the result for display.
 */

import { useMemo, useEffect, useRef } from 'react';
import { Product, Order, Expense, FixedAsset, AppSettings, Transaction, Client, Purchase, BalanceData } from '../types';
import { computeBalance, balanceService } from '../services/balanceService';
import { logger } from '../utils/logger';

interface UseBalanceInput {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  fixedAssets: FixedAsset[];
  settings: AppSettings;
  transactions: Transaction[];
  clients: Client[];
  purchases: Purchase[];
}

interface UseBalanceReturn {
  balance: BalanceData;
}

/**
 * Computes the company balance from live data and persists to Firestore.
 * The computation runs on every data change (via useMemo).
 * A debounced save writes the result to Firestore every 5 seconds at most.
 */
export function useBalance(input: UseBalanceInput): UseBalanceReturn {
  const { products, orders, expenses, fixedAssets, settings, transactions, clients, purchases } = input;

  // Compute balance reactively
  const balance = useMemo(() => {
    return computeBalance({
      products,
      orders,
      expenses,
      fixedAssets,
      settings,
      transactions,
      clients,
      purchases,
    });
  }, [products, orders, expenses, fixedAssets, settings, transactions, clients, purchases]);

  // Persist to Firestore (debounced to avoid excessive writes)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      balanceService.save(balance).catch((err) => logger.error('useBalance', 'Error saving balance:', err));
    }, 5000); // 5s debounce

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [balance]);

  return { balance };
}
