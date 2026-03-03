import { 
    db, 
    auth,
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    query, 
    orderBy,
    where,
    Timestamp,
    runTransaction,
    onSnapshot,
    limit,
    startAfter
} from '../lib/firebase';
import { Purchase } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';
import { generatePurchaseEntries } from '../utils/ledgerEntryGenerators';
import { ledgerService } from './ledgerService';

const COLLECTION_NAME = 'purchases';

export const purchaseService = {
    /**
     * Get all purchases
     */
    async getAll(): Promise<Purchase[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('_deleted', '!=', true), orderBy('date', 'desc'));
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
    subscribe(callback: (purchases: Purchase[]) => void, maxItems: number = 500): () => void {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'), limit(maxItems));
        return onSnapshot(q, (snapshot) => {
            const purchases = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    items: data.items || [],
                    overheads: data.overheads || { logistics: 0, customsDuty: 0, importVat: 0, other: 0 }
                } as Purchase;
            }).filter(p => !p._deleted);
            callback(purchases);
        });
    },

    /**
     * Paginated fetch — returns purchases older than `afterDate`.
     */
    async getPage(afterDate: string, pageSize: number = 100): Promise<{ items: Purchase[]; hasMore: boolean }> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('_deleted', '!=', true),
                orderBy('date', 'desc'),
                startAfter(afterDate),
                limit(pageSize + 1)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(d => {
                const data = d.data();
                return {
                    ...data,
                    id: d.id,
                    items: data.items || [],
                    overheads: data.overheads || { logistics: 0, customsDuty: 0, importVat: 0, other: 0 }
                } as Purchase;
            });
            const hasMore = docs.length > pageSize;
            return { items: hasMore ? docs.slice(0, pageSize) : docs, hasMore };
        } catch (error) {
            logger.error('PurchaseService', 'Error fetching page:', error);
            throw error;
        }
    },

    /**
     * Add a new purchase
     */
    async add(purchase: Purchase): Promise<Purchase> {
        try {
            assertAuth();
            const purchaseData = JSON.parse(JSON.stringify({
                ...purchase,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                _version: 1
            }));

            let savedPurchase: Purchase;
            if (purchase.id) {
                await setDoc(doc(db, COLLECTION_NAME, purchase.id), purchaseData);
                savedPurchase = purchase;
            } else {
                const newId = IdGenerator.purchase();
                await setDoc(doc(db, COLLECTION_NAME, newId), { ...purchaseData, id: newId });
                savedPurchase = { ...purchase, id: newId };
            }

            // ── Generate General Ledger entries (fire-and-forget) ──────
            try {
                const exchangeRate = Number(purchase.exchangeRate) || 1;
                const totalInventoryUSD = Number(purchase.totalLandedAmount) || 0;
                const inputVatUSD = (Number(purchase.totalVatAmountUZS) || 0) / exchangeRate;
                const amountPaidUSD = Number(purchase.amountPaidUSD)
                    || ((Number(purchase.amountPaid) || 0) / exchangeRate);

                const ledgerEntries = generatePurchaseEntries({
                    purchase: savedPurchase,
                    totalInventoryUSD,
                    inputVatUSD,
                    amountPaidUSD,
                });

                if (ledgerEntries.length > 0) {
                    ledgerService.addEntries(ledgerEntries).catch(err => {
                        logger.error('PurchaseService', 'Ledger entry creation failed (non-fatal):', err);
                    });
                }
            } catch (ledgerErr) {
                logger.error('PurchaseService', 'Ledger entry generation failed (non-fatal):', ledgerErr);
            }

            return savedPurchase;
        } catch (error) {
            logger.error('PurchaseService', 'Error adding purchase:', error);
            throw error;
        }
    },

    /**
     * Update a purchase — uses transaction with optimistic concurrency
     */
    async update(id: string, updates: Partial<Purchase>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);

        await runTransaction(db, async (firebaseTx) => {
            const snap = await firebaseTx.get(docRef);
            if (!snap.exists()) {
                throw new Error(`Purchase with id ${id} not found`);
            }

            const currentVersion = snap.data()?._version || 0;
            const updateData = JSON.parse(JSON.stringify({
                ...updates,
                updatedAt: Timestamp.now(),
                _version: currentVersion + 1
            }));

            firebaseTx.update(docRef, updateData);
        });
    },

    /**
     * @deprecated DEAD CODE — replaced by deletePurchase CF (functions/src/purchases/deletePurchase.ts).
     * Client-side ledgerEntries writes are blocked by firestore.rules. Do NOT call.
     * Soft-delete a purchase with atomic inventory reversal + ledger reversal (СТОРНО).
     * Restores product quantities and creates contra ledger entries (debit↔credit swap).
     */
    async delete(id: string): Promise<void> {
        const purchaseRef = doc(db, COLLECTION_NAME, id);

        // Query ledger entries BEFORE the transaction (client SDK limitation).
        // Safe because purchase ledger entries are immutable and created only
        // once during commitPurchase — no new entries can appear.
        const ledgerQuery = query(
            collection(db, 'ledgerEntries'),
            where('relatedType', '==', 'purchase'),
            where('relatedId', '==', id)
        );
        const ledgerSnaps = await getDocs(ledgerQuery);

        await runTransaction(db, async (firebaseTx) => {
            const purchaseSnap = await firebaseTx.get(purchaseRef);
            if (!purchaseSnap.exists()) return;

            const purchaseData = purchaseSnap.data() as Purchase;
            if (purchaseData._deleted) return;

            // Reverse product quantities added by this purchase
            const productUpdates = new Map<string, number>();
            for (const item of purchaseData.items || []) {
                if (item.productId && item.quantity > 0) {
                    productUpdates.set(
                        item.productId,
                        (productUpdates.get(item.productId) || 0) + item.quantity
                    );
                }
            }

            for (const [productId, qtyToRemove] of productUpdates) {
                const productRef = doc(db, 'products', productId);
                const productSnap = await firebaseTx.get(productRef);
                if (productSnap.exists()) {
                    const currentQty = productSnap.data().quantity || 0;
                    const currentVersion = productSnap.data()._version || 0;
                    firebaseTx.update(productRef, {
                        quantity: Math.max(0, currentQty - qtyToRemove),
                        updatedAt: new Date().toISOString(),
                        _version: currentVersion + 1
                    });
                }
            }

            // Create contra ledger entries — СТОРНО (debit↔credit swap)
            const nowIso = new Date().toISOString();
            const deletedBy = auth.currentUser?.email || auth.currentUser?.uid || 'unknown';
            for (const ledgerDoc of ledgerSnaps.docs) {
                const entry = ledgerDoc.data();
                const contraRef = doc(collection(db, 'ledgerEntries'));
                firebaseTx.set(contraRef, {
                    date: entry.date,
                    debitAccount: entry.creditAccount,   // SWAP
                    creditAccount: entry.debitAccount,    // SWAP
                    amount: entry.amount,
                    ...(entry.amountUZS != null && { amountUZS: entry.amountUZS }),
                    ...(entry.exchangeRate != null && { exchangeRate: entry.exchangeRate }),
                    description: `СТОРНО: ${entry.description}`,
                    relatedType: 'purchase',
                    relatedId: id,
                    ...(entry.periodId && { periodId: entry.periodId }),
                    createdBy: deletedBy,
                    createdAt: nowIso,
                    _isContra: true,
                    _contraOf: ledgerDoc.id,
                });
            }

            // Soft-delete
            firebaseTx.update(purchaseRef, {
                _deleted: true,
                _deletedAt: nowIso,
                _deletedBy: deletedBy,
                updatedAt: Timestamp.now()
            });
        });
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
