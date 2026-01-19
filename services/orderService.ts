import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    addDoc,
    updateDoc, 
    deleteDoc, 
    writeBatch,
    query, 
    orderBy,
    Timestamp 
} from '../lib/firebase';
import { Order } from '../types';

const COLLECTION_NAME = 'orders';

export const orderService = {
    /**
     * Get all orders
     */
    async getAll(): Promise<Order[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date || data.createdAt?.toDate?.()?.toISOString()
            } as Order;
        });
    },

    /**
     * Add a new order
     */
    async add(order: Order): Promise<Order> {
        // Prepare data for Firestore
        // Remove undefined fields and ensure primitives
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
    },

    /**
     * Update an order
     */
    async update(id: string, updates: Partial<Order>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now(),
            _version: (updates._version || 0) + 1
        });
    },

    /**
     * Delete an order
     */
    async delete(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    /**
     * Batch import for migration
     */
    async batchCreate(orders: Order[]): Promise<void> {
        const batch = writeBatch(db);
        
        orders.forEach(order => {
            if (!order.id) return;
            const docRef = doc(db, COLLECTION_NAME, order.id);
            // Clean undefined values
            const cleanOrder = JSON.parse(JSON.stringify(order));
            batch.set(docRef, {
                ...cleanOrder,
                migratedAt: Timestamp.now()
            });
        });

        await batch.commit();
    }
};
