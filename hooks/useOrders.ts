import { useState, useEffect, useCallback } from 'react';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { useToast } from '../contexts/ToastContext';

export const useOrders = (initialOrders: Order[] = []) => {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await orderService.getAll();
            setOrders(data);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            // Don't show toast on initial load error to avoid spam if offline
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const addOrder = useCallback(async (order: Order) => {
        try {
            // Optimistic update
            setOrders(prev => [order, ...prev]);
            
            await orderService.add(order);
            // toast.success('Заказ сохранен в базе');
            return true;
        } catch (err: any) {
            console.error(err);
            toast.error('Ошибка при сохранении заказа');
            // Rollback
            setOrders(prev => prev.filter(o => o.id !== order.id));
            return false;
        }
    }, [toast]);

    const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
        try {
            // Optimistic
            setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
            
            await orderService.update(id, updates);
            // toast.success('Заказ обновлен');
            return true;
        } catch (err: any) {
            console.error(err);
            toast.error('Ошибка при обновлении заказа');
            fetchOrders(); // Revert to server state
            return false;
        }
    }, [toast, fetchOrders]);
    
    const migrateOrders = useCallback(async (legacyOrders: Order[]) => {
        if (!legacyOrders.length) return;
        
        try {
            setLoading(true);
            // Check which ones are already in DB (simple check by ID in current state)
            // Ideally we should check DB, but for simple migration this is okay
            const existingIds = new Set(orders.map(o => o.id));
            const toMigrate = legacyOrders.filter(o => !existingIds.has(o.id));
            
            if (toMigrate.length === 0) {
                 // toast.info('Все заказы уже в базе');
                 setLoading(false);
                 return;
            }

            // Split into chunks of 500 (Firestore limit)
            const chunkSize = 400;
            for (let i = 0; i < toMigrate.length; i += chunkSize) {
                const chunk = toMigrate.slice(i, i + chunkSize);
                await orderService.batchCreate(chunk);
            }
            
            await fetchOrders();
            toast.success(`Миграция завершена: ${toMigrate.length} заказов перенесено`);
        } catch (err: any) {
            console.error('Migration failed:', err);
            toast.error('Ошибка миграции заказов');
        } finally {
            setLoading(false);
        }
    }, [orders, fetchOrders, toast]);

    return {
        orders,
        setOrders,
        loading,
        error,
        addOrder,
        updateOrder,
        refreshOrders: fetchOrders,
        migrateOrders
    };
};
