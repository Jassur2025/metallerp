/**
 * Workflow Orders Service - Firebase Firestore
 */

import {
    db,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    writeBatch,
    Timestamp,
    query,
    orderBy,
    limit
} from '../lib/firebase';
import { WorkflowOrder } from '../types';
import { IdGenerator } from '../utils/idGenerator';

// Collection name
const COLLECTION_NAME = 'workflowOrders';

// Firestore document interface
interface WorkflowOrderDocument extends Omit<WorkflowOrder, '_version' | 'updatedAt'> {
    _version?: number;
    updatedAt: Timestamp;
    createdAt?: Timestamp;
}

// Convert Firestore document to WorkflowOrder
const fromFirestore = (doc: any): WorkflowOrder => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        _version: data._version || 1,
        // Convert Timestamp to ISO string
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
    };
};

// Convert WorkflowOrder to Firestore document
const toFirestore = (order: WorkflowOrder): Partial<WorkflowOrderDocument> => {
    const { id, ...data } = order;
    const now = Timestamp.now();

    // Clean undefined values
    const docData: any = {
        ...data,
        updatedAt: now
    };

    // Clean fields
    Object.keys(docData).forEach(key => {
        if (docData[key] === undefined) {
            delete docData[key];
        }
    });

    return docData;
};

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
            console.error('Error fetching workflow orders:', error);
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
            console.error('Error creating workflow order:', error);
            throw error;
        }
    },

    /**
     * Update workflow order
     */
    async update(id: string, updates: Partial<WorkflowOrder>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error(`Workflow order with id ${id} not found`);
            }

            const currentData = fromFirestore(docSnap);
            const newVersion = (currentData._version || 0) + 1;

            const updateData: any = {
                ...toFirestore({ ...currentData, ...updates, id } as WorkflowOrder),
                _version: newVersion
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });

            await updateDoc(docRef, updateData);
        } catch (error) {
            console.error('Error updating workflow order:', error);
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
            console.error('Error deleting workflow order:', error);
            throw error;
        }
    },

    /**
     * Batch create workflow orders (for migration)
     */
    async batchCreate(orders: WorkflowOrder[]): Promise<number> {
        try {
            const batch = writeBatch(db);
            const now = Timestamp.now();
            let count = 0;

            for (const order of orders) {
                const id = order.id || IdGenerator.workflow();
                const docRef = doc(db, COLLECTION_NAME, id);

                batch.set(docRef, {
                    ...toFirestore({ ...order, id }),
                    createdAt: now,
                    _version: 1
                });
                count++;
            }

            await batch.commit();
            return count;
        } catch (error) {
            console.error('Error batch creating workflow orders:', error);
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
            console.error('Error subscribing to workflow orders:', error);
            callback([]);
        });

        return unsubscribe;
    }
};
