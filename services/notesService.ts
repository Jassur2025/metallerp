/**
 * CRM Notes Service - Firebase Firestore
 * Handles notes and interactions with clients
 */
import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    Timestamp 
} from '../lib/firebase';

export interface ClientNote {
    id: string;
    clientId: string;
    text: string;
    createdAt: string;
    author?: string; // e.g. "Manager"
}

const NOTES_COLLECTION = 'notes'; // Root collection or sub-collection? 
// Let's use sub-collection: clients/{id}/notes for better organization

export const notesService = {
    /**
     * Get notes for a client
     */
    async getNotes(clientId: string): Promise<ClientNote[]> {
        try {
            const notesRef = collection(db, 'clients', clientId, 'notes');
            const q = query(notesRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                clientId,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
            } as ClientNote));
        } catch (error) {
            console.error('Error fetching notes:', error);
            return [];
        }
    },

    /**
     * Add a note for a client
     */
    async addNote(clientId: string, text: string, author: string = 'System'): Promise<ClientNote> {
        try {
            const notesRef = collection(db, 'clients', clientId, 'notes');
            const now = Timestamp.now();
            
            const docRef = await addDoc(notesRef, {
                text,
                author,
                createdAt: now
            });

            return {
                id: docRef.id,
                clientId,
                text,
                author,
                createdAt: now.toDate().toISOString()
            };
        } catch (error) {
            console.error('Error adding note:', error);
            throw error;
        }
    }
};
