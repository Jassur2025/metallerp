import { useCallback, useMemo, useRef } from 'react';
import { Expense, Transaction } from '../types';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

interface UseExpensesDeps {
    transactions: Transaction[];
    addTransaction: (t: Omit<Transaction, 'id'>) => Promise<Transaction | null>;
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
    deleteTransaction: (id: string) => Promise<boolean>;
}

export const useExpenses = (deps: UseExpensesDeps) => {
    const {
        transactions,
        addTransaction,
        updateTransaction: updateTx,
        deleteTransaction: deleteTx
    } = deps;

    const toast = useToast();

    // Guard against duplicate expense creation (double-click, network retry, etc.)
    const lastExpenseRef = useRef<{ key: string; timestamp: number } | null>(null);

    // Derived state: Filter transactions to get Expenses
    const expenses = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense')
            .map(t => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: t.amount,
                currency: t.currency,
                paymentMethod: t.method === 'debt' ? 'cash' : t.method, // Map 'debt' to 'cash' fallback if needed, or strict mapping
                category: t.relatedId || 'General', // We use relatedId for category if available
                exchangeRate: t.exchangeRate,
                updatedAt: t.updatedAt,
                _version: t._version
            } as Expense))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);

    // Add Expense
    const addExpense = useCallback(async (expense: Omit<Expense, 'id'>) => {
        try {
            // Dedup guard: prevent creating identical expense within 5 seconds
            const expenseKey = `${expense.amount}|${expense.currency}|${expense.description}|${expense.category}`;
            const now = Date.now();
            if (lastExpenseRef.current && lastExpenseRef.current.key === expenseKey && (now - lastExpenseRef.current.timestamp) < 5000) {
                logger.warn('useExpenses', 'Duplicate expense blocked (same content within 5s)');
                return null;
            }
            lastExpenseRef.current = { key: expenseKey, timestamp: now };

            const tx: Omit<Transaction, 'id'> = {
                type: 'expense',
                amount: expense.amount,
                currency: expense.currency,
                method: expense.paymentMethod,
                description: expense.description,
                date: expense.date,
                relatedId: expense.category, // Store category in relatedId
                exchangeRate: expense.exchangeRate
            };

            const result = await addTransaction(tx);
            if (result) {
                // toast.success('Расход добавлен'); // useTransactions already toasts
                return result.id;
            }
            return null;
        } catch (error) {
            logger.error('useExpenses', 'Error adding expense:', error);
            return null;
        }
    }, [addTransaction]);

    // Update Expense
    const updateExpense = useCallback(async (id: string, updates: Partial<Expense>) => {
        try {
            const txUpdates: Partial<Transaction> = {};
            if (updates.amount !== undefined) txUpdates.amount = updates.amount;
            if (updates.currency !== undefined) txUpdates.currency = updates.currency;
            if (updates.paymentMethod !== undefined) txUpdates.method = updates.paymentMethod;
            if (updates.description !== undefined) txUpdates.description = updates.description;
            if (updates.date !== undefined) txUpdates.date = updates.date;
            if (updates.category !== undefined) txUpdates.relatedId = updates.category;

            return await updateTx(id, txUpdates);
        } catch (error) {
            logger.error('useExpenses', 'Error updating expense:', error);
            return false;
        }
    }, [updateTx]);

    // Delete Expense
    const deleteExpense = useCallback(async (id: string) => {
        return await deleteTx(id);
    }, [deleteTx]);

    return {
        expenses,
        addExpense,
        updateExpense,
        deleteExpense
    };
};
