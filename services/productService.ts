import {
    db,
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    getDoc,
    setDoc,
    serverTimestamp,
    Timestamp
} from '../lib/firebase';
import { Product } from '../types';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

import { validateProduct } from '../utils/validation';

const COLLECTION_NAME = 'products';

export const productService = {
    // Get all products
    getAll: async (): Promise<Product[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product));
        } catch (error) {
            logger.error('ProductService', 'Error getting products:', error);
            throw error;
        }
    },

    // Subscribe to real-time updates
    subscribe: (callback: (products: Product[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
        return onSnapshot(q, (snapshot) => {
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product));
            callback(products);
        }, (error) => {
            logger.error('ProductService', 'Error subscribing to products:', error);
        });
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

    // Update a product
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

            // Use setDoc with merge instead of updateDoc to allow "Upsert"
            // This prevents "No document to update" errors if the doc is missing in DB but exists in UI
            await setDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        } catch (error) {
            logger.error('ProductService', 'Error updating product:', error);
            throw error;
        }
    },

    // Delete a product
    delete: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
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
