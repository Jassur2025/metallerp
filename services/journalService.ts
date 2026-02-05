/**
 * Journal Service - Firebase Firestore
 * Audit log and system events
 */

import {
    db,
    collection,
    doc,
    getDocs,
    setDoc,
    onSnapshot,
    writeBatch,
    Timestamp,
    query,
    orderBy,
    limit
} from '../lib/firebase';
import { JournalEvent } from '../types';
import { IdGenerator } from '../utils/idGenerator';

// Collection name
const COLLECTION_NAME = 'journal';

// Firestore document interface
interface JournalEventDocument extends JournalEvent {
    createdAt?: Timestamp;
}

// Convert Firestore document to JournalEvent
const fromFirestore = (doc: any): JournalEvent => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id
    };
};

// Convert JournalEvent to Firestore document
const toFirestore = (event: JournalEvent): Partial<JournalEventDocument> => {
    const { id, ...data } = event;
    const now = Timestamp.now();

    // Clean undefined values
    const docData: any = {
        ...data,
        createdAt: now
    };

    Object.keys(docData).forEach(key => {
        if (docData[key] === undefined) {
            delete docData[key];
        }
    });

    return docData;
};

export const journalService = {
    /**
     * Get recent journal events
     */
    async getRecent(limitCount = 100): Promise<JournalEvent[]> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                orderBy('date', 'desc'),
                limit(limitCount)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(fromFirestore);
        } catch (error) {
            console.error('Error fetching journal events:', error);
            throw error;
        }
    },

    /**
     * Log a new event
     */
    async add(event: Omit<JournalEvent, 'id'>): Promise<JournalEvent> {
        try {
            const id = IdGenerator.journal();
            const now = Timestamp.now();

            const docData = {
                ...toFirestore({ ...event, id } as JournalEvent),
                createdAt: now
            };

            await setDoc(doc(db, COLLECTION_NAME, id), docData);

            return {
                ...event,
                id
            };
        } catch (error) {
            console.error('Error adding journal event:', error);
            throw error;
        }
    },

    /**
     * Batch create events (for migration)
     */
    async batchCreate(events: JournalEvent[]): Promise<number> {
        try {
            const batch = writeBatch(db);
            const now = Timestamp.now();
            let count = 0;

            // Firestore batches are limited to 500 ops.
            // We'll take the first 500 for safety if array is huge, 
            // or caller should handle chunking. 
            // For migration we assume the caller or this fn handles it.
            // Let's implement simple chunking here for robustness.

            const chunks = [];
            for (let i = 0; i < events.length; i += 450) {
                chunks.push(events.slice(i, i + 450));
            }

            let totalMigrated = 0;

            for (const chunk of chunks) {
                const currentBatch = writeBatch(db);
                for (const event of chunk) {
                    const id = event.id || IdGenerator.journal();
                    const docRef = doc(db, COLLECTION_NAME, id);
                    currentBatch.set(docRef, {
                        ...toFirestore({ ...event, id }),
                        createdAt: now
                    });
                }
                await currentBatch.commit();
                totalMigrated += chunk.length;
            }

            return totalMigrated;
        } catch (error) {
            console.error('Error batch creating journal events:', error);
            throw error;
        }
    },

    /**
     * Subscribe to recent events
     */
    subscribe(callback: (events: JournalEvent[]) => void, limitCount = 100): () => void {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('date', 'desc'),
            limit(limitCount)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(fromFirestore);
            callback(events);
        }, (error) => {
            console.error('Error subscribing to journal:', error);
            callback([]);
        });

        return unsubscribe;
    }
};
