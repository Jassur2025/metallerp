import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    addDoc,
    deleteDoc, 
    query, 
    orderBy,
    Timestamp,
    runTransaction,
    onSnapshot
} from '../lib/firebase';
import { Order } from '../types';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

const COLLECTION_NAME = 'orders';

const fromFirestoreDoc = (d: import('firebase/firestore').DocumentSnapshot): Order => {
    const data = d.data();
    return {
        ...data,
        id: d.id,
        date: data?.date || data?.createdAt?.toDate?.()?.toISOString()
    } as Order;
};

export const orderService = {
    /**
     * Get all orders
     */
    async getAll(): Promise<Order[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(fromFirestoreDoc);
        } catch (error) {
            logger.error('OrderService', 'Error fetching orders:', error);
            throw error;
        }
    },

    /**
     * Subscribe to real-time updates
     */
    subscribe(callback: (orders: Order[]) => void): () => void {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(fromFirestoreDoc));
        }, (error) => {
            logger.error('OrderService', 'Subscription error:', error);
        });
    },

    /**
     * Add a new order
     */
    async add(order: Order): Promise<Order> {
        try {
            const orderData = JSON.parse(JSON.stringify({
                ...order,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                _version: 1
            }));

            if (order.id) {
                await setDoc(doc(db, COLLECTION_NAME, order.id), orderData);
                return order;
            } else {
                const docRef = await addDoc(collection(db, COLLECTION_NAME), orderData);
                return { ...order, id: docRef.id };
            }
        } catch (error) {
            logger.error('OrderService', 'Error adding order:', error);
            throw error;
        }
    },

    /**
     * Update an order
     */
    async update(id: string, updates: Partial<Order>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);

            await runTransaction(db, async (transaction) => {
                const currentDocSnap = await transaction.get(docRef);

                if (!currentDocSnap.exists()) {
                    throw new Error(`Order with id ${id} not found`);
                }

                const currentVersion = currentDocSnap.data()?._version || 0;

                transaction.update(docRef, {
                    ...updates,
                    updatedAt: Timestamp.now(),
                    _version: currentVersion + 1
                });
            });
        } catch (error) {
            logger.error('OrderService', 'Error updating order:', error);
            throw error;
        }
    },

    /**
     * Delete an order
     */
    async delete(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            logger.error('OrderService', 'Error deleting order:', error);
            throw error;
        }
    },

    /**
     * Batch import for migration
     */
    async batchCreate(orders: Order[]): Promise<void> {
        try {
            await executeSafeBatch(orders.filter(o => o.id), { collectionName: COLLECTION_NAME }, (order, batch) => {
                const docRef = doc(db, COLLECTION_NAME, order.id);
                const cleanOrder = JSON.parse(JSON.stringify(order));
                batch.set(docRef, {
                    ...cleanOrder,
                    migratedAt: Timestamp.now()
                });
            });
        } catch (error) {
            logger.error('OrderService', 'Error batch creating orders:', error);
            throw error;
        }
    }
};
