/**
 * useClients Hook - Firebase Firestore
 * Real-time client data management with Firebase
 */

import { useState, useEffect, useCallback } from 'react';
import { Client } from '../types';
import { clientService } from '../services/clientService';
import { useToast } from '../contexts/ToastContext';

interface UseClientsOptions {
    realtime?: boolean;
}

interface UseClientsReturn {
    clients: Client[];
    loading: boolean;
    error: string | null;
    addClient: (client: Omit<Client, 'id'>) => Promise<Client | null>;
    updateClient: (id: string, updates: Partial<Client>) => Promise<boolean>;
    deleteClient: (id: string) => Promise<boolean>;
    refreshClients: () => Promise<void>;
    migrateFromSheets: (oldClients: Client[]) => Promise<boolean>;
}

export const useClients = (options: UseClientsOptions = {}): UseClientsReturn => {
    const { realtime = true } = options;
    const toast = useToast();
    
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load clients manually
    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await clientService.getAll();
            setClients(data);
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки клиентов');
            console.error('Error loading clients:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Setup real-time subscription
    useEffect(() => {
        if (realtime) {
            setLoading(true);
            const unsubscribe = clientService.subscribe((data) => {
                setClients(data);
                setLoading(false);
                setError(null);
            });

            return () => unsubscribe();
        } else {
            loadClients();
        }
    }, [realtime, loadClients]);

    // Add Client
    const addClient = useCallback(async (client: Omit<Client, 'id'>): Promise<Client | null> => {
        try {
            const newClient = await clientService.create(client);
            toast.success('Клиент успешно добавлен');
            
            // If not realtime, manually update state
            if (!realtime) {
                setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
            }
            
            return newClient;
        } catch (err: any) {
            toast.error(`Ошибка добавления клиента: ${err.message}`);
            return null;
        }
    }, [realtime, toast]);

    // Update Client
    const updateClient = useCallback(async (id: string, updates: Partial<Client>): Promise<boolean> => {
        try {
            await clientService.update(id, updates);
            toast.success('Клиент успешно обновлён');
            
            // If not realtime, manually update state
            if (!realtime) {
                setClients(prev => prev.map(c => 
                    c.id === id ? { ...c, ...updates } as Client : c
                ));
            }
            
            return true;
        } catch (err: any) {
            toast.error(`Ошибка обновления клиента: ${err.message}`);
            return false;
        }
    }, [realtime, toast]);

    // Delete Client
    const deleteClient = useCallback(async (id: string): Promise<boolean> => {
        try {
            await clientService.delete(id);
            toast.success('Клиент удалён');

            // If not realtime, manually update state
            if (!realtime) {
                setClients(prev => prev.filter(c => c.id !== id));
            }
            
            return true;
        } catch (err: any) {
            toast.error(`Ошибка удаления клиента: ${err.message}`);
            return false;
        }
    }, [realtime, toast]);

    // Migration
    const migrateFromSheets = useCallback(async (oldClients: Client[]): Promise<boolean> => {
        try {
            if (oldClients.length === 0) return true;
            
            // Check existing to prevent duplicates (naive check by phone/name)
            const existingPhones = new Set(clients.map(c => c.phone));
            const toImport = oldClients.filter(c => !existingPhones.has(c.phone));
            
            if (toImport.length === 0) {
                toast.info('Все клиенты уже есть в базе');
                return true;
            }

            await clientService.batchCreate(toImport);
            toast.success(`Импортировано ${toImport.length} клиентов`);
            return true;
        } catch (err: any) {
            toast.error(`Ошибка миграции: ${err.message}`);
            return false;
        }
    }, [clients, toast]);

    return {
        clients,
        loading,
        error,
        addClient,
        updateClient,
        deleteClient,
        refreshClients: loadClients,
        migrateFromSheets
    };
};
