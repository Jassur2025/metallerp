/**
 * Workflow Orders Service - Firebase Firestore
 */

import {
    db,
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    Timestamp,
    query,
    orderBy,
    limit,
    runTransaction
} from '../lib/firebase';
import { WorkflowOrder } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { genericFromFirestore, genericToFirestore } from '../utils/firestoreHelpers';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

// Collection name
const COLLECTION_NAME = 'workflowOrders';

// Firestore document interface
interface WorkflowOrderDocument extends Omit<WorkflowOrder, '_version' | 'updatedAt'> {
    _version?: number;
    updatedAt: Timestamp;
    createdAt?: Timestamp;
}

// Use shared converters
const fromFirestore = (doc: import('firebase/firestore').DocumentSnapshot): WorkflowOrder => genericFromFirestore<WorkflowOrder>(doc);
const toFirestore = (order: WorkflowOrder) => genericToFirestore(order);

export const workflowOrderService = {
    /**
     * Get all workflow orders
     */
    async getAll(): Promise<WorkflowOrder[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'), limit(500));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(fromFirestore);
        } catch (error) {
            logger.error('WorkflowOrderService', 'Error fetching workflow orders:', error);
            throw error;
        }
    },

    /**
     * Create new workflow order
     */
    async add(order: Omit<WorkflowOrder, 'id'>): Promise<WorkflowOrder> {
        try {
            const id = IdGenerator.workflow();
            const now = Timestamp.now();

            const docData = {
                ...toFirestore({ ...order, id } as WorkflowOrder),
                createdAt: now,
                _version: 1
            };

            await setDoc(doc(db, COLLECTION_NAME, id), docData);

            return {
                ...order,
                id,
                _version: 1,
                updatedAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('WorkflowOrderService', 'Error creating workflow order:', error);
            throw error;
        }
    },

    /**
     * Update workflow order
     */
    async update(id: string, updates: Partial<WorkflowOrder>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);

            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);

                if (!docSnap.exists()) {
                    throw new Error(`Workflow order with id ${id} not found`);
                }

                const currentData = fromFirestore(docSnap);
                const newVersion = (currentData._version || 0) + 1;

                const updateData: Record<string, unknown> = {
                    ...toFirestore({ ...currentData, ...updates, id } as WorkflowOrder),
                    _version: newVersion
                };

                // Remove undefined values
                Object.keys(updateData).forEach(key => {
                    if (updateData[key] === undefined) {
                        delete updateData[key];
                    }
                });

                transaction.update(docRef, updateData as Record<string, import('firebase/firestore').FieldValue | Partial<unknown> | undefined>);
            });
        } catch (error) {
            logger.error('WorkflowOrderService', 'Error updating workflow order:', error);
            throw error;
        }
    },

    /**
     * Delete workflow order
     */
    async delete(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            logger.error('WorkflowOrderService', 'Error deleting workflow order:', error);
            throw error;
        }
    },

    /**
     * Batch create workflow orders (for migration)
     */
    async batchCreate(orders: WorkflowOrder[]): Promise<number> {
        try {
            const now = Timestamp.now();

            const stats = await executeSafeBatch(orders, { collectionName: COLLECTION_NAME }, (order, batch) => {
                const id = order.id || IdGenerator.workflow();
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.set(docRef, {
                    ...toFirestore({ ...order, id }),
                    createdAt: now,
                    _version: 1
                });
            });

            return stats.totalProcessed;
        } catch (error) {
            logger.error('WorkflowOrderService', 'Error batch creating workflow orders:', error);
            throw error;
        }
    },

    /**
     * Subscribe to changes
     */
    subscribe(callback: (orders: WorkflowOrder[]) => void): () => void {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'), limit(500));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(fromFirestore);
            callback(orders);
        }, (error) => {
            logger.error('WorkflowOrderService', 'Error subscribing to workflow orders:', error);
            callback([]);
        });

        return unsubscribe;
    }
};
