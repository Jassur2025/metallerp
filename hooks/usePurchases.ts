import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Purchase } from '../types';
import { purchaseService } from '../services/purchaseService';
import { purchaseAtomicService } from '../services/purchaseAtomicService';
import { logger } from '../utils/logger';

const PAGE_SIZE = 100;

interface UsePurchasesOptions {
    realtime?: boolean;
    enabled?: boolean;
}

export function usePurchases(options: UsePurchasesOptions = {}) {
    const { realtime = true, enabled = true } = options;
    
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [olderPurchases, setOlderPurchases] = useState<Purchase[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const realtimeCountRef = useRef(0);

    // Initial load or realtime subscription
    // Initial load or realtime subscription (skip when disabled)
    useEffect(() => {
        if (!enabled) return;
        if (realtime) {
            const unsubscribe = purchaseService.subscribe((data) => {
                setPurchases(data);
                realtimeCountRef.current = data.length;
                setHasMore(data.length >= 500);
                setLoading(false);
                setError(null);
            });
            return () => unsubscribe();
        } else {
            const fetchPurchases = async () => {
                try {
                    setLoading(true);
                    const data = await purchaseService.getAll();
                    setPurchases(data);
                    setError(null);
                } catch (err) {
                    logger.error('usePurchases', 'Error fetching purchases:', err);
                    setError(err instanceof Error ? err.message : 'Failed to fetch purchases');
                } finally {
                    setLoading(false);
                }
            };
            fetchPurchases();
        }
    }, [realtime, enabled]);

    // Load more (pagination by date)
    const loadMore = useCallback(async () => {
        const allCurrent = [...purchases, ...olderPurchases];
        const lastDate = allCurrent.at(-1)?.date;
        if (!lastDate || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await purchaseService.getPage(lastDate, PAGE_SIZE);
            setOlderPurchases(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const unique = page.items.filter(p => !existingIds.has(p.id));
                return [...prev, ...unique];
            });
            setHasMore(page.hasMore);
        } catch (err) {
            logger.error('usePurchases', 'Error loading more purchases:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [purchases, olderPurchases, loadingMore]);

    // Merged list
    const allPurchases = useMemo(() => {
        if (olderPurchases.length === 0) return purchases;
        const realtimeIds = new Set(purchases.map(p => p.id));
        const tail = olderPurchases.filter(p => !realtimeIds.has(p.id));
        return [...purchases, ...tail];
    }, [purchases, olderPurchases]);

    // Add purchase
    const addPurchase = useCallback(async (purchase: Purchase): Promise<Purchase> => {
        try {
            // Optimistic update
            const tempId = purchase.id || `PUR-temp-${Date.now()}`;
            const optimisticPurchase = { ...purchase, id: tempId };
            setPurchases(prev => [optimisticPurchase, ...prev]);

            // Save to Firebase
            const savedPurchase = await purchaseService.add(purchase);
            
            // Update with real data
            if (!purchase.id || purchase.id !== savedPurchase.id) {
                setPurchases(prev => 
                    prev.map(p => p.id === tempId ? savedPurchase : p)
                );
            }
            
            return savedPurchase;
        } catch (err) {
            // Rollback on error
            setPurchases(prev => prev.filter(p => p.id !== purchase.id));
            logger.error('usePurchases', 'Error adding purchase:', err);
            throw err;
        }
    }, []);

    // Update purchase
    const updatePurchase = useCallback(async (id: string, updates: Partial<Purchase>): Promise<void> => {
        // Store old value for rollback
        const oldPurchase = purchases.find(p => p.id === id);
        
        try {
            // Optimistic update
            setPurchases(prev => 
                prev.map(p => p.id === id ? { ...p, ...updates } : p)
            );

            // Save to Firebase
            await purchaseService.update(id, updates);
        } catch (err) {
            // Rollback on error
            if (oldPurchase) {
                setPurchases(prev => 
                    prev.map(p => p.id === id ? oldPurchase : p)
                );
            }
            logger.error('usePurchases', 'Error updating purchase:', err);
            throw err;
        }
    }, [purchases]);

    // Delete purchase (via Cloud Function — atomic inventory reversal + СТОРНО)
    const deletePurchase = useCallback(async (id: string): Promise<void> => {
        const deletedPurchase = purchases.find(p => p.id === id);
        
        try {
            // Optimistic update
            setPurchases(prev => prev.filter(p => p.id !== id));

            // Delete via CF (atomic reversal + СТОРНО)
            await purchaseAtomicService.deletePurchase(id);
        } catch (err) {
            // Rollback on error
            if (deletedPurchase) {
                setPurchases(prev => [...prev, deletedPurchase]);
            }
            logger.error('usePurchases', 'Error deleting purchase:', err);
            throw err;
        }
    }, [purchases]);

    // Refresh
    const refreshPurchases = useCallback(async () => {
        try {
            setLoading(true);
            const data = await purchaseService.getAll();
            setPurchases(data);
            setError(null);
        } catch (err) {
            logger.error('usePurchases', 'Error refreshing purchases:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh purchases');
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        purchases: allPurchases,
        setPurchases,
        loading,
        error,
        addPurchase,
        updatePurchase,
        deletePurchase,
        refreshPurchases,
        hasMore,
        loadMore,
        loadingMore
    };
}
