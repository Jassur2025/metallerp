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

    return {
        fixedAssets,
        loading,
        error,
        addAsset,
        updateAsset,
        deleteAsset
    };
}
