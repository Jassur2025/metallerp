/**
 * Transaction Service - Firebase Firestore
 * Handles all financial transactions (payments, debts, expenses)
 */

import {
    db,
    auth,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    runTransaction,
    onSnapshot,
    limit,
    startAfter
} from '../lib/firebase';
import { Transaction } from '../types';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';
import { generateExpenseEntry } from '../utils/ledgerEntryGenerators';
import { ledgerService } from './ledgerService';

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
                where('_deleted', '!=', true),
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
    subscribe(callback: (transactions: Transaction[]) => void, maxItems: number = 500): () => void {
        const q = query(
            collection(db, TRANSACTIONS_COLLECTION),
            orderBy('date', 'desc'),
            limit(maxItems)
        );
        return onSnapshot(q, (snapshot) => {
            const transactions = snapshot.docs.map(fromFirestore).filter(t => !t._deleted);
            callback(transactions);
        }, (error) => {
            logger.error('TransactionService', 'Error subscribing to transactions:', error);
        });
    },

    /**
     * Paginated fetch — returns transactions older than `afterDate`.
     */
    async getPage(afterDate: string, pageSize: number = 100): Promise<{ items: Transaction[]; hasMore: boolean }> {
        try {
            const q = query(
                collection(db, TRANSACTIONS_COLLECTION),
                where('_deleted', '!=', true),
                orderBy('date', 'desc'),
                startAfter(afterDate),
                limit(pageSize + 1)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(fromFirestore);
            const hasMore = docs.length > pageSize;
            return { items: hasMore ? docs.slice(0, pageSize) : docs, hasMore };
        } catch (error) {
            logger.error('TransactionService', 'Error fetching page:', error);
            throw error;
        }
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
            return snapshot.docs.map(fromFirestore).filter(t => !t._deleted);
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
                return snap.docs.map(fromFirestore).filter(t => !t._deleted).sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
            }
            throw error;
        }
    },

    /**
     * @deprecated DEAD CODE — replaced by paymentAtomicService.processPayment() CF.
     * Client-side ledgerEntries writes are blocked by firestore.rules. Do NOT call.
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

        const savedTx = { id: docRef.id, ...transaction } as Transaction;

        // ── Generate General Ledger entry for expenses (fire-and-forget) ──
        if (transaction.type === 'expense') {
            try {
                const entry = generateExpenseEntry({ transaction: savedTx });
                if (entry) {
                    ledgerService.addEntries([entry]).catch(err => {
                        logger.error('TransactionService', 'Expense ledger entry failed (non-fatal):', err);
                    });
                }
            } catch (ledgerErr) {
                logger.error('TransactionService', 'Expense ledger generation failed (non-fatal):', ledgerErr);
            }
        }

        return savedTx;
    },

    /**
     * @deprecated DEAD CODE — replaced by paymentAtomicService.processPayment() CF.
     * Client-side ledgerEntries writes are blocked by firestore.rules. Do NOT call.
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
     * @deprecated DEAD CODE — replaced by paymentAtomicService.processPayment() CF.
     * Client-side ledgerEntries writes are blocked by firestore.rules. Do NOT call.
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
     * All reads happen INSIDE the Firestore transaction to prevent TOCTOU race conditions.
     */
    async update(id: string, updates: Partial<Transaction>): Promise<void> {
        const txRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const debtAffectingTypes: string[] = ['client_payment', 'debt_obligation'];

        await runTransaction(db, async (firebaseTx) => {
            // Read the transaction INSIDE the Firestore transaction (prevents TOCTOU)
            const txSnap = await firebaseTx.get(txRef);

            if (!txSnap.exists()) {
                throw new Error(`Transaction ${id} not found`);
            }

            const oldTx = txSnap.data() as Transaction;
            const oldAffectsDebt = debtAffectingTypes.includes(oldTx.type) && oldTx.relatedId;
            const newType = updates.type || oldTx.type;
            const newRelatedId = updates.relatedId ?? oldTx.relatedId;
            const newAffectsDebt = debtAffectingTypes.includes(newType) && newRelatedId;

            // If neither old nor new affects debt, just update the document
            if (!oldAffectsDebt && !newAffectsDebt) {
                firebaseTx.update(txRef, {
                    ...updates,
                    updatedAt: new Date().toISOString()
                });
                return;
            }

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
                updatedAt: new Date().toISOString(),
                _version: (oldTx._version || 0) + 1
            });
        });
    },

    /**
     * @deprecated DEAD CODE — replaced by deleteTransaction CF.
     * Client-side ledgerEntries writes are blocked by firestore.rules. Do NOT call.
     * Delete transaction — atomically reverses debt impact if applicable
     * All reads happen INSIDE the Firestore transaction to prevent TOCTOU race conditions.
     */
    async delete(id: string): Promise<void> {
        const txRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const debtAffectingTypes: string[] = ['client_payment', 'debt_obligation'];

        await runTransaction(db, async (firebaseTx) => {
            // Read INSIDE the transaction (prevents TOCTOU)
            const txSnap = await firebaseTx.get(txRef);

            if (!txSnap.exists()) {
                // Already deleted, no-op
                return;
            }

            const txData = txSnap.data() as Transaction;

            // If this transaction affected a client's debt, reverse it atomically
            if (debtAffectingTypes.includes(txData.type) && txData.relatedId) {
                const clientRef = doc(db, CLIENTS_COLLECTION, txData.relatedId);
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
            }

            // Soft-delete the transaction (preserves audit trail)
            firebaseTx.update(txRef, {
                _deleted: true,
                _deletedAt: new Date().toISOString(),
                _deletedBy: auth.currentUser?.uid || 'unknown',
                updatedAt: Timestamp.now()
            });
        });
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
