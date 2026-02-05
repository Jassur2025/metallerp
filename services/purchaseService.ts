import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    writeBatch,
    query, 
    orderBy,
    Timestamp,
    onSnapshot
} from '../lib/firebase';
import { Purchase } from '../types';

const COLLECTION_NAME = 'purchases';

export const purchaseService = {
    /**
     * Get all purchases
     */
    async getAll(): Promise<Purchase[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                // Ensure items and overheads are properly parsed
                items: data.items || [],
                overheads: data.overheads || { logistics: 0, customsDuty: 0, importVat: 0, other: 0 }
            } as Purchase;
        });
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
        // Clean data for Firestore (remove undefined)
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
            const newId = `PUR-${Date.now()}`;
            await setDoc(doc(db, COLLECTION_NAME, newId), { ...purchaseData, id: newId });
            return { ...purchase, id: newId };
        }
    },

    /**
     * Update a purchase
     */
    async update(id: string, updates: Partial<Purchase>): Promise<void> {
        const updateData = JSON.parse(JSON.stringify({
            ...updates,
            updatedAt: Timestamp.now()
        }));
        await updateDoc(doc(db, COLLECTION_NAME, id), updateData);
    },

    /**
     * Delete a purchase
     */
    async delete(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    /**
     * Batch create purchases (for migration)
     */
    async batchCreate(purchases: Purchase[]): Promise<number> {
        if (purchases.length === 0) return 0;
        
        // Firestore batch limit is 500
        const batchSize = 450;
        let totalCreated = 0;

        for (let i = 0; i < purchases.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = purchases.slice(i, i + batchSize);

            for (const purchase of chunk) {
                const purchaseData = JSON.parse(JSON.stringify({
                    ...purchase,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    _version: 1,
                    migratedAt: Timestamp.now()
                }));

                const id = purchase.id || `PUR-mig-${Date.now()}-${totalCreated}`;
                batch.set(doc(db, COLLECTION_NAME, id), { ...purchaseData, id });
                totalCreated++;
            }

            await batch.commit();
        }

        return totalCreated;
    }
};
