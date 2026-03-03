import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { orderAtomicService } from '../services/orderAtomicService';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

const PAGE_SIZE = 100;

export const useOrders = (initialOrders: Order[] = []) => {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    // Pagination state
    const [olderOrders, setOlderOrders] = useState<Order[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const realtimeCountRef = useRef(0);

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
            realtimeCountRef.current = data.length;
            // If the real-time window is full, there may be older data
            setHasMore(data.length >= 500);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

    // Load older page
    const loadMore = useCallback(async () => {
        const lastDate = [...orders, ...olderOrders].at(-1)?.date;
        if (!lastDate || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await orderService.getPage(lastDate, PAGE_SIZE);
            setOlderOrders(prev => {
                const existingIds = new Set(prev.map(o => o.id));
                const unique = page.items.filter(o => !existingIds.has(o.id));
                return [...prev, ...unique];
            });
            setHasMore(page.hasMore);
        } catch (err) {
            logger.error('useOrders', 'Error loading more orders:', err);
            toast.error('Ошибка при загрузке истории заказов');
        } finally {
            setLoadingMore(false);
        }
    }, [orders, olderOrders, loadingMore, toast]);

    // Merged list: real-time head + older pages (deduplicated)
    const allOrders = useMemo(() => {
        if (olderOrders.length === 0) return orders;
        const realtimeIds = new Set(orders.map(o => o.id));
        const tail = olderOrders.filter(o => !realtimeIds.has(o.id));
        return [...orders, ...tail];
    }, [orders, olderOrders]);

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
            await orderAtomicService.deleteOrder(id);
            return true;
        } catch (err: unknown) {
            logger.error('useOrders', 'Error deleting order:', err);
            toast.error('Ошибка при удалении заказа');
            setOrders(prev); // Rollback
            return false;
        }
    }, [orders, toast]);

    return {
        orders: allOrders,
        setOrders,
        loading,
        error,
        addOrder,
        updateOrder,
        deleteOrder,
        refreshOrders: fetchOrders,
        // Pagination
        hasMore,
        loadMore,
        loadingMore,
    };
};
