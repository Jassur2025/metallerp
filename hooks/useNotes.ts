import { useState, useCallback } from 'react';
import { notesService, ClientNote } from '../services/notesService';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

export const useNotes = (clientId: string | null) => {
    const [notes, setNotes] = useState<ClientNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    const fetchNotes = useCallback(async () => {
        if (!clientId) {
            setNotes([]);
            return;
        }
        
        setLoading(true);
        try {
            const data = await notesService.getNotes(clientId);
            setNotes(data);
            setError(null);
        } catch (err: unknown) {
            logger.error('useNotes', 'Error fetching notes:', err);
            setError((err instanceof Error ? err.message : String(err)));
            toast.error('Не удалось загрузить заметки');
        } finally {
            setLoading(false);
        }
    }, [clientId, toast]);

    const addNote = useCallback(async (text: string, author?: string) => {
        if (!clientId) return;
        
        try {
            const newNote = await notesService.addNote(clientId, text, author);
            setNotes(prev => [newNote, ...prev]);
            toast.success('Заметка добавлена');
            return newNote;
        } catch (err: unknown) {
            logger.error('useNotes', 'Error adding note:', err);
            toast.error('Ошибка при добавлении заметки');
            throw err;
        }
    }, [clientId, toast]);

    return {
        notes,
        loading,
        error,
        fetchNotes,
        addNote
    };
};
