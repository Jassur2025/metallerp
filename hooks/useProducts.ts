import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { productService } from '../services/productService';
import { useToast } from '../contexts/ToastContext';

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
    migrateProducts: (sheetsProducts: Product[]) => Promise<number>;
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

    // Derived stats
    const stats = {
        totalItems: products.length,
        lowStockCount: products.filter(p => p.quantity <= (p.minStockLevel || 0)).length,
        totalValue: products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0)
    };

    // Load manually
    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await productService.getAll();
            setProducts(data);
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки товаров');
            console.error('Error loading products:', err);
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
                setLoading(false);
                setError(null);
            });
            return () => unsubscribe();
        } else {
            loadProducts();
        }
    }, [realtime, loadProducts]);

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
        } catch (err: any) {
            toast.error(`Ошибка добавления товара: ${err.message}`);
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
        } catch (err: any) {
            toast.error(`Ошибка обновления товара: ${err.message}`);
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
        } catch (err: any) {
            toast.error(`Ошибка удаления товара: ${err.message}`);
            return false;
        }
    }, [realtime, toast]);

    // Migrate from Sheets
    const migrateProducts = useCallback(async (sheetsProducts: Product[]): Promise<number> => {
        try {
            if (sheetsProducts.length === 0) return 0;

            // Avoid duplicates by checking ID
            const existingIds = new Set(products.map(p => p.id));
            const toImport = sheetsProducts.filter(p => !existingIds.has(p.id));

            if (toImport.length === 0) return 0;

            const count = await productService.batchCreate(toImport);

            // Refresh if not realtime (realtime will catch up automatically)
            if (!realtime) {
                await loadProducts();
            }

            return count;
        } catch (err: any) {
            toast.error(`Ошибка миграции товаров: ${err.message}`);
            return 0;
        }
    }, [products, realtime, loadProducts, toast]);

    return {
        products,
        loading,
        error,
        addProduct,
        updateProduct,
        deleteProduct,
        refreshProducts: loadProducts,
        migrateProducts,
        stats
    };
};
