import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    deleteDoc, 
    query, 
    orderBy,
    Timestamp,
    onSnapshot,
    runTransaction
} from '../lib/firebase';
import { Supplier } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { executeSafeBatch } from '../utils/batchWriter';

const COLLECTION_NAME = 'suppliers';

export const supplierService = {
    /**
     * Get all suppliers
     */
    async getAll(): Promise<Supplier[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as Supplier));
    },

    /**
     * Subscribe to real-time updates
     */
    subscribe(callback: (suppliers: Supplier[]) => void): () => void {
        const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
        return onSnapshot(q, (snapshot) => {
            const suppliers = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            } as Supplier));
            callback(suppliers);
        });
    },

    /**
     * Add a new supplier
     */
    async add(supplier: Supplier): Promise<Supplier> {
        const supplierData = JSON.parse(JSON.stringify({
            ...supplier,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            _version: 1,
            isActive: supplier.isActive ?? true
        }));

        if (supplier.id) {
            await setDoc(doc(db, COLLECTION_NAME, supplier.id), supplierData);
            return supplier;
        } else {
            const newId = IdGenerator.supplier();
            await setDoc(doc(db, COLLECTION_NAME, newId), { ...supplierData, id: newId });
            return { ...supplier, id: newId };
        }
    },

    /**
     * Update a supplier
     */
    async update(id: string, updates: Partial<Supplier>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);

        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);

            if (!docSnap.exists()) {
                throw new Error(`Supplier with id ${id} not found`);
            }

            const currentVersion = docSnap.data()?._version || 0;
            const updateData = JSON.parse(JSON.stringify({
                ...updates,
                updatedAt: Timestamp.now(),
                _version: currentVersion + 1
            }));

            transaction.update(docRef, updateData);
        });
    },

    /**
     * Delete a supplier
     */
    async delete(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    /**
     * Batch create suppliers (for migration)
     */
    async batchCreate(suppliers: Supplier[]): Promise<number> {
        if (suppliers.length === 0) return 0;

        const stats = await executeSafeBatch(suppliers, { collectionName: COLLECTION_NAME }, (supplier, batch) => {
            const supplierData = JSON.parse(JSON.stringify({
                ...supplier,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                _version: 1,
                isActive: supplier.isActive ?? true
            }));

            const id = supplier.id || IdGenerator.supplier();
            batch.set(doc(db, COLLECTION_NAME, id), { ...supplierData, id });
        });

        return stats.totalProcessed;
    },

    /**
     * Find supplier by name (case-insensitive)
     */
    async findByName(name: string): Promise<Supplier | null> {
        const suppliers = await this.getAll();
        const lowerName = name.toLowerCase().trim();
        return suppliers.find(s => 
            s.name.toLowerCase().trim() === lowerName ||
            (s.companyName && s.companyName.toLowerCase().trim() === lowerName)
        ) || null;
    },

    /**
     * Get or create supplier by name
     */
    async getOrCreate(name: string): Promise<Supplier> {
        const existing = await this.findByName(name);
        if (existing) return existing;

        const newSupplier: Supplier = {
            id: IdGenerator.supplier(),
            name: name.trim(),
            isActive: true,
            totalPurchases: 0,
            totalDebt: 0
        };

        return await this.add(newSupplier);
    },

    /**
     * Update supplier stats (totalPurchases, totalDebt)
     */
    async updateStats(id: string, purchaseAmount: number, debtChange: number): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);

        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);

            if (!docSnap.exists()) {
                throw new Error(`Supplier with id ${id} not found`);
            }

            const data = docSnap.data();
            const currentVersion = data?._version || 0;

            transaction.update(docRef, {
                totalPurchases: (data?.totalPurchases || 0) + purchaseAmount,
                totalDebt: (data?.totalDebt || 0) + debtChange,
                updatedAt: Timestamp.now(),
                _version: currentVersion + 1
            });
        });
    }
};
