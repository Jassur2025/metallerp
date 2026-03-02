import { 
    db, 
    auth,
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    addDoc,
    query, 
    orderBy,
    where,
    Timestamp,
    runTransaction,
    onSnapshot,
    limit,
    startAfter
} from '../lib/firebase';
import { Order } from '../types';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';

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
            const q = query(collection(db, COLLECTION_NAME), where('_deleted', '!=', true), orderBy('date', 'desc'));
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
    subscribe(callback: (orders: Order[]) => void, maxItems: number = 500): () => void {
        const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'), limit(maxItems));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(fromFirestoreDoc).filter(o => !o._deleted));
        }, (error) => {
            logger.error('OrderService', 'Subscription error:', error);
        });
    },

    /**
     * Paginated fetch — returns orders older than `afterDate`.
     * Used by the "Load more" button in the hook.
     */
    async getPage(afterDate: string, pageSize: number = 100): Promise<{ items: Order[]; hasMore: boolean }> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('_deleted', '!=', true),
                orderBy('date', 'desc'),
                startAfter(afterDate),
                limit(pageSize + 1)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(fromFirestoreDoc);
            const hasMore = docs.length > pageSize;
            return { items: hasMore ? docs.slice(0, pageSize) : docs, hasMore };
        } catch (error) {
            logger.error('OrderService', 'Error fetching page:', error);
            throw error;
        }
    },

    /**
     * Add a new order
     */
    async add(order: Order): Promise<Order> {
        try {
            assertAuth();
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
     * Soft-delete an order with atomic inventory reversal.
     * Restores product quantities and reverses client debt within a single transaction.
     */
    async delete(id: string): Promise<void> {
        const orderRef = doc(db, COLLECTION_NAME, id);

        await runTransaction(db, async (firebaseTx) => {
            // 1. Read the order inside the transaction
            const orderSnap = await firebaseTx.get(orderRef);
            if (!orderSnap.exists()) return; // already gone

            const orderData = orderSnap.data() as Order;

            // Skip if already soft-deleted
            if (orderData._deleted) return;

            // 2. Only reverse completed orders (they had inventory deducted)
            if (orderData.status === 'completed') {
                // 2a. Restore product quantities
                const productUpdates = new Map<string, number>();
                for (const item of orderData.items || []) {
                    if (item.productId && item.quantity > 0) {
                        productUpdates.set(
                            item.productId,
                            (productUpdates.get(item.productId) || 0) + item.quantity
                        );
                    }
                }

                for (const [productId, qtyToRestore] of productUpdates) {
                    const productRef = doc(db, 'products', productId);
                    const productSnap = await firebaseTx.get(productRef);
                    if (productSnap.exists()) {
                        const currentQty = productSnap.data().quantity || 0;
                        const currentVersion = productSnap.data()._version || 0;
                        firebaseTx.update(productRef, {
                            quantity: currentQty + qtyToRestore,
                            updatedAt: new Date().toISOString(),
                            _version: currentVersion + 1
                        });
                    }
                }

                // 2b. Reverse client debt if order had debt
                if (orderData.clientId) {
                    const clientRef = doc(db, 'clients', orderData.clientId);
                    const clientSnap = await firebaseTx.get(clientRef);
                    if (clientSnap.exists()) {
                        const clientData = clientSnap.data();
                        const currentDebt = clientData.totalDebt || 0;
                        const currentPurchases = clientData.totalPurchases || 0;

                        // Reverse debt: the unpaid portion of the order
                        const debtPortion = orderData.totalAmount - (orderData.amountPaid || 0);
                        const newDebt = Math.max(0, currentDebt - debtPortion);
                        const newPurchases = Math.max(0, currentPurchases - orderData.totalAmount);

                        firebaseTx.update(clientRef, {
                            totalDebt: newDebt,
                            totalPurchases: newPurchases,
                            updatedAt: Timestamp.now()
                        });
                    }
                }
            }

            // 3. Soft-delete the order
            firebaseTx.update(orderRef, {
                _deleted: true,
                _deletedAt: new Date().toISOString(),
                _deletedBy: auth.currentUser?.uid || 'unknown',
                updatedAt: Timestamp.now()
            });
        });
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
