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
    deleteDoc, 
    query, 
    where, 
    orderBy,
    onSnapshot,
    writeBatch,
    Timestamp 
  } from '../lib/firebase';
  import { Client } from '../types';
  import { IdGenerator } from '../utils/idGenerator';
  
  // Collection name
  const CLIENTS_COLLECTION = 'clients';
  
  // Firestore document interface
  interface ClientDocument extends Omit<Client, '_version' | 'updatedAt'> {
    _version?: number;
    updatedAt: Timestamp;
    createdAt?: Timestamp;
  }
  
  // Convert Firestore document to Client
  const fromFirestore = (doc: any): Client => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      _version: data._version || 1,
      // Convert Timestamp to ISO string
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
    };
  };
  
  // Convert Client to Firestore document
  const toFirestore = (client: Client): Partial<ClientDocument> => {
    const { id, ...data } = client;
    const now = Timestamp.now();
    
    // Clean undefined values
    const docData: any = {
      ...data,
      updatedAt: now
    };
    
    // Clean fields
    Object.keys(docData).forEach(key => {
        if (docData[key] === undefined) {
            delete docData[key];
        }
    });

    return docData;
  };
  
  export const clientService = {
    /**
     * Get all clients
     */
    async getAll(): Promise<Client[]> {
      try {
        const querySnapshot = await getDocs(collection(db, CLIENTS_COLLECTION));
        const clients = querySnapshot.docs.map(fromFirestore);
        // Sort client-side
        return clients.sort((a, b) => a.name.localeCompare(b.name));
      } catch (error) {
        console.error('Error fetching clients:', error);
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
        console.error('Error fetching client:', error);
        throw error;
      }
    },
  
    /**
     * Create new client
     */
    async create(client: Omit<Client, 'id'>): Promise<Client> {
      try {
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
        console.error('Error creating client:', error);
        throw error;
      }
    },
  
    /**
     * Update client
     */
    async update(id: string, updates: Partial<Client>): Promise<void> {
      try {
        const docRef = doc(db, CLIENTS_COLLECTION, id);
        const docSnap = await getDoc(docRef);
  
        if (!docSnap.exists()) {
           throw new Error(`Client with id ${id} not found`);
        }

        const currentData = fromFirestore(docSnap);
        const newVersion = (currentData._version || 0) + 1;

        const updateData: any = {
            ...toFirestore({ ...currentData, ...updates, id } as Client),
            _version: newVersion
        };
        
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
               delete updateData[key];
            }
        });

        await updateDoc(docRef, updateData);
      } catch (error) {
        console.error('Error updating client:', error);
        throw error;
      }
    },
  
    /**
     * Delete client
     */
    async delete(id: string): Promise<void> {
      try {
        await deleteDoc(doc(db, CLIENTS_COLLECTION, id));
      } catch (error) {
        console.error('Error deleting client:', error);
        throw error;
      }
    },
  
    /**
     * Batch create clients (for migration)
     */
    async batchCreate(clients: Client[]): Promise<void> {
      try {
        const batch = writeBatch(db);
        const now = Timestamp.now();
  
        for (const client of clients) {
          const id = client.id || IdGenerator.client();
          const docRef = doc(db, CLIENTS_COLLECTION, id);
          
          batch.set(docRef, {
            ...toFirestore({ ...client, id }),
            createdAt: now,
            _version: client._version || 1
          });
        }
  
        await batch.commit();
      } catch (error) {
        console.error('Error batch creating clients:', error);
        throw error;
      }
    },
  
    /**
     * Subscribe to clients changes
     */
    subscribe(callback: (clients: Client[]) => void): () => void {
        const collectionRef = collection(db, CLIENTS_COLLECTION);
        // Simple subscription without ordering to avoid index issues initially
        const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
            const clients = snapshot.docs.map(fromFirestore);
            // Sort client-side
            clients.sort((a, b) => a.name.localeCompare(b.name));
            callback(clients);
        }, (error) => {
            console.error('Error subscribing to clients:', error);
            callback([]);
        });

        return unsubscribe;
    }
  };
