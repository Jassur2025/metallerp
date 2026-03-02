import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Client } from '../types';
import { clientService } from '../services/clientService';
import { logger } from '../utils/logger';

const PAGE_SIZE = 100;

export function useClients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [olderClients, setOlderClients] = useState<Client[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const realtimeCountRef = useRef(0);

    // Initial load & Subscription
    useEffect(() => {
        const unsubscribe = clientService.subscribe((data) => {
            setClients(data);
            realtimeCountRef.current = data.length;
            setHasMore(data.length >= 500);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

    // Load more (pagination by name)
    const loadMore = useCallback(async () => {
        const allCurrent = [...clients, ...olderClients];
        const lastName = allCurrent.at(-1)?.name;
        if (!lastName || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await clientService.getPage(lastName, PAGE_SIZE);
            setOlderClients(prev => {
                const existingIds = new Set(prev.map(c => c.id));
                const unique = page.items.filter(c => !existingIds.has(c.id));
                return [...prev, ...unique];
            });
            setHasMore(page.hasMore);
        } catch (err) {
            logger.error('useClients', 'Error loading more clients:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [clients, olderClients, loadingMore]);

    // Merged list
    const allClients = useMemo(() => {
        if (olderClients.length === 0) return clients;
        const realtimeIds = new Set(clients.map(c => c.id));
        const tail = olderClients.filter(c => !realtimeIds.has(c.id));
        return [...clients, ...tail];
    }, [clients, olderClients]);

    const addClient = useCallback(async (client: Omit<Client, 'id'>) => {
        try {
            return await clientService.create(client);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error adding client');
            throw err;
        }
    }, []);

    const updateClient = useCallback(async (id: string, updates: Partial<Client>) => {
        try {
            await clientService.update(id, updates);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error updating client');
            throw err;
        }
    }, []);

    const deleteClient = useCallback(async (id: string) => {
        try {
            await clientService.delete(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error deleting client');
            throw err;
        }
    }, []);

    return {
        clients: allClients,
        loading,
        error,
        hasMore,
        loadMore,
        loadingMore,
        addClient,
        updateClient,
        deleteClient
    };
}
