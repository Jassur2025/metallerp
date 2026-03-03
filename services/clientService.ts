/**
 * Client Service - Firebase Firestore
 * Professional database for storing client data
 */

import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc,
    query, 
    where, 
    orderBy,
    onSnapshot,
    Timestamp,
    runTransaction,
    startAfter,
    limit
  } from '../lib/firebase';
  import { Client } from '../types';
  import { IdGenerator } from '../utils/idGenerator';
  import { genericFromFirestore, genericToFirestore } from '../utils/firestoreHelpers';
  import { validateClient } from '../utils/validation';
  import { executeSafeBatch } from '../utils/batchWriter';
  import { logger } from '../utils/logger';
  import { assertAuth } from '../utils/authGuard';
  
  // Collection name
  const CLIENTS_COLLECTION = 'clients';
  
  // Firestore document interface
  interface ClientDocument extends Omit<Client, '_version' | 'updatedAt'> {
    _version?: number;
    updatedAt: Timestamp;
    createdAt?: Timestamp;
  }
  
  // Use shared converters
  const fromFirestore = (doc: import('firebase/firestore').DocumentSnapshot): Client => genericFromFirestore<Client>(doc);
  const toFirestore = (client: Client) => genericToFirestore(client);

  /**
   * Find a client in array by name (case-insensitive), or create a new one.
   * Returns the client, its index in the (possibly expanded) array, and whether it was newly created.
   */
  export function findOrCreateClient(
    clients: Client[],
    name: string,
    phone: string = '',
    notes: string = 'Автоматически создан'
  ): { client: Client; index: number; isNew: boolean; clients: Client[] } {
    const searchName = String(name || '').toLowerCase();
    const index = clients.findIndex(c => c.name.toLowerCase() === searchName);

    if (index >= 0) {
      return { client: clients[index], index, isNew: false, clients };
    }

    const newClient: Client = {
      id: IdGenerator.client(),
      name,
      phone,
      creditLimit: 0,
      totalPurchases: 0,
      totalDebt: 0,
      notes
    };
    const updatedClients = [...clients, newClient];
    return { client: newClient, index: updatedClients.length - 1, isNew: true, clients: updatedClients };
  }

  export const clientService = {
    /**
     * Get all clients
     */
    async getAll(): Promise<Client[]> {
      try {
        const querySnapshot = await getDocs(collection(db, CLIENTS_COLLECTION));
        const clients = querySnapshot.docs.map(fromFirestore).filter(c => !c._deleted);
        // Sort client-side
        return clients.sort((a, b) => a.name.localeCompare(b.name));
      } catch (error) {
        logger.error('ClientService', 'Error fetching clients:', error);
        throw error;
      }
    },
  
    /**
     * Get client by ID
     */
    async getById(id: string): Promise<Client | null> {
      try {
        const docRef = doc(db, CLIENTS_COLLECTION, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return fromFirestore(docSnap);
        }
        return null;
      } catch (error) {
        logger.error('ClientService', 'Error fetching client:', error);
        throw error;
      }
    },
  
    /**
     * Create new client
     */
    async create(client: Omit<Client, 'id'>): Promise<Client> {
      try {
        assertAuth();
        const validation = validateClient(client);
        if (!validation.isValid) {
          throw new Error(`Ошибка валидации: ${validation.errors.join(', ')}`);
        }

        const id = IdGenerator.client();
        const now = Timestamp.now();
        
        const docData = {
          ...toFirestore({ ...client, id } as Client),
          createdAt: now,
          _version: 1,
          totalPurchases: client.totalPurchases || 0,
          totalDebt: client.totalDebt || 0
        };
  
        await setDoc(doc(db, CLIENTS_COLLECTION, id), docData);
        
        return {
          ...client,
          id,
          totalPurchases: client.totalPurchases || 0,
          totalDebt: client.totalDebt || 0,
          _version: 1,
          updatedAt: new Date().toISOString()
        };
      } catch (error) {
        logger.error('ClientService', 'Error creating client:', error);
        throw error;
      }
    },
  
    /**
     * Update client
     */
    async update(id: string, updates: Partial<Client>): Promise<void> {
      try {
        const validation = validateClient(updates);
        if (!validation.isValid) {
          throw new Error(`Ошибка валидации: ${validation.errors.join(', ')}`);
        }

        const docRef = doc(db, CLIENTS_COLLECTION, id);

        await runTransaction(db, async (transaction) => {
          const docSnap = await transaction.get(docRef);

          if (!docSnap.exists()) {
            throw new Error(`Client with id ${id} not found`);
          }

          const currentData = fromFirestore(docSnap);
          const newVersion = (currentData._version || 0) + 1;

          const updateData: Record<string, unknown> = {
            ...toFirestore({ ...currentData, ...updates, id } as Client),
            _version: newVersion
          };

          // Remove undefined values
          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
              delete updateData[key];
            }
          });

          transaction.update(docRef, updateData as Record<string, import('firebase/firestore').FieldValue | Partial<unknown> | undefined>);
        });
      } catch (error) {
        logger.error('ClientService', 'Error updating client:', error);
        throw error;
      }
    },
  
    /**
     * Soft-delete client (sets _deleted flag, preserves data for audit)
     */
    async delete(id: string): Promise<void> {
      try {
        await updateDoc(doc(db, CLIENTS_COLLECTION, id), {
          _deleted: true,
          _deletedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('ClientService', 'Error deleting client:', error);
        throw error;
      }
    },
  
    /**
     * Batch create clients (for migration)
     */
    async batchCreate(clients: Client[]): Promise<void> {
      try {
        const now = Timestamp.now();

        await executeSafeBatch(clients, { collectionName: CLIENTS_COLLECTION }, (client, batch) => {
          const id = client.id || IdGenerator.client();
          const docRef = doc(db, CLIENTS_COLLECTION, id);
          batch.set(docRef, {
            ...toFirestore({ ...client, id }),
            createdAt: now,
            _version: client._version || 1
          });
        });
      } catch (error) {
        logger.error('ClientService', 'Error batch creating clients:', error);
        throw error;
      }
    },
  
    /**
     * Subscribe to clients changes (limited for pagination)
     */
    subscribe(callback: (clients: Client[]) => void, maxItems: number = 500): () => void {
        const q = query(collection(db, CLIENTS_COLLECTION), orderBy('name', 'asc'), limit(maxItems));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clients = snapshot.docs.map(fromFirestore).filter(c => !c._deleted);
            callback(clients);
        }, (error) => {
            logger.error('ClientService', 'Error subscribing to clients:', error);
            callback([]);
        });

        return unsubscribe;
    },

    /**
     * Paginated fetch — returns clients after `afterName` alphabetically.
     */
    async getPage(afterName: string, pageSize: number = 100): Promise<{ items: Client[]; hasMore: boolean }> {
        try {
            const q = query(
                collection(db, CLIENTS_COLLECTION),
                orderBy('name', 'asc'),
                startAfter(afterName),
                limit(pageSize + 1)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(fromFirestore);
            const hasMore = docs.length > pageSize;
            return { items: hasMore ? docs.slice(0, pageSize) : docs, hasMore };
        } catch (error) {
            logger.error('ClientService', 'Error fetching page:', error);
            throw error;
        }
    }
  };
