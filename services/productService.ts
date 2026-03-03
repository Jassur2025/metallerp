import {
    db,
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    getDoc,
    setDoc,
    serverTimestamp,
    Timestamp,
    runTransaction,
    startAfter,
    limit
} from '../lib/firebase';
import { Product } from '../types';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

import { validateProduct } from '../utils/validation';

const COLLECTION_NAME = 'products';

export const productService = {
    // Get all products (excludes soft-deleted)
    getAll: async (): Promise<Product[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product)).filter(p => !p._deleted);
        } catch (error) {
            logger.error('ProductService', 'Error getting products:', error);
            throw error;
        }
    },

    // Subscribe to real-time updates (limited for pagination, excludes soft-deleted)
    subscribe: (callback: (products: Product[]) => void, maxItems: number = 500) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'), limit(maxItems));
        return onSnapshot(q, (snapshot) => {
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product)).filter(p => !p._deleted);
            callback(products);
        }, (error) => {
            logger.error('ProductService', 'Error subscribing to products:', error);
        });
    },

    /**
     * Paginated fetch — returns products after `afterName` alphabetically.
     */
    async getPage(afterName: string, pageSize: number = 100): Promise<{ items: Product[]; hasMore: boolean }> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                orderBy('name', 'asc'),
                startAfter(afterName),
                limit(pageSize + 1)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            const hasMore = docs.length > pageSize;
            return { items: hasMore ? docs.slice(0, pageSize) : docs, hasMore };
        } catch (error) {
            logger.error('ProductService', 'Error fetching page:', error);
            throw error;
        }
    },

    // Add a new product (supports custom ID)
    add: async (product: Product | Omit<Product, 'id'>): Promise<Product> => {
        try {
            const validation = validateProduct(product);
            if (!validation.isValid) {
                throw new Error(`Ошибка валидации: ${validation.errors.join(', ')}`);
            }

            // Clean undefined fields
            const data = JSON.parse(JSON.stringify(product));
            const id = 'id' in product ? product.id : undefined;

            if (id) {
                // Use provided ID with setDoc
                const docRef = doc(db, COLLECTION_NAME, id);
                await setDoc(docRef, {
                    ...data,
                    createdAt: serverTimestamp(),
                    updatedAt: new Date().toISOString(),
                    _version: 1
                });
                return { id, ...product } as Product;
            } else {
                // Auto-generate ID with addDoc
                const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                    ...data,
                    createdAt: serverTimestamp(),
                    updatedAt: new Date().toISOString(),
                    _version: 1
                });
                return { id: docRef.id, ...product } as Product;
            }
        } catch (error) {
            logger.error('ProductService', 'Error adding product:', error);
            throw error;
        }
    },

    // Update a product — atomic with optimistic concurrency (_version)
    update: async (id: string, updates: Partial<Product>): Promise<void> => {
        try {
            const hasProductFields = updates.name || updates.quantity !== undefined || updates.pricePerUnit !== undefined || updates.costPrice !== undefined;
            if (hasProductFields) {
                const validation = validateProduct(updates);
                if (!validation.isValid) {
                    throw new Error(`Ошибка валидации: ${validation.errors.join(', ')}`);
                }
            }

            const docRef = doc(db, COLLECTION_NAME, id);
            const data = JSON.parse(JSON.stringify(updates));
            delete data.id; // Don't update ID

            await runTransaction(db, async (firebaseTx) => {
                const snap = await firebaseTx.get(docRef);

                if (!snap.exists()) {
                    // Upsert: create if missing (was setDoc merge before)
                    firebaseTx.set(docRef, {
                        ...data,
                        updatedAt: new Date().toISOString(),
                        _version: 1
                    });
                    return;
                }

                const currentVersion = snap.data()?._version || 0;
                firebaseTx.update(docRef, {
                    ...data,
                    updatedAt: new Date().toISOString(),
                    _version: currentVersion + 1
                });
            });
        } catch (error) {
            logger.error('ProductService', 'Error updating product:', error);
            throw error;
        }
    },

    // Soft-delete a product (sets _deleted flag, preserves data for audit)
    delete: async (id: string): Promise<void> => {
        try {
            await updateDoc(doc(db, COLLECTION_NAME, id), {
              _deleted: true,
              _deletedAt: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('ProductService', 'Error deleting product:', error);
            throw error;
        }
    },

    // Batch create/import (for migration)
    batchCreate: async (products: Product[]): Promise<number> => {
        try {
            const stats = await executeSafeBatch(products, { collectionName: COLLECTION_NAME }, (product, batch) => {
                const finalDocRef = product.id ? doc(db, COLLECTION_NAME, product.id) : doc(collection(db, COLLECTION_NAME));
                const data = JSON.parse(JSON.stringify(product));
                delete data.id;

                batch.set(finalDocRef, {
                    ...data,
                    createdAt: serverTimestamp(),
                    updatedAt: new Date().toISOString(),
                    _version: 1
                });
            });

            return stats.totalProcessed;
        } catch (error) {
            logger.error('ProductService', 'Error batch creating products:', error);
            throw error;
        }
    }
};
