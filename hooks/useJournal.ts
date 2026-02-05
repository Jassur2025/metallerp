import { useState, useEffect, useCallback } from 'react';
import { JournalEvent } from '../types';
import { journalService } from '../services/journalService';

export function useJournal() {
    const [journalEvents, setJournalEvents] = useState<JournalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load & Subscription
    useEffect(() => {
        const unsubscribe = journalService.subscribe((data) => {
            setJournalEvents(data);
            setLoading(false);
            setError(null);
        });
        return () => unsubscribe();
    }, []);

    const addEvent = useCallback(async (event: Omit<JournalEvent, 'id'>) => {
        try {
            return await journalService.add(event);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error adding journal event');
            throw err;
        }
    }, []);

    const migrateEvents = useCallback(async (legacyEvents: JournalEvent[]) => {
        // Find events that are NOT in Firebase yet (by ID)
        // Note: Journal can be huge, so checking against local 'recent' 100 might trigger duplicates if we naively check 'journalEvents'.
        // For accurate migration we should rely on ID.
        // If we only loaded 100, we might re-migrate old ones.
        // However, `set` in Firestore overwrites, so it's idempotent. It's safe to "re-migrate".
        if (legacyEvents.length === 0) return 0;

        // Optimisation: only migrate if we suspect they aren't there? 
        // Or just batch write all of them (safe but writes ops).
        // Let's rely on the calling code to decide logic, or just migrate all passed.

        return await journalService.batchCreate(legacyEvents);
    }, []);

    return {
        journalEvents,
        loading,
        error,
        addEvent,
        migrateEvents
    };
}
