import React, { useEffect, useState } from 'react';
import { Client } from '../../types';
import { useNotes } from '../../hooks/useNotes';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { X, Send, MessageSquare, Loader2, User } from 'lucide-react';

interface ClientNotesModalProps {
    client: Client | null;
    isOpen: boolean;
    onClose: () => void;
    currentUserName?: string;
}

export const ClientNotesModal: React.FC<ClientNotesModalProps> = ({ client, isOpen, onClose, currentUserName }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const { notes, loading, fetchNotes, addNote } = useNotes(client?.id || null);
    const [newNoteText, setNewNoteText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && client) {
            fetchNotes();
        }
    }, [isOpen, client, fetchNotes]);

    if (!isOpen || !client) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;

        setIsSubmitting(true);
        try {
            await addNote(newNoteText, currentUserName || 'Manager');
            setNewNoteText('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`${t.bgCard} w-full max-w-md rounded-2xl shadow-2xl border ${t.border} flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200`}>
                
                {/* Header */}
                <div className={`p-4 border-b ${t.border} flex justify-between items-center`}>
                    <div>
                        <h3 className={`font-bold ${t.text} text-lg flex items-center gap-2`}>
                            <MessageSquare className="text-blue-500" size={20} />
                            Заметки
                        </h3>
                        <p className={`text-sm ${t.textMuted}`}>{client.name}</p>
                    </div>
                    <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-full transition-colors ${t.textMuted} hover:${t.text}`}>
                        <X size={20} />
                    </button>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                        </div>
                    ) : notes.length === 0 ? (
                        <div className={`text-center py-10 ${t.textMuted}`}>
                            Нет заметок
                        </div>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className={`p-3 rounded-lg ${t.bg} border ${t.border}`}>
                                <p className={`text-sm ${t.text} whitespace-pre-wrap`}>{note.text}</p>
                                <div className="mt-2 flex justify-between items-center text-xs opacity-70">
                                    <span className="flex items-center gap-1">
                                        <User size={12} /> {note.author || 'Система'}
                                    </span>
                                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Input Area */}
                <form onSubmit={handleSubmit} className={`p-4 border-t ${t.border} bg-black/5`}>
                    <div className="flex gap-2">
                        <textarea
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            placeholder="Напишите заметку..."
                            className={`flex-1 bg-transparent border ${t.border} rounded-lg p-2 text-sm ${t.text} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-10 py-2.5`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <button 
                            type="submit" 
                            disabled={!newNoteText.trim() || isSubmitting}
                            className={`${t.buttonPrimary} p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
