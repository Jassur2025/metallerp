/**
 * Reset Service — Bulk data deletion (admin only).
 *
 * Deletes all documents from business collections while preserving:
 * - employees (user accounts)
 * - settings (system configuration)
 *
 * Security: Must be called only by admin role users. The UI enforces this.
 */
import { db, collection, getDocs, writeBatch, doc } from '../lib/firebase';

const DELETABLE_COLLECTIONS = [
  'products',
  'orders',
  'transactions',
  'clients',
  'suppliers',
  'purchases',
  'journalEvents',
  'fixedAssets',
  'accountingPeriods',
  'ledgerEntries',
  'workflowOrders',
];

// 'employees' and 'settings' are intentionally PRESERVED

/**
 * Delete all `notes` subcollections under each client document.
 */
async function deleteClientSubcollections(): Promise<void> {
  const clientsSnap = await getDocs(collection(db, 'clients'));
  for (const clientDoc of clientsSnap.docs) {
    const notesSnap = await getDocs(collection(db, 'clients', clientDoc.id, 'notes'));
    if (notesSnap.empty) continue;

    for (let i = 0; i < notesSnap.docs.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = notesSnap.docs.slice(i, i + 450);
      for (const noteDoc of chunk) {
        batch.delete(doc(db, 'clients', clientDoc.id, 'notes', noteDoc.id));
      }
      await batch.commit();
    }
  }
}

export interface ResetProgress {
  collection: string;
  deleted: number;
  status: 'pending' | 'deleting' | 'done' | 'error';
  error?: string;
}

/**
 * Delete all documents from a Firestore collection using batched writes.
 */
async function deleteCollection(collectionName: string): Promise<number> {
  // Before deleting clients, clean up their `notes` subcollections
  if (collectionName === 'clients') {
    await deleteClientSubcollections();
  }

  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) return 0;

  let deleted = 0;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + 450);

    for (const docSnap of chunk) {
      batch.delete(doc(db, collectionName, docSnap.id));
    }

    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

/**
 * Delete all data except employees and settings.
 * @param userRole - Must be 'admin' to proceed
 */
export async function resetAllData(
  userRole: string,
  onProgress?: (progress: ResetProgress[]) => void
): Promise<{ success: boolean; totalDeleted: number; errors: string[] }> {
  // Security check: only admin can delete
  if (userRole !== 'admin') {
    throw new Error('Только администратор может удалять данные');
  }

  const progress: ResetProgress[] = [
    ...DELETABLE_COLLECTIONS.map(c => ({
      collection: c,
      deleted: 0,
      status: 'pending' as const,
    })),
    { collection: 'balance', deleted: 0, status: 'pending' as const },
  ];

  onProgress?.(progress);

  let totalDeleted = 0;
  const errors: string[] = [];

  for (let i = 0; i < DELETABLE_COLLECTIONS.length; i++) {
    const colName = DELETABLE_COLLECTIONS[i];
    progress[i].status = 'deleting';
    onProgress?.([...progress]);

    try {
      const count = await deleteCollection(colName);
      progress[i].deleted = count;
      progress[i].status = 'done';
      totalDeleted += count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress[i].status = 'error';
      progress[i].error = msg;
      errors.push(`${colName}: ${msg}`);
    }

    onProgress?.([...progress]);
  }

  // Delete balance document
  const balanceIdx = progress.length - 1;
  progress[balanceIdx].status = 'deleting';
  onProgress?.([...progress]);

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'balance', 'current'));
    await batch.commit();
    progress[balanceIdx].deleted = 1;
    progress[balanceIdx].status = 'done';
    totalDeleted += 1;
  } catch {
    progress[balanceIdx].status = 'done'; // balance doc may not exist
  }

  onProgress?.([...progress]);

  return { success: errors.length === 0, totalDeleted, errors };
}

/** Human-readable collection names */
export const COLLECTION_LABELS: Record<string, string> = {
  products: 'Товары',
  orders: 'Заказы',
  transactions: 'Транзакции',
  clients: 'Клиенты',
  suppliers: 'Поставщики',
  purchases: 'Закупки',
  journalEvents: 'Журнал событий',
  fixedAssets: 'Основные средства',
  accountingPeriods: 'Учётные периоды',
  ledgerEntries: 'Проводки',
  workflowOrders: 'Workflow заказы',
  balance: 'Баланс',
};
