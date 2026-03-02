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

    return {
        journalEvents,
        loading,
        error,
        addEvent
    };
}
