/**
 * Fixed Assets Service - Firebase Firestore
 * Professional database for storing fixed assets data
 */

import {
    db,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    Timestamp,
    runTransaction
} from '../lib/firebase';
import { FixedAsset } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { genericFromFirestore, genericToFirestore } from '../utils/firestoreHelpers';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

// Collection name
const COLLECTION_NAME = 'fixedAssets';

// Firestore document interface
interface FixedAssetDocument extends Omit<FixedAsset, '_version' | 'updatedAt'> {
    _version?: number;
    updatedAt: Timestamp;
    createdAt?: Timestamp;
}

// Use shared converters
const fromFirestore = (doc: import('firebase/firestore').DocumentSnapshot): FixedAsset => genericFromFirestore<FixedAsset>(doc);
const toFirestore = (asset: FixedAsset) => genericToFirestore(asset);

export const fixedAssetsService = {
    /**
     * Get all fixed assets
     */
    async getAll(): Promise<FixedAsset[]> {
        try {
            const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
            return querySnapshot.docs.map(fromFirestore);
        } catch (error) {
            logger.error('FixedAssetsService', 'Error fetching fixed assets:', error);
            throw error;
        }
    },

    /**
     * Get asset by ID
     */
    async getById(id: string): Promise<FixedAsset | null> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return fromFirestore(docSnap);
            }
            return null;
        } catch (error) {
            logger.error('FixedAssetsService', 'Error fetching fixed asset:', error);
            throw error;
        }
    },

    /**
     * Create new asset
     */
    async add(asset: Omit<FixedAsset, 'id'>): Promise<FixedAsset> {
        try {
            const id = IdGenerator.fixedAsset(); // Use generic generator or create specific one
            const now = Timestamp.now();

            const docData = {
                ...toFirestore({ ...asset, id } as FixedAsset),
                createdAt: now,
                _version: 1,
                accumulatedDepreciation: asset.accumulatedDepreciation || 0
            };

            await setDoc(doc(db, COLLECTION_NAME, id), docData);

            return {
                ...asset,
                id,
                accumulatedDepreciation: asset.accumulatedDepreciation || 0,
                _version: 1,
                updatedAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('FixedAssetsService', 'Error creating fixed asset:', error);
            throw error;
        }
    },

    /**
     * Update asset
     */
    async update(id: string, updates: Partial<FixedAsset>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);

            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);

                if (!docSnap.exists()) {
                    throw new Error(`Fixed asset with id ${id} not found`);
                }

                const currentData = fromFirestore(docSnap);
                const newVersion = (currentData._version || 0) + 1;

                const updateData: Record<string, unknown> = {
                    ...toFirestore({ ...currentData, ...updates, id } as FixedAsset),
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
            logger.error('FixedAssetsService', 'Error updating fixed asset:', error);
            throw error;
        }
    },

    /**
     * Delete asset
     */
    async delete(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            logger.error('FixedAssetsService', 'Error deleting fixed asset:', error);
            throw error;
        }
    },

    /**
     * Batch create assets (for migration)
     */
    async batchCreate(assets: FixedAsset[]): Promise<number> {
        try {
            const now = Timestamp.now();

            const stats = await executeSafeBatch(assets, { collectionName: COLLECTION_NAME }, (asset, batch) => {
                const id = asset.id || IdGenerator.fixedAsset();
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.set(docRef, {
                    ...toFirestore({ ...asset, id }),
                    createdAt: now,
                    _version: 1
                });
            });

            return stats.totalProcessed;
        } catch (error) {
            logger.error('FixedAssetsService', 'Error batch creating fixed assets:', error);
            throw error;
        }
    },

    /**
     * Subscribe to changes
     */
    subscribe(callback: (assets: FixedAsset[]) => void): () => void {
        const collectionRef = collection(db, COLLECTION_NAME);
        const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
            const assets = snapshot.docs.map(fromFirestore);
            callback(assets);
        }, (error) => {
            logger.error('FixedAssetsService', 'Error subscribing to fixed assets:', error);
            callback([]);
        });

        return unsubscribe;
    }
};
