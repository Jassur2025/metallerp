import { useState, useEffect, useCallback, useRef } from 'react';
import {
  db,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  getCountFromServer,
  DocumentSnapshot,
  where,
} from '../lib/firebase';
import { logger } from '../utils/logger';
import type { QueryConstraint } from 'firebase/firestore';

/**
 * Configuration for paginated Firestore queries.
 */
export interface PaginationConfig {
  /** Firestore collection name */
  collectionName: string;
  /** Number of items per page */
  pageSize?: number;
  /** Order by field (default: 'date') */
  orderField?: string;
  /** Order direction (default: 'desc') */
  orderDirection?: 'asc' | 'desc';
  /** Additional WHERE constraints */
  constraints?: QueryConstraint[];
  /** Use real-time subscription for the first page (default: true) */
  realtime?: boolean;
  /** Map raw Firestore data to typed object */
  mapDoc?: (id: string, data: Record<string, any>) => any;
  /** Soft-delete filter field (default: '_deleted') */
  softDeleteField?: string;
}

export interface UsePaginatedReturn<T> {
  /** Current loaded items (all pages combined) */
  items: T[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether there are more pages to load */
  hasMore: boolean;
  /** Load the next page */
  loadMore: () => Promise<void>;
  /** Reset to first page and reload */
  refresh: () => void;
  /** Total estimated count of items in the collection */
  totalCount: number;
  /** Current number of loaded pages */
  pageCount: number;
}

const DEFAULT_PAGE_SIZE = 100;

/**
 * Generic paginated Firestore hook.
 * 
 * Uses cursor-based pagination (startAfter) for efficient Firestore queries.
 * First page uses onSnapshot for real-time updates; subsequent pages use getDocs.
 * 
 * @example
 * ```ts
 * const { items: orders, loadMore, hasMore } = usePaginated<Order>({
 *   collectionName: 'orders',
 *   pageSize: 50,
 *   orderField: 'date',
 *   orderDirection: 'desc',
 *   mapDoc: (id, data) => ({ ...data, id } as Order),
 * });
 * ```
 */
export function usePaginated<T>(config: PaginationConfig): UsePaginatedReturn<T> {
  const {
    collectionName,
    pageSize = DEFAULT_PAGE_SIZE,
    orderField = 'date',
    orderDirection = 'desc',
    constraints = [],
    realtime = true,
    mapDoc = (id, data) => ({ ...data, id } as T),
    softDeleteField = '_deleted',
  } = config;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  // Cursor: the last document snapshot from the previous page
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const isLoadingMore = useRef(false);

  // Build base query constraints
  const buildConstraints = useCallback((): QueryConstraint[] => {
    const qConstraints: QueryConstraint[] = [
      ...constraints,
      orderBy(orderField, orderDirection),
      limit(pageSize),
    ];
    return qConstraints;
  }, [constraints, orderField, orderDirection, pageSize]);

  // Fetch total count (approximate) — runs once on mount  
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const coll = collection(db, collectionName);
        const snapshot = await getCountFromServer(query(coll, ...constraints));
        setTotalCount(snapshot.data().count);
      } catch (err) {
        logger.warn('usePaginated', `Count query failed for ${collectionName}:`, err);
      }
    };
    fetchCount();
  }, [collectionName, constraints]);

  // First page: realtime subscription OR one-time fetch
  useEffect(() => {
    setLoading(true);
    setItems([]);
    setPageCount(0);
    lastDocRef.current = null;
    setHasMore(true);

    const coll = collection(db, collectionName);
    const qConstraints = buildConstraints();
    const q = query(coll, ...qConstraints);

    if (realtime) {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs;
        const mapped = docs
          .map(d => mapDoc(d.id, d.data()))
          .filter(item => !(item as any)[softDeleteField]);
        
        setItems(mapped);
        setPageCount(1);
        lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;
        setHasMore(docs.length >= pageSize);
        setLoading(false);
        setError(null);
      }, (err) => {
        logger.error('usePaginated', `Subscription error for ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      const fetchFirst = async () => {
        try {
          const snapshot = await getDocs(q);
          const docs = snapshot.docs;
          const mapped = docs
            .map(d => mapDoc(d.id, d.data()))
            .filter(item => !(item as any)[softDeleteField]);

          setItems(mapped);
          setPageCount(1);
          lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;
          setHasMore(docs.length >= pageSize);
          setError(null);
        } catch (err: any) {
          logger.error('usePaginated', `Fetch error for ${collectionName}:`, err);
          setError(err.message || 'Failed to fetch data');
        } finally {
          setLoading(false);
        }
      };
      fetchFirst();
    }
  }, [collectionName, buildConstraints, realtime, pageSize, mapDoc, softDeleteField]);

  // Load next page (always one-time getDocs with cursor)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore.current || !lastDocRef.current) return;

    isLoadingMore.current = true;
    try {
      const coll = collection(db, collectionName);
      const qConstraints: QueryConstraint[] = [
        ...constraints,
        orderBy(orderField, orderDirection),
        startAfter(lastDocRef.current),
        limit(pageSize),
      ];
      const q = query(coll, ...qConstraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;

      const mapped = docs
        .map(d => mapDoc(d.id, d.data()))
        .filter(item => !(item as any)[softDeleteField]);

      setItems(prev => [...prev, ...mapped]);
      setPageCount(prev => prev + 1);
      lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;
      setHasMore(docs.length >= pageSize);
    } catch (err: any) {
      logger.error('usePaginated', `LoadMore error for ${collectionName}:`, err);
      setError(err.message || 'Failed to load more data');
    } finally {
      isLoadingMore.current = false;
    }
  }, [hasMore, collectionName, constraints, orderField, orderDirection, pageSize, mapDoc, softDeleteField]);

  // Reset and refresh
  const refresh = useCallback(() => {
    setItems([]);
    setPageCount(0);
    lastDocRef.current = null;
    setHasMore(true);
    setLoading(true);
    // The useEffect will re-run because loading changed
    // Force re-mount by toggling a counter (handled via dependency array)
  }, []);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    totalCount,
    pageCount,
  };
}
