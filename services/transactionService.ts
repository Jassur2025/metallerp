/**
 * Transaction Service - Firebase Firestore
 * Handles all financial transactions (payments, debts, expenses)
 */

import {
    db,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    onSnapshot
} from '../lib/firebase';
import { Transaction } from '../types';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

const TRANSACTIONS_COLLECTION = 'transactions';
const CLIENTS_COLLECTION = 'clients';

// Firestore document interface
interface TransactionDocument extends Omit<Transaction, 'id'> {
    createdAt: Timestamp;
}

const fromFirestore = (doc: import('firebase/firestore').DocumentSnapshot): Transaction => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        // Handle both standard date string and Firestore timestamp
        date: data?.date || data?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    } as Transaction;
};

export const transactionService = {
    /**
     * Get all transactions
     */
    async getAll(): Promise<Transaction[]> {
        try {
            const q = query(
                collection(db, TRANSACTIONS_COLLECTION),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(fromFirestore);
        } catch (error) {
            logger.error('TransactionService', 'Error fetching transactions:', error);
            throw error;
        }
    },

    /**
     * Subscribe to real-time updates
     */
    subscribe(callback: (transactions: Transaction[]) => void): () => void {
        const q = query(
            collection(db, TRANSACTIONS_COLLECTION),
            orderBy('date', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const transactions = snapshot.docs.map(fromFirestore);
            callback(transactions);
        }, (error) => {
            logger.error('TransactionService', 'Error subscribing to transactions:', error);
        });
    },

    /**
     * Get transactions by Client ID
     */
    async getByClientId(clientId: string): Promise<Transaction[]> {
        try {
            // We search by relatedId which stores the clientId
            const q = query(
                collection(db, TRANSACTIONS_COLLECTION),
                where('relatedId', '==', clientId),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(fromFirestore);
        } catch (error) {
            logger.error('TransactionService', `Error fetching transactions for client ${clientId}:`, error);
            // Fallback for missing index error
            if ((error as { code?: string }).code === 'failed-precondition') {
                logger.warn('TransactionService', 'Index missing, retrying without sort');
                const qSimple = query(
                    collection(db, TRANSACTIONS_COLLECTION),
                    where('relatedId', '==', clientId)
                );
                const snap = await getDocs(qSimple);
                return snap.docs.map(fromFirestore).sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
            }
            throw error;
        }
    },

    /**
     * Smart Add: Routes to specific logic based on type
     */
    async add(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
        // 1. Standalone client debt repayment -> updates Client Debt
        // Sale-linked payments (with orderId) must not mutate debt here.
        if (transaction.type === 'client_payment' && transaction.relatedId && !transaction.orderId) {
            return this.createPayment(transaction, transaction.relatedId);
        }

        // 2. Debt Obligation -> Updates Client Debt
        if (transaction.type === 'debt_obligation' && transaction.relatedId && transaction.currency === 'USD') {
            const debtTxId = await this.addDebt(transaction.amount, transaction.relatedId, transaction.description, transaction.orderId);
            return { id: debtTxId, ...transaction } as Transaction;
        }

        // 3. Standard add (Expenses, etc)
        const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), {
            ...transaction,
            createdAt: Timestamp.now(),
            updatedAt: new Date().toISOString(),
            _version: 1
        });

        return { id: docRef.id, ...transaction } as Transaction;
    },

    /**
     * Create a new payment/transaction and update Client Balance atomically
     */
    async createPayment(transaction: Omit<Transaction, 'id'>, clientId: string): Promise<Transaction> {
        return await runTransaction(db, async (firebaseTx) => {
            // 1. Get Client Reference
            const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
            const clientDoc = await firebaseTx.get(clientRef);

            if (!clientDoc.exists()) {
                throw new Error(`Client ${clientId} not found`);
            }

            // 2. Calculate amounts
            const amount = transaction.amount;
            let amountInUSD = amount;

            if (transaction.currency === 'UZS' && transaction.exchangeRate) {
                amountInUSD = amount / transaction.exchangeRate;
            }

            // 3. Create Transaction Data
            const newTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));
            const txData = {
                ...transaction,
                relatedId: clientId,
                createdAt: Timestamp.now(),
                _version: 1,
                date: new Date().toISOString()
            };

            // 4. Update Client Debt
            const currentDebt = clientDoc.data().totalDebt || 0;
            const newDebt = Math.max(0, currentDebt - amountInUSD);

            // 5. Commit writes
            firebaseTx.set(newTxRef, txData);
            firebaseTx.update(clientRef, {
                totalDebt: newDebt,
                updatedAt: Timestamp.now()
            });

            return { id: newTxRef.id, ...transaction } as Transaction;
        });
    },

    /**
     * Add debt manually (or via order)
     */
    async addDebt(amountUSD: number, clientId: string, description: string, orderId?: string): Promise<string> {
        return await runTransaction(db, async (firebaseTx) => {
            const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
            const clientDoc = await firebaseTx.get(clientRef);

            if (!clientDoc.exists()) throw new Error(`Client ${clientId} not found`);

            const currentDebt = clientDoc.data().totalDebt || 0;

            // Create debt record
            const newTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));
            firebaseTx.set(newTxRef, {
                type: 'debt_obligation',
                amount: amountUSD,
                currency: 'USD',
                method: 'debt',
                description: description,
                orderId,
                relatedId: clientId,
                date: new Date().toISOString(),
                createdAt: Timestamp.now()
            });

            // Update client balance
            firebaseTx.update(clientRef, {
                totalDebt: currentDebt + amountUSD,
                updatedAt: Timestamp.now()
            });

            return newTxRef.id;
        });
    },

    /**
     * Update transaction (recalculates debt if amount/type changed)
     */
    async update(id: string, updates: Partial<Transaction>): Promise<void> {
        const txRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const txSnap = await getDoc(txRef);

        if (!txSnap.exists()) {
            throw new Error(`Transaction ${id} not found`);
        }

        const oldTx = txSnap.data() as Transaction;
        const debtAffectingTypes: string[] = ['client_payment', 'debt_obligation'];
        const oldAffectsDebt = debtAffectingTypes.includes(oldTx.type) && oldTx.relatedId;
        const newType = updates.type || oldTx.type;
        const newRelatedId = updates.relatedId ?? oldTx.relatedId;
        const newAffectsDebt = debtAffectingTypes.includes(newType) && newRelatedId;

        // If neither old nor new affects debt, do a simple update
        if (!oldAffectsDebt && !newAffectsDebt) {
            await updateDoc(txRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
            return;
        }

        // Otherwise, atomically reverse old debt impact and apply new one
        await runTransaction(db, async (firebaseTx) => {
            // Reverse old debt impact
            if (oldAffectsDebt && oldTx.relatedId) {
                const oldClientRef = doc(db, CLIENTS_COLLECTION, oldTx.relatedId);
                const oldClientSnap = await firebaseTx.get(oldClientRef);
                if (oldClientSnap.exists()) {
                    const currentDebt = oldClientSnap.data().totalDebt || 0;
                    const oldAmountUSD = this._toUSD(oldTx);
                    let reversedDebt = currentDebt;
                    if (oldTx.type === 'client_payment') {
                        reversedDebt = currentDebt + oldAmountUSD; // Undo payment reduction
                    } else if (oldTx.type === 'debt_obligation') {
                        reversedDebt = Math.max(0, currentDebt - oldAmountUSD); // Undo debt addition
                    }
                    firebaseTx.update(oldClientRef, { totalDebt: reversedDebt, updatedAt: Timestamp.now() });
                }
            }

            // Apply new debt impact
            if (newAffectsDebt && newRelatedId) {
                const newClientRef = doc(db, CLIENTS_COLLECTION, newRelatedId);
                const newClientSnap = await firebaseTx.get(newClientRef);
                if (newClientSnap.exists()) {
                    // Re-read if same client (transaction already modified it above)
                    let currentDebt = newClientSnap.data().totalDebt || 0;
                    if (oldAffectsDebt && oldTx.relatedId === newRelatedId) {
                        // Already reversed above, use the reversed value
                        const oldAmountUSD = this._toUSD(oldTx);
                        if (oldTx.type === 'client_payment') currentDebt += oldAmountUSD;
                        else if (oldTx.type === 'debt_obligation') currentDebt = Math.max(0, currentDebt - oldAmountUSD);
                    }
                    const mergedTx = { ...oldTx, ...updates };
                    const newAmountUSD = this._toUSD(mergedTx);
                    let newDebt = currentDebt;
                    if (newType === 'client_payment') {
                        newDebt = Math.max(0, currentDebt - newAmountUSD);
                    } else if (newType === 'debt_obligation') {
                        newDebt = currentDebt + newAmountUSD;
                    }
                    firebaseTx.update(newClientRef, { totalDebt: newDebt, updatedAt: Timestamp.now() });
                }
            }

            // Update the transaction document itself
            firebaseTx.update(txRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        });
    },

    /**
     * Delete transaction — atomically reverses debt impact if applicable
     */
    async delete(id: string): Promise<void> {
        const txRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const txSnap = await getDoc(txRef);

        if (!txSnap.exists()) {
            // Already deleted, no-op
            return;
        }

        const txData = txSnap.data() as Transaction;
        const debtAffectingTypes: string[] = ['client_payment', 'debt_obligation'];

        // If this transaction affected a client's debt, reverse it atomically
        if (debtAffectingTypes.includes(txData.type) && txData.relatedId) {
            await runTransaction(db, async (firebaseTx) => {
                const clientRef = doc(db, CLIENTS_COLLECTION, txData.relatedId!);
                const clientSnap = await firebaseTx.get(clientRef);

                if (clientSnap.exists()) {
                    const currentDebt = clientSnap.data().totalDebt || 0;
                    const amountUSD = this._toUSD(txData);
                    let newDebt = currentDebt;

                    if (txData.type === 'client_payment') {
                        // Deleting a payment means the debt was NOT actually reduced
                        newDebt = currentDebt + amountUSD;
                    } else if (txData.type === 'debt_obligation') {
                        // Deleting a debt means the debt was NOT actually added
                        newDebt = Math.max(0, currentDebt - amountUSD);
                    }

                    firebaseTx.update(clientRef, {
                        totalDebt: newDebt,
                        updatedAt: Timestamp.now()
                    });
                }

                // Delete the transaction document
                firebaseTx.delete(txRef);
            });
        } else {
            // No debt impact — simple delete
            await deleteDoc(txRef);
        }
    },

    /**
     * Helper: Convert transaction amount to USD
     */
    _toUSD(tx: { amount: number; currency?: string; exchangeRate?: number }): number {
        if (tx.currency === 'UZS' && tx.exchangeRate && tx.exchangeRate > 0) {
            return tx.amount / tx.exchangeRate;
        }
        return tx.amount;
    },

    /**
     * Batch create for migration
     */
    async batchCreate(transactions: Transaction[]): Promise<number> {
        if (transactions.length === 0) return 0;

        const stats = await executeSafeBatch(transactions, { collectionName: TRANSACTIONS_COLLECTION }, (tx, batch) => {
            const docRef = doc(collection(db, TRANSACTIONS_COLLECTION));
            const data = JSON.parse(JSON.stringify(tx));
            delete data.id;

            batch.set(docRef, {
                ...data,
                createdAt: Timestamp.now(),
                updatedAt: new Date().toISOString(),
                _version: 1,
                migratedAt: Timestamp.now()
            });
        });

        return stats.totalProcessed;
    }
};
