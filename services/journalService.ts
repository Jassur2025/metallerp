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
    Timestamp,
    query,
    orderBy,
    limit
} from '../lib/firebase';
import { JournalEvent } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { executeSafeBatch } from '../utils/batchWriter';
import { genericToFirestore } from '../utils/firestoreHelpers';
import { logger } from '../utils/logger';

// Collection name — must match firestore.rules match path
const COLLECTION_NAME = 'journalEvents';

// Firestore document interface
interface JournalEventDocument extends JournalEvent {
    createdAt?: Timestamp;
}

// fromFirestore is minimal (no Timestamp fields to convert)
const fromFirestore = (doc: import('firebase/firestore').DocumentSnapshot): JournalEvent => {
    const data = doc.data();
    return { ...data, id: doc.id } as JournalEvent;
};

// toFirestore uses shared converter with createdAt timestamp
const toFirestore = (event: JournalEvent) => genericToFirestore(event, 'createdAt');

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
            logger.error('JournalService', 'Error fetching journal events:', error);
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
            logger.error('JournalService', 'Error adding journal event:', error);
            throw error;
        }
    },

    /**
     * Batch create events (for migration)
     */
    async batchCreate(events: JournalEvent[]): Promise<number> {
        try {
            const now = Timestamp.now();

            const stats = await executeSafeBatch(events, { collectionName: COLLECTION_NAME }, (event, batch) => {
                const id = event.id || IdGenerator.journal();
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.set(docRef, {
                    ...toFirestore({ ...event, id }),
                    createdAt: now
                });
            });

            return stats.totalProcessed;
        } catch (error) {
            logger.error('JournalService', 'Error batch creating journal events:', error);
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
            logger.error('JournalService', 'Error subscribing to journal:', error);
            callback([]);
        });

        return unsubscribe;
    }
};
