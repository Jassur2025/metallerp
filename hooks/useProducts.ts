import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Product } from '../types';
import { productService } from '../services/productService';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

const PAGE_SIZE = 100;

interface UseProductsOptions {
    realtime?: boolean;
}

interface UseProductsReturn {
    products: Product[];
    loading: boolean;
    error: string | null;
    addProduct: (product: Omit<Product, 'id'>) => Promise<Product | null>;
    updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
    deleteProduct: (id: string) => Promise<boolean>;
    refreshProducts: () => Promise<void>;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    loadingMore: boolean;
    stats: {
        totalItems: number;
        lowStockCount: number;
        totalValue: number;
    }
}

export const useProducts = (options: UseProductsOptions = {}): UseProductsReturn => {
    const { realtime = true } = options;
    const toast = useToast();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [olderProducts, setOlderProducts] = useState<Product[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const realtimeCountRef = useRef(0);

    // Load manually
    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await productService.getAll();
            setProducts(data);
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : String(err)) || 'Ошибка загрузки товаров');
            logger.error('useProducts', 'Error loading products:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Real-time subscription
    useEffect(() => {
        if (realtime) {
            setLoading(true);
            const unsubscribe = productService.subscribe((data) => {
                setProducts(data);
                realtimeCountRef.current = data.length;
                setHasMore(data.length >= 500);
                setLoading(false);
                setError(null);
            });
            return () => unsubscribe();
        } else {
            loadProducts();
        }
    }, [realtime, loadProducts]);

    // Load more (pagination)
    const loadMore = useCallback(async () => {
        const allCurrent = [...products, ...olderProducts];
        const lastName = allCurrent.at(-1)?.name;
        if (!lastName || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await productService.getPage(lastName, PAGE_SIZE);
            setOlderProducts(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const unique = page.items.filter(p => !existingIds.has(p.id));
                return [...prev, ...unique];
            });
            setHasMore(page.hasMore);
        } catch (err) {
            logger.error('useProducts', 'Error loading more products:', err);
            toast.error('Ошибка при загрузке товаров');
        } finally {
            setLoadingMore(false);
        }
    }, [products, olderProducts, loadingMore, toast]);

    // Merged list: real-time head + older pages (deduplicated)
    const allProducts = useMemo(() => {
        if (olderProducts.length === 0) return products;
        const realtimeIds = new Set(products.map(p => p.id));
        const tail = olderProducts.filter(p => !realtimeIds.has(p.id));
        return [...products, ...tail];
    }, [products, olderProducts]);

    // Derived stats
    const stats = {
        totalItems: allProducts.length,
        lowStockCount: allProducts.filter(p => p.quantity <= (p.minStockLevel || 0)).length,
        totalValue: allProducts.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0)
    };

    // Add Product
    const addProduct = useCallback(async (product: Omit<Product, 'id'>): Promise<Product | null> => {
        try {
            const newProduct = await productService.add(product);

            // Optimistic update (always, for better UX)
            setProducts(prev => {
                const updated = [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name));
                return updated;
            });
            return newProduct;
        } catch (err: unknown) {
            toast.error(`Ошибка добавления товара: ${(err instanceof Error ? err.message : String(err))}`);
            // Rollback if needed (though harder with snapshot)
            return null;
        }
    }, [toast]);

    // Update Product
    const updateProduct = useCallback(async (id: string, updates: Partial<Product>): Promise<boolean> => {
        try {
            // Optimistic update
            const oldProducts = [...products];
            setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as Product : p));

            await productService.update(id, updates);

            return true;
        } catch (err: unknown) {
            toast.error(`Ошибка обновления товара: ${(err instanceof Error ? err.message : String(err))}`);
            // Rollback
            if (!realtime) {
                await loadProducts();
            }
            return false;
        }
    }, [products, realtime, toast, loadProducts]);

    // Delete Product
    const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
        try {
            await productService.delete(id);
            toast.success('Товар удалён');

            if (!realtime) {
                setProducts(prev => prev.filter(p => p.id !== id));
            }
            return true;
        } catch (err: unknown) {
            toast.error(`Ошибка удаления товара: ${(err instanceof Error ? err.message : String(err))}`);
            return false;
        }
    }, [realtime, toast]);

    return {
        products: allProducts,
        loading,
        error,
        addProduct,
        updateProduct,
        deleteProduct,
        refreshProducts: loadProducts,
        hasMore,
        loadMore,
        loadingMore,
        stats
    };
};
