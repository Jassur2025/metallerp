import { useState, useEffect, useCallback } from 'react';
import { FixedAsset } from '../types';
import { fixedAssetsService } from '../services/fixedAssetsService';

export function useFixedAssets() {
    const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load & Subscription
    useEffect(() => {
        const unsubscribe = fixedAssetsService.subscribe((data) => {
            setFixedAssets(data);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

    const addAsset = useCallback(async (asset: Omit<FixedAsset, 'id'>) => {
        try {
            return await fixedAssetsService.add(asset);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error adding asset');
            throw err;
        }
    }, []);

    const updateAsset = useCallback(async (id: string, updates: Partial<FixedAsset>) => {
        try {
            await fixedAssetsService.update(id, updates);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error updating asset');
            throw err;
        }
    }, []);

    const deleteAsset = useCallback(async (id: string) => {
        try {
            await fixedAssetsService.delete(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error deleting asset');
            throw err;
        }
    }, []);

    const migrateAssets = useCallback(async (legacyAssets: FixedAsset[]) => {
        // Find assets that are NOT in Firebase yet (by ID)
        // Since IDs might differ if they were generated differently, be careful. 
        // Assuming legacy IDs are what we want to keep or detect duplicates by name/date?
        // For simplicity, checking by ID.
        const currentIds = new Set(fixedAssets.map(a => a.id));
        const toMigrate = legacyAssets.filter(a => !currentIds.has(a.id));

        if (toMigrate.length === 0) return 0;

        return await fixedAssetsService.batchCreate(toMigrate);
    }, [fixedAssets]);

    return {
        fixedAssets,
        loading,
        error,
        addAsset,
        updateAsset,
        deleteAsset,
        migrateAssets
    };
}
