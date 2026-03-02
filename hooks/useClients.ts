import { useState, useEffect, useCallback } from 'react';
import { Client } from '../types';
import { clientService } from '../services/clientService';

export function useClients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load & Subscription
    useEffect(() => {
        const unsubscribe = clientService.subscribe((data) => {
            setClients(data);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

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
        clients,
        loading,
        error,
        addClient,
        updateClient,
        deleteClient
    };
}
