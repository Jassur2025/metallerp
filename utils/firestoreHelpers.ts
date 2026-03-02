/**
 * Shared Firestore document converter helpers.
 * Eliminates copy-paste fromFirestore/toFirestore across services.
 */

import { Timestamp } from '../lib/firebase';
import type { DocumentSnapshot } from 'firebase/firestore';

/**
 * Standard fromFirestore converter for entities with _version and updatedAt.
 * Converts Firestore Timestamps to ISO strings.
 */
export function genericFromFirestore<T extends { id: string }>(doc: DocumentSnapshot): T {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    _version: data?._version || 1,
    updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
  } as unknown as T;
}

/**
 * Standard toFirestore converter.
 * Strips `id` (used as document key), sets updatedAt, removes undefined fields.
 */
export function genericToFirestore<T extends { id: string }>(
  entity: T,
  timestampField: 'updatedAt' | 'createdAt' = 'updatedAt'
): Record<string, unknown> {
  const { id: _id, ...data } = entity as Record<string, unknown>;
  const now = Timestamp.now();
  const docData: Record<string, unknown> = { ...data, [timestampField]: now };
  Object.keys(docData).forEach(key => {
    if (docData[key] === undefined) { delete docData[key]; }
  });
  return docData;
}
