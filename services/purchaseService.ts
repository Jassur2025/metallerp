import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy,
    Timestamp,
    onSnapshot
} from '../lib/firebase';
import { Purchase } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

const COLLECTION_NAME = 'purchases';

export const purchaseService = {
    /**
     * Get all purchases
     */
    async getAll(): Promise<Purchase[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    items: data.items || [],
                    overheads: data.overheads || { logistics: 0, customsDuty: 0, importVat: 0, other: 0 }
                } as Purchase;
            });
        } catch (error) {
            logger.error('PurchaseService', 'Error fetching purchases:', error);
            throw error;
        }
    },

    /**
     * Subscribe to real-time updates
     */
    subscribe(callback: (purchases: Purchase[]) => void): () => void {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const purchases = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    items: data.items || [],
                    overheads: data.overheads || { logistics: 0, customsDuty: 0, importVat: 0, other: 0 }
                } as Purchase;
            });
            callback(purchases);
        });
    },

    /**
     * Add a new purchase
     */
    async add(purchase: Purchase): Promise<Purchase> {
        try {
            const purchaseData = JSON.parse(JSON.stringify({
                ...purchase,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                _version: 1
            }));

            if (purchase.id) {
                await setDoc(doc(db, COLLECTION_NAME, purchase.id), purchaseData);
                return purchase;
            } else {
                const newId = IdGenerator.purchase();
                await setDoc(doc(db, COLLECTION_NAME, newId), { ...purchaseData, id: newId });
                return { ...purchase, id: newId };
            }
        } catch (error) {
            logger.error('PurchaseService', 'Error adding purchase:', error);
            throw error;
        }
    },

    /**
     * Update a purchase
     */
    async update(id: string, updates: Partial<Purchase>): Promise<void> {
        try {
            const updateData = JSON.parse(JSON.stringify({
                ...updates,
                updatedAt: Timestamp.now()
            }));
            await updateDoc(doc(db, COLLECTION_NAME, id), updateData);
        } catch (error) {
            logger.error('PurchaseService', 'Error updating purchase:', error);
            throw error;
        }
    },

    /**
     * Delete a purchase
     */
    async delete(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            logger.error('PurchaseService', 'Error deleting purchase:', error);
            throw error;
        }
    },

    /**
     * Batch create purchases (for migration)
     */
    async batchCreate(purchases: Purchase[]): Promise<number> {
        if (purchases.length === 0) return 0;

        const stats = await executeSafeBatch(purchases, { collectionName: COLLECTION_NAME }, (purchase, batch) => {
            const purchaseData = JSON.parse(JSON.stringify({
                ...purchase,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                _version: 1,
                migratedAt: Timestamp.now()
            }));
            const id = purchase.id || IdGenerator.purchase();
            batch.set(doc(db, COLLECTION_NAME, id), { ...purchaseData, id });
        });

        return stats.totalProcessed;
    }
};
