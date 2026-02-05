import { useState, useEffect, useCallback } from 'react';
import { Purchase } from '../types';
import { purchaseService } from '../services/purchaseService';

interface UsePurchasesOptions {
    realtime?: boolean;
}

export function usePurchases(options: UsePurchasesOptions = {}) {
    const { realtime = true } = options;
    
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load or realtime subscription
    useEffect(() => {
        if (realtime) {
            const unsubscribe = purchaseService.subscribe((data) => {
                setPurchases(data);
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
                    console.error('Error fetching purchases:', err);
                    setError(err instanceof Error ? err.message : 'Failed to fetch purchases');
                } finally {
                    setLoading(false);
                }
            };
            fetchPurchases();
        }
    }, [realtime]);

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
            console.error('Error adding purchase:', err);
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
            console.error('Error updating purchase:', err);
            throw err;
        }
    }, [purchases]);

    // Delete purchase
    const deletePurchase = useCallback(async (id: string): Promise<void> => {
        const deletedPurchase = purchases.find(p => p.id === id);
        
        try {
            // Optimistic update
            setPurchases(prev => prev.filter(p => p.id !== id));

            // Delete from Firebase
            await purchaseService.delete(id);
        } catch (err) {
            // Rollback on error
            if (deletedPurchase) {
                setPurchases(prev => [...prev, deletedPurchase]);
            }
            console.error('Error deleting purchase:', err);
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
            console.error('Error refreshing purchases:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh purchases');
        } finally {
            setLoading(false);
        }
    }, []);

    // Migrate from Google Sheets
    const migratePurchases = useCallback(async (sheetsPurchases: Purchase[]): Promise<number> => {
        if (sheetsPurchases.length === 0) return 0;

        // Get existing IDs
        const existingIds = new Set(purchases.map(p => p.id));
        
        // Filter only new purchases
        const newPurchases = sheetsPurchases.filter(p => !existingIds.has(p.id));
        
        if (newPurchases.length === 0) return 0;

        const count = await purchaseService.batchCreate(newPurchases);
        
        // Refresh to get updated list
        await refreshPurchases();
        
        return count;
    }, [purchases, refreshPurchases]);

    return {
        purchases,
        setPurchases,
        loading,
        error,
        addPurchase,
        updatePurchase,
        deletePurchase,
        refreshPurchases,
        migratePurchases
    };
}
