import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { transactionService } from '../services/transactionService';
import { useToast } from '../contexts/ToastContext';
import { DEFAULT_EXCHANGE_RATE } from '../constants';
import { logger } from '../utils/logger';

interface UseTransactionsOptions {
    realtime?: boolean;
    filterClientId?: string;
}

interface UseTransactionsReturn {
    transactions: Transaction[];
    loading: boolean;
    error: string | null;
    addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction | null>;
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
    deleteTransaction: (id: string) => Promise<boolean>;
    refreshTransactions: () => Promise<void>;
    stats: {
        totalIncome: number;
        totalExpenses: number;
        balance: number;
    }
}

export const useTransactions = (options: UseTransactionsOptions = {}): UseTransactionsReturn => {
    const { realtime = true, filterClientId } = options;
    const toast = useToast();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Derived stats (simple calc)
    const stats = {
        totalIncome: transactions
            .filter(t => t.type === 'client_payment' || (t.type as string) === 'income')
            .reduce((sum, t) => sum + (t.currency === 'USD' ? t.amount : (t.amount / (t.exchangeRate || DEFAULT_EXCHANGE_RATE))), 0),
        totalExpenses: transactions
            .filter(t => t.type === 'expense' || t.type === 'supplier_payment')
            .reduce((sum, t) => sum + (t.currency === 'USD' ? t.amount : (t.amount / (t.exchangeRate || DEFAULT_EXCHANGE_RATE))), 0),
        get balance() { return this.totalIncome - this.totalExpenses }
    };

    // Load manually
    const loadTransactions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = filterClientId
                ? await transactionService.getByClientId(filterClientId)
                : await transactionService.getAll();
            setTransactions(data);
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : String(err)) || 'Ошибка загрузки транзакций');
            logger.error('useTransactions', 'Error loading transactions:', err);
        } finally {
            setLoading(false);
        }
    }, [filterClientId]);

    // Real-time subscription
    useEffect(() => {
        if (realtime && !filterClientId) {
            setLoading(true);
            const unsubscribe = transactionService.subscribe((data) => {
                setTransactions(data);
                setLoading(false);
                setError(null);
            });
            return () => unsubscribe();
        } else {
            loadTransactions();
        }
    }, [realtime, filterClientId, loadTransactions]);

    // Add Transaction
    const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>): Promise<Transaction | null> => {
        try {
            const newTx = await transactionService.add(transaction);
            toast.success('Транзакция добавлена');

            if (!realtime) {
                setTransactions(prev => [newTx, ...prev]);
            }
            return newTx;
        } catch (err: unknown) {
            toast.error(`Ошибка добавления транзакции: ${(err instanceof Error ? err.message : String(err))}`);
            return null;
        }
    }, [realtime, toast]);

    // Update Transaction
    const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
        try {
            await transactionService.update(id, updates);
            // Optimistic update
            if (!realtime) {
                setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } as Transaction : t));
            }
            return true;
        } catch (err: unknown) {
            toast.error(`Ошибка обновления: ${(err instanceof Error ? err.message : String(err))}`);
            return false;
        }
    }, [realtime, toast]);

    // Delete Transaction
    const deleteTransaction = useCallback(async (id: string): Promise<boolean> => {
        try {
            await transactionService.delete(id);
            toast.success('Транзакция удалена');

            if (!realtime) {
                setTransactions(prev => prev.filter(t => t.id !== id));
            }
            return true;
        } catch (err: unknown) {
            toast.error(`Ошибка удаления: ${(err instanceof Error ? err.message : String(err))}`);
            return false;
        }
    }, [realtime, toast]);

    return {
        transactions,
        loading,
        error,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refreshTransactions: loadTransactions,
        stats
    };
};
