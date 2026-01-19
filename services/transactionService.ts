/**
 * Transaction Service - Firebase Firestore
 * Handles all financial transactions (payments, debts, expenses)
 */

import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    addDoc,
    query, 
    where, 
    orderBy,
    Timestamp,
    runTransaction,
    writeBatch
} from '../lib/firebase';
import { Transaction } from '../types';

const TRANSACTIONS_COLLECTION = 'transactions';
const CLIENTS_COLLECTION = 'clients';

// Firestore document interface
interface TransactionDocument extends Omit<Transaction, 'id'> {
    createdAt: Timestamp;
}

const fromFirestore = (doc: any): Transaction => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        date: data.date || data.createdAt?.toDate?.()?.toISOString()
    };
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
            console.error('Error fetching transactions:', error);
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
            return snapshot.docs.map(fromFirestore);
        } catch (error) {
            console.error(`Error fetching transactions for client ${clientId}:`, error);
            // Fallback for missing index error
            if ((error as any).code === 'failed-precondition') {
                console.warn('Index missing, retrying without sort');
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
            // Debt decreases when client pays (client_payment)
            // Debt increases when we give refund (client_refund) ? No, usually refund means we give money back.
            // Let's assume this is a payment FROM client TO us.
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
    async addDebt(amountUSD: number, clientId: string, description: string): Promise<void> {
        await runTransaction(db, async (firebaseTx) => {
            const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
            const clientDoc = await firebaseTx.get(clientRef);
            
            if (!clientDoc.exists()) throw new Error(`Client ${clientId} not found`);

            const currentDebt = clientDoc.data().totalDebt || 0;
            
            // Create debt record (optional, can be linked to order usually)
            const newTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));
            firebaseTx.set(newTxRef, {
                type: 'debt_obligation',
                amount: amountUSD,
                currency: 'USD',
                method: 'debt',
                description: description,
                relatedId: clientId,
                date: new Date().toISOString(),
                createdAt: Timestamp.now()
            });

            // Update client balance
            firebaseTx.update(clientRef, {
                totalDebt: currentDebt + amountUSD,
                updatedAt: Timestamp.now()
            });
        });
    }
};
