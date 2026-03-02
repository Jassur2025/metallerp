import { useState, useEffect, useCallback } from 'react';
import { Supplier } from '../types';
import { supplierService } from '../services/supplierService';
import { logger } from '../utils/logger';

interface UseSupplierOptions {
    realtime?: boolean;
}

export function useSuppliers(options: UseSupplierOptions = {}) {
    const { realtime = true } = options;
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load or realtime subscription
    useEffect(() => {
        if (realtime) {
            // Real-time subscription
            const unsubscribe = supplierService.subscribe((data) => {
                setSuppliers(data);
                setLoading(false);
                setError(null);
            });
            return () => unsubscribe();
        } else {
            // One-time fetch
            const fetchSuppliers = async () => {
                try {
                    setLoading(true);
                    const data = await supplierService.getAll();
                    setSuppliers(data);
                    setError(null);
                } catch (err) {
                    logger.error('useSuppliers', 'Error fetching suppliers:', err);
                    setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
                } finally {
                    setLoading(false);
                }
            };
            fetchSuppliers();
        }
    }, [realtime]);

    // Add supplier
    const addSupplier = useCallback(async (supplier: Supplier): Promise<Supplier> => {
        try {
            // Optimistic update
            const tempId = supplier.id || `SUP-temp-${Date.now()}`;
            const optimisticSupplier = { ...supplier, id: tempId };
            setSuppliers(prev => [...prev, optimisticSupplier]);

            // Save to Firebase
            const savedSupplier = await supplierService.add(supplier);
            
            // Update with real ID if needed
            if (!supplier.id) {
                setSuppliers(prev => 
                    prev.map(s => s.id === tempId ? savedSupplier : s)
                );
            }
            
            return savedSupplier;
        } catch (err) {
            // Rollback on error
            setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
            logger.error('useSuppliers', 'Error adding supplier:', err);
            throw err;
        }
    }, []);

    // Update supplier
    const updateSupplier = useCallback(async (id: string, updates: Partial<Supplier>): Promise<void> => {
        try {
            // Optimistic update
            setSuppliers(prev => 
                prev.map(s => s.id === id ? { ...s, ...updates } : s)
            );

            // Save to Firebase
            await supplierService.update(id, updates);
        } catch (err) {
            // Reload on error
            const data = await supplierService.getAll();
            setSuppliers(data);
            logger.error('useSuppliers', 'Error updating supplier:', err);
            throw err;
        }
    }, []);

    // Delete supplier
    const deleteSupplier = useCallback(async (id: string): Promise<void> => {
        // Store for rollback
        const deletedSupplier = suppliers.find(s => s.id === id);
        
        try {
            // Optimistic update
            setSuppliers(prev => prev.filter(s => s.id !== id));

            // Delete from Firebase
            await supplierService.delete(id);
        } catch (err) {
            // Rollback on error
            if (deletedSupplier) {
                setSuppliers(prev => [...prev, deletedSupplier]);
            }
            logger.error('useSuppliers', 'Error deleting supplier:', err);
            throw err;
        }
    }, [suppliers]);

    // Get or create supplier by name
    const getOrCreateSupplier = useCallback(async (name: string): Promise<Supplier> => {
        // Check local state first
        const lowerName = name.toLowerCase().trim();
        const existing = suppliers.find(s => 
            s.name.toLowerCase().trim() === lowerName ||
            (s.companyName && s.companyName.toLowerCase().trim() === lowerName)
        );
        
        if (existing) return existing;

        // Create new
        return await supplierService.getOrCreate(name);
    }, [suppliers]);

    // Refresh suppliers
    const refreshSuppliers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await supplierService.getAll();
            setSuppliers(data);
            setError(null);
        } catch (err) {
            logger.error('useSuppliers', 'Error refreshing suppliers:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh suppliers');
        } finally {
            setLoading(false);
        }
    }, []);

    // Migrate from existing purchases (extract unique supplier names)
    const migrateFromPurchases = useCallback(async (purchases: { supplierName: string }[]): Promise<number> => {
        // Get unique supplier names
        const uniqueNames = [...new Set(
            purchases
                .map(p => p.supplierName?.trim())
                .filter(Boolean)
        )];

        // Get existing suppliers
        const existingSuppliers = await supplierService.getAll();
        const existingNames = new Set(
            existingSuppliers.map(s => s.name.toLowerCase().trim())
        );

        // Filter only new suppliers
        const newSupplierNames = uniqueNames.filter(
            name => !existingNames.has(name.toLowerCase())
        );

        if (newSupplierNames.length === 0) return 0;

        // Create supplier objects
        const newSuppliers: Supplier[] = newSupplierNames.map((name, index) => ({
            id: `SUP-mig-${Date.now()}-${index}`,
            name,
            isActive: true,
            totalPurchases: 0,
            totalDebt: 0
        }));

        // Batch create
        const count = await supplierService.batchCreate(newSuppliers);
        
        // Refresh local state
        await refreshSuppliers();
        
        return count;
    }, [refreshSuppliers]);

    return {
        suppliers,
        loading,
        error,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        getOrCreateSupplier,
        refreshSuppliers,
        migrateFromPurchases
    };
}
