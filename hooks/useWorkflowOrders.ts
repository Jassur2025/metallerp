import { useState, useEffect, useCallback } from 'react';
import { WorkflowOrder } from '../types';
import { workflowOrderService } from '../services/workflowOrderService';

export function useWorkflowOrders() {
    const [workflowOrders, setWorkflowOrders] = useState<WorkflowOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load & Subscription
    useEffect(() => {
        const unsubscribe = workflowOrderService.subscribe((data) => {
            setWorkflowOrders(data);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

    const addWorkflowOrder = useCallback(async (order: Omit<WorkflowOrder, 'id'>) => {
        try {
            return await workflowOrderService.add(order);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error adding workflow order');
            throw err;
        }
    }, []);

    const updateWorkflowOrder = useCallback(async (id: string, updates: Partial<WorkflowOrder>) => {
        try {
            await workflowOrderService.update(id, updates);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error updating workflow order');
            throw err;
        }
    }, []);

    const deleteWorkflowOrder = useCallback(async (id: string) => {
        try {
            await workflowOrderService.delete(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error deleting workflow order');
            throw err;
        }
    }, []);

    return {
        workflowOrders,
        loading,
        error,
        addWorkflowOrder,
        updateWorkflowOrder,
        deleteWorkflowOrder
    };
}
