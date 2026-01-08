/**
 * Enhanced Merge Strategy with Version Control
 * 
 * FIXES the weak merge algorithm that relies only on updatedAt timestamps.
 * 
 * Improvements:
 * 1. Version numbers for optimistic locking
 * 2. Field-level conflict detection
 * 3. Better handling of missing timestamps
 * 4. Conflict reporting for user resolution
 */

/**
 * Record with full sync metadata
 */
export interface SyncableRecord {
  id: string;
  version?: number;
  updatedAt?: string;
}

/**
 * Conflict information for user resolution
 */
export interface MergeConflict<T> {
  id: string;
  field?: string;
  localValue: T;
  remoteValue: T;
  localTimestamp?: string;
  remoteTimestamp?: string;
  localVersion?: number;
  remoteVersion?: number;
  resolution?: 'local' | 'remote' | 'manual';
}

/**
 * Result of merge operation
 */
export interface MergeResult<T> {
  merged: T[];
  conflicts: MergeConflict<T>[];
  added: T[];
  updated: T[];
  removed: string[];
}

/**
 * Enhanced merge with version control and conflict detection
 * 
 * Strategy:
 * 1. If versions match: Local can safely overwrite (expected case)
 * 2. If local version > remote: Local wins (local is newer)
 * 3. If remote version > local: CONFLICT (someone else edited)
 * 4. If no versions: Fall back to timestamp comparison
 * 5. If no timestamps: Local wins (backward compatibility)
 */
export function mergeByIdWithVersionControl<T extends SyncableRecord>(
  localItems: T[],
  remoteItems: T[],
  options: {
    /** Report conflicts instead of auto-resolving */
    reportConflicts?: boolean;
    /** Fields to ignore when checking for conflicts */
    ignoreFields?: string[];
  } = {}
): MergeResult<T> {
  const { reportConflicts = false, ignoreFields = [] } = options;
  
  const result: MergeResult<T> = {
    merged: [],
    conflicts: [],
    added: [],
    updated: [],
    removed: []
  };
  
  const remoteMap = new Map<string, T>();
  const localMap = new Map<string, T>();
  
  // Index remote items
  for (const item of remoteItems) {
    remoteMap.set(item.id, item);
  }
  
  // Index local items
  for (const item of localItems) {
    localMap.set(item.id, item);
  }
  
  // Process local items
  for (const localItem of localItems) {
    const remoteItem = remoteMap.get(localItem.id);
    
    if (!remoteItem) {
      // New item (exists only locally)
      result.merged.push(localItem);
      result.added.push(localItem);
      continue;
    }
    
    // Both exist - check for conflicts
    const conflict = detectConflict(localItem, remoteItem, ignoreFields);
    
    if (conflict && reportConflicts) {
      result.conflicts.push({
        id: localItem.id,
        localValue: localItem,
        remoteValue: remoteItem,
        localTimestamp: localItem.updatedAt,
        remoteTimestamp: remoteItem.updatedAt,
        localVersion: localItem.version,
        remoteVersion: remoteItem.version,
      });
      // Use remote as default in conflict case
      result.merged.push(remoteItem);
    } else {
      // Auto-resolve: determine winner
      const winner = resolveConflict(localItem, remoteItem);
      result.merged.push(winner);
      
      if (winner === localItem && !deepEqual(localItem, remoteItem, ignoreFields)) {
        result.updated.push(localItem);
      }
    }
  }
  
  // Add items that exist only remotely (not deleted locally)
  for (const remoteItem of remoteItems) {
    if (!localMap.has(remoteItem.id)) {
      result.merged.push(remoteItem);
    }
  }
  
  return result;
}

/**
 * Detect if there's a conflict between local and remote versions
 */
function detectConflict<T extends SyncableRecord>(
  local: T,
  remote: T,
  ignoreFields: string[]
): boolean {
  // If versions exist, use them
  if (local.version !== undefined && remote.version !== undefined) {
    // Conflict if remote is ahead of what we expect
    // Expected: local.version = remote.version + 1 (we're about to increment)
    // Or: local.version = remote.version (editing same version)
    if (remote.version > (local.version || 0)) {
      return true;
    }
    return false;
  }
  
  // Fall back to timestamp comparison
  if (local.updatedAt && remote.updatedAt) {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    
    // Conflict if remote was updated after local (within some tolerance)
    const TOLERANCE_MS = 1000; // 1 second tolerance for clock skew
    if (remoteTime > localTime + TOLERANCE_MS) {
      return true;
    }
  }
  
  // Check if data actually differs
  return !deepEqual(local, remote, ignoreFields);
}

/**
 * Resolve conflict by choosing winner
 */
function resolveConflict<T extends SyncableRecord>(local: T, remote: T): T {
  // Version-based resolution
  if (local.version !== undefined && remote.version !== undefined) {
    return local.version >= remote.version ? local : remote;
  }
  
  // Timestamp-based resolution
  if (local.updatedAt && remote.updatedAt) {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    return localTime >= remoteTime ? local : remote;
  }
  
  // No metadata - local wins (user's intent)
  return local;
}

/**
 * Deep equality check with field exclusion
 */
function deepEqual<T>(obj1: T, obj2: T, ignoreFields: string[] = []): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== typeof obj2) return false;
  if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
    return obj1 === obj2;
  }
  
  const keys1 = Object.keys(obj1 as object).filter(k => !ignoreFields.includes(k));
  const keys2 = Object.keys(obj2 as object).filter(k => !ignoreFields.includes(k));
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!deepEqual((obj1 as any)[key], (obj2 as any)[key], ignoreFields)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Increment version for a record about to be saved
 */
export function incrementVersion<T extends SyncableRecord>(item: T): T & { version: number; updatedAt: string } {
  return {
    ...item,
    version: (item.version || 0) + 1,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Batch increment versions
 */
export function incrementVersionBatch<T extends SyncableRecord>(items: T[]): (T & { version: number; updatedAt: string })[] {
  const now = new Date().toISOString();
  return items.map(item => ({
    ...item,
    version: (item.version || 0) + 1,
    updatedAt: now
  }));
}

/**
 * Enhanced product merge with quantity delta calculation
 * 
 * FIXED: Now properly handles concurrent quantity changes by:
 * 1. Calculating the delta (change) from base state
 * 2. Applying both deltas to get correct final value
 */
export interface ProductRecord extends SyncableRecord {
  quantity?: number;
  costPrice?: number;
}

export function mergeProductsWithDeltaEnhanced<T extends ProductRecord>(
  localItems: T[],
  remoteItems: T[],
  baseItems: T[]
): MergeResult<T> {
  const result: MergeResult<T> = {
    merged: [],
    conflicts: [],
    added: [],
    updated: [],
    removed: []
  };
  
  const remoteMap = new Map<string, T>();
  const baseMap = new Map<string, T>();
  
  for (const item of remoteItems) {
    remoteMap.set(item.id, item);
  }
  
  for (const item of baseItems) {
    baseMap.set(item.id, item);
  }
  
  for (const localItem of localItems) {
    const remoteItem = remoteMap.get(localItem.id);
    const baseItem = baseMap.get(localItem.id);
    
    if (!remoteItem) {
      // New item
      result.merged.push(localItem);
      result.added.push(localItem);
      continue;
    }
    
    // Calculate deltas if base exists
    if (baseItem && localItem.quantity !== undefined && remoteItem.quantity !== undefined) {
      const localDelta = (localItem.quantity || 0) - (baseItem.quantity || 0);
      const remoteDelta = (remoteItem.quantity || 0) - (baseItem.quantity || 0);
      
      // If both changed quantity, combine deltas
      if (localDelta !== 0 || remoteDelta !== 0) {
        const baseQty = baseItem.quantity || 0;
        const mergedQuantity = Math.max(0, baseQty + localDelta + remoteDelta);
        
        // Calculate weighted average cost price if both changed
        let mergedCostPrice = localItem.costPrice;
        if (localDelta !== 0 && remoteDelta !== 0 && 
            localItem.costPrice !== undefined && 
            remoteItem.costPrice !== undefined &&
            baseItem.costPrice !== undefined) {
          const baseValue = baseQty * (baseItem.costPrice || 0);
          const localValue = Math.abs(localDelta) * (localItem.costPrice || 0);
          const remoteValue = Math.abs(remoteDelta) * (remoteItem.costPrice || 0);
          mergedCostPrice = mergedQuantity > 0 
            ? (baseValue + localValue + remoteValue) / mergedQuantity 
            : 0;
        }
        
        const mergedItem: T = {
          ...localItem,
          quantity: mergedQuantity,
          costPrice: mergedCostPrice,
          version: Math.max(localItem.version || 0, remoteItem.version || 0) + 1,
          updatedAt: new Date().toISOString()
        };
        
        result.merged.push(mergedItem);
        result.updated.push(mergedItem);
        continue;
      }
    }
    
    // Standard merge for non-quantity fields
    const winner = resolveConflict(localItem, remoteItem);
    result.merged.push(winner);
    
    if (winner === localItem) {
      result.updated.push(localItem);
    }
  }
  
  // Add remote-only items
  for (const remoteItem of remoteItems) {
    const localItem = localItems.find(i => i.id === remoteItem.id);
    if (!localItem) {
      result.merged.push(remoteItem);
    }
  }
  
  return result;
}

export default {
  mergeByIdWithVersionControl,
  mergeProductsWithDeltaEnhanced,
  incrementVersion,
  incrementVersionBatch,
};
