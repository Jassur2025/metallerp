import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { transactionService } from '../services/transactionService';
import { useToast } from '../contexts/ToastContext';

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
    migrateTransactions: (sheetsTransactions: Transaction[]) => Promise<number>;
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
            .filter(t => t.type === 'client_payment' || (t.type as any) === 'income')
            .reduce((sum, t) => sum + (t.currency === 'USD' ? t.amount : (t.amount / (t.exchangeRate || 12800))), 0),
        totalExpenses: transactions
            .filter(t => t.type === 'expense' || t.type === 'supplier_payment')
            .reduce((sum, t) => sum + (t.currency === 'USD' ? t.amount : (t.amount / (t.exchangeRate || 12800))), 0),
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
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки транзакций');
            console.error('Error loading transactions:', err);
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
        } catch (err: any) {
            toast.error(`Ошибка добавления транзакции: ${err.message}`);
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
        } catch (err: any) {
            toast.error(`Ошибка обновления: ${err.message}`);
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
        } catch (err: any) {
            toast.error(`Ошибка удаления: ${err.message}`);
            return false;
        }
    }, [realtime, toast]);

    // Migrate
    const migrateTransactions = useCallback(async (sheetsTransactions: Transaction[]): Promise<number> => {
        try {
            if (sheetsTransactions.length === 0) return 0;

            // Simple check to prevent migration if we already have data
            if (transactions.length >= sheetsTransactions.length) {
                return 0; // Already migrated likely
            }

            const count = await transactionService.batchCreate(sheetsTransactions);

            if (!realtime) {
                await loadTransactions();
            }
            return count;
        } catch (err: any) {
            toast.error(`Ошибка миграции транзакций: ${err.message}`);
            return 0;
        }
    }, [transactions.length, realtime, loadTransactions, toast]);

    return {
        transactions,
        loading,
        error,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refreshTransactions: loadTransactions,
        migrateTransactions,
        stats
    };
};
