import { useState, useEffect, useCallback, useMemo } from 'react';
import { JournalEvent } from '../types';
import { journalService } from '../services/journalService';
import { logger } from '../utils/logger';

const PAGE_SIZE = 100;

interface UseJournalOptions {
    enabled?: boolean;
}

export function useJournal(options: UseJournalOptions = {}) {
    const { enabled = true } = options;
    const [journalEvents, setJournalEvents] = useState<JournalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [olderEvents, setOlderEvents] = useState<JournalEvent[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Initial load & Subscription (skip when disabled)
    useEffect(() => {
        if (!enabled) return;
        const unsubscribe = journalService.subscribe((data) => {
            setJournalEvents(data);
            setHasMore(data.length >= 100); // default subscribe limit
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, [enabled]);

    const addEvent = useCallback(async (event: Omit<JournalEvent, 'id'>) => {
        try {
            return await journalService.add(event);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error adding journal event');
            throw err;
        }
    }, []);

    // Load older page
    const loadMore = useCallback(async () => {
        const all = [...journalEvents, ...olderEvents];
        const lastDate = all.at(-1)?.date;
        if (!lastDate || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await journalService.getPage(lastDate, PAGE_SIZE);
            setOlderEvents(prev => {
                const existingIds = new Set(prev.map(e => e.id));
                const unique = page.items.filter(e => !existingIds.has(e.id));
                return [...prev, ...unique];
            });
            setHasMore(page.hasMore);
        } catch (err) {
            logger.error('useJournal', 'Error loading more:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [journalEvents, olderEvents, loadingMore]);

    // Merge real-time head + older pages
    const allEvents = useMemo(() => {
        if (olderEvents.length === 0) return journalEvents;
        const realtimeIds = new Set(journalEvents.map(e => e.id));
        const tail = olderEvents.filter(e => !realtimeIds.has(e.id));
        return [...journalEvents, ...tail];
    }, [journalEvents, olderEvents]);

    return {
        journalEvents: allEvents,
        loading,
        error,
        addEvent,
        hasMore,
        loadMore,
        loadingMore,
    };
}
