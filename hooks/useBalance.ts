/**
 * useBalance hook (Задача 7.2)
 *
 * Primary: subscribes to `balance/current` via onSnapshot (server-computed).
 * Fallback: if no server balance exists yet, computes locally and triggers
 * the Cloud Function to write the initial balance.
 *
 * The hook no longer does heavy computation on every data change — it just
 * listens to the pre-computed document written by the `computeBalance` CF.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Product, Order, Expense, FixedAsset, AppSettings, Transaction, Client, Purchase, BalanceData } from '../types';
import { computeBalance as computeBalanceLocal } from '../services/balanceService';
import { db, doc, onSnapshot, functions, httpsCallable } from '../lib/firebase';
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
  refreshBalance: () => void;
}

const EMPTY_BALANCE: BalanceData = {
  inventoryValue: 0,
  inventoryByWarehouse: { main: 0, cloud: 0 },
  cashUSD: 0, cashUZS: 0, bankUZS: 0, cardUZS: 0,
  totalCashUSD: 0, netBankUSD: 0, netCardUSD: 0, totalLiquidAssets: 0,
  fixedAssetsValue: 0, accountsReceivable: 0, totalAssets: 0,
  vatOutput: 0, vatInput: 0, vatLiability: 0,
  accountsPayable: 0, fixedAssetsPayable: 0,
  equity: 0, fixedAssetsFund: 0, retainedEarnings: 0, totalPassives: 0,
  revenue: 0, cogs: 0, grossProfit: 0,
  totalExpenses: 0, totalDepreciation: 0, netProfit: 0,
  corrections: [],
  exchangeRate: 12800,
  computedAt: new Date().toISOString(),
};

/**
 * Subscribes to balance/current in Firestore.
 * Falls back to local computation if no server balance exists.
 */
export function useBalance(input: UseBalanceInput): UseBalanceReturn {
  const { products, orders, expenses, fixedAssets, settings, transactions, clients, purchases } = input;
  const [balance, setBalance] = useState<BalanceData>(EMPTY_BALANCE);
  const [hasServerBalance, setHasServerBalance] = useState<boolean | null>(null);
  const triggerRef = useRef(false);

  // Subscribe to balance/current
  useEffect(() => {
    const docRef = doc(db, 'balance', 'current');
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Remove Firestore metadata fields
        const { updatedAt, ...balanceFields } = data;
        setBalance(balanceFields as BalanceData);
        setHasServerBalance(true);
      } else {
        setHasServerBalance(false);
      }
    }, (err) => {
      logger.error('useBalance', 'onSnapshot error:', err);
      setHasServerBalance(false);
    });

    return unsub;
  }, []);

  // Fallback: if no server balance exists, compute locally
  useEffect(() => {
    if (hasServerBalance === false && products.length > 0) {
      const localBalance = computeBalanceLocal({
        products, orders, expenses, fixedAssets, settings, transactions, clients, purchases,
      });
      setBalance(localBalance);

      // Trigger server computation once
      if (!triggerRef.current) {
        triggerRef.current = true;
        const computeBalanceFn = httpsCallable(functions, 'computeBalance');
        computeBalanceFn({}).catch((err) => {
          logger.error('useBalance', 'computeBalance CF call failed (non-fatal):', err);
        });
      }
    }
  }, [hasServerBalance, products, orders, expenses, fixedAssets, settings, transactions, clients, purchases]);

  // Manual refresh function
  const refreshBalance = useCallback(() => {
    const computeBalanceFn = httpsCallable(functions, 'computeBalance');
    computeBalanceFn({}).catch((err) => {
      logger.error('useBalance', 'Manual refresh failed:', err);
    });
  }, []);

  return { balance, refreshBalance };
}

