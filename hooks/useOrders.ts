import { useState, useEffect, useCallback } from 'react';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

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
        } catch (err: unknown) {
            logger.error('useOrders', 'Error fetching orders:', err);
            setError((err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    }, []);

    // Real-time subscription (consistent with other hooks)
    useEffect(() => {
        setLoading(true);
        const unsubscribe = orderService.subscribe((data) => {
            setOrders(data);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

    const addOrder = useCallback(async (order: Order) => {
        try {
            // Optimistic update
            setOrders(prev => [order, ...prev]);
            
            await orderService.add(order);
            // toast.success('Заказ сохранен в базе');
            return true;
        } catch (err: unknown) {
            logger.error('useOrders', 'Error adding order:', err);
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
        } catch (err: unknown) {
            logger.error('useOrders', 'Error updating order:', err);
            toast.error('Ошибка при обновлении заказа');
            fetchOrders(); // Revert to server state
            return false;
        }
    }, [toast, fetchOrders]);

    const deleteOrder = useCallback(async (id: string) => {
        const prev = orders;
        try {
            // Optimistic
            setOrders(p => p.filter(o => o.id !== id));
            await orderService.delete(id);
            return true;
        } catch (err: unknown) {
            logger.error('useOrders', 'Error deleting order:', err);
            toast.error('Ошибка при удалении заказа');
            setOrders(prev); // Rollback
            return false;
        }
    }, [orders, toast]);

    return {
        orders,
        setOrders,
        loading,
        error,
        addOrder,
        updateOrder,
        deleteOrder,
        refreshOrders: fetchOrders
    };
};
