import { useState, useCallback, useMemo, useRef } from 'react';
import { Expense, Transaction } from '../types';
import { useTransactions } from './useTransactions';
import { useToast } from '../contexts/ToastContext';

export const useExpenses = () => {
    const {
        transactions,
        addTransaction,
        updateTransaction: updateTx,
        deleteTransaction: deleteTx,
        migrateTransactions
    } = useTransactions({ realtime: true });

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
                console.warn('Duplicate expense blocked (same content within 5s)');
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
            console.error('Error adding expense:', error);
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
            console.error('Error updating expense:', error);
            return false;
        }
    }, [updateTx]);

    // Delete Expense
    const deleteExpense = useCallback(async (id: string) => {
        return await deleteTx(id);
    }, [deleteTx]);

    // Migrate Legacy Expenses
    const migrateLegacyExpenses = useCallback(async (legacyExpenses: Expense[]) => {
        // Filter out expenses that are already in transactions (by ID is safest, but IDs might change during migration if we generate new ones)
        // Ideally legacy expenses have IDs. If we use those IDs as Transaction IDs, we can check existence.
        // For now, let's assume we want to import if the transaction list is empty or we check ID collision.

        const txsToMigrate = legacyExpenses.map(e => ({
            id: e.id, // Keep ID if possible
            type: 'expense' as const,
            amount: e.amount,
            currency: e.currency,
            method: e.paymentMethod,
            description: e.description,
            date: e.date,
            relatedId: e.category,
            exchangeRate: e.exchangeRate,
            details: 'Migrated from Sheets'
        } as Transaction));

        return await migrateTransactions(txsToMigrate);
    }, [migrateTransactions]);

    return {
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        migrateLegacyExpenses
    };
};
