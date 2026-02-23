/**
 * Reset Service — clears all business data from Firestore
 * Used when deploying a clean instance for a new client/demo
 */

import { db, collection, getDocs, writeBatch, doc } from '../lib/firebase';

// Collections to clear (operational data only)
// KEPT: products (nomenclature), fixedAssets, suppliers, settings
const BUSINESS_COLLECTIONS = [
  'orders',
  'transactions',
  'clients',
  'employees',
  'purchases',
  'workflowOrders',
  'journal',
];

interface ResetProgress {
  collection: string;
  deletedCount: number;
}

interface ResetResult {
  success: boolean;
  totalDeleted: number;
  details: ResetProgress[];
  error?: string;
}

/**
 * Deletes all documents in a single Firestore collection.
 * Uses batched writes (max 450 per batch) for safety.
 */
async function clearCollection(collectionName: string): Promise<number> {
  const collRef = collection(db, collectionName);
  const snapshot = await getDocs(collRef);
  
  if (snapshot.empty) return 0;

  const BATCH_SIZE = 450;
  let deleted = 0;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(d => {
      batch.delete(doc(db, collectionName, d.id));
    });

    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

/**
 * Resets ALL business data across all collections.
 * Settings are preserved (only business data is cleared).
 * 
 * @param includeSettings - If true, also resets settings to defaults
 * @param onProgress - Optional callback for progress updates
 */
export async function resetAllData(
  includeSettings = false,
  onProgress?: (progress: ResetProgress) => void
): Promise<ResetResult> {
  const details: ResetProgress[] = [];
  let totalDeleted = 0;

  try {
    const collections = includeSettings 
      ? [...BUSINESS_COLLECTIONS, 'settings']
      : BUSINESS_COLLECTIONS;

    for (const collName of collections) {
      const deletedCount = await clearCollection(collName);
      const progress = { collection: collName, deletedCount };
      details.push(progress);
      totalDeleted += deletedCount;
      onProgress?.(progress);
    }

    // Clear localStorage cache
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('metal_erp_') || key.startsWith('erp_cache_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // localStorage may not be available
    }

    return { success: true, totalDeleted, details };
  } catch (error: any) {
    return { 
      success: false, 
      totalDeleted, 
      details, 
      error: error.message || 'Ошибка при сбросе данных' 
    };
  }
}

/** Collection names for display in UI */
export const COLLECTION_LABELS: Record<string, string> = {
  products: 'Товары',
  orders: 'Заказы',
  transactions: 'Транзакции и расходы',
  clients: 'Клиенты',
  employees: 'Сотрудники',
  purchases: 'Закупки',
  suppliers: 'Поставщики',
  fixedAssets: 'Основные средства',
  workflowOrders: 'Workflow заявки',
  journal: 'Журнал событий',
  settings: 'Настройки',
};
