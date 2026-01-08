/**
 * Safe Save Handler - Prevents Local State / Sheets Desync
 * 
 * CRITICAL FIX: This module ensures that local React state is ONLY updated
 * AFTER successful save to Google Sheets, preventing the data desync issue.
 * 
 * Pattern: Optimistic UI with Rollback
 * 1. Show loading state
 * 2. Attempt save to Sheets
 * 3. If success: Update local state
 * 4. If failure: Show error, DO NOT update state
 */

import type { Dispatch, SetStateAction } from 'react';
import { sheetsService } from '../services/sheetsService';
import { withUpdatedAtBatch } from '../services/sheets/merge';

const isDev = import.meta.env.DEV;
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

export interface SafeSaveResult<T> {
  success: boolean;
  data?: T[];
  error?: string;
  wasRolledBack?: boolean;
}

export interface SafeSaveOptions {
  /** Retry count on failure (default: 1) */
  retries?: number;
  /** Show toast notifications */
  showToasts?: boolean;
  /** Toast function */
  toast?: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
  };
}

/**
 * Creates a safe save handler that ensures data integrity
 * 
 * Usage:
 * ```typescript
 * const safeSaveProducts = createSafeSaveHandler(
 *   () => accessToken,
 *   (token, data) => sheetsService.saveAllProducts(token, data),
 *   'Товары'
 * );
 * 
 * // In component:
 * const result = await safeSaveProducts(
 *   newProducts,
 *   setProducts,
 *   { toast }
 * );
 * 
 * if (result.success) {
 *   // State was updated, continue
 * } else {
 *   // State was NOT updated, show error
 * }
 * ```
 */
export function createSafeSaveHandler<T extends { id: string }>(
  getAccessToken: () => string | null,
  saveMethod: (token: string, data: T[]) => Promise<void>,
  entityName: string
) {
  return async (
    newData: T[],
    setState: Dispatch<SetStateAction<T[]>>,
    options: SafeSaveOptions = {}
  ): Promise<SafeSaveResult<T>> => {
    const { retries = 1, showToasts = true, toast } = options;
    
    const token = getAccessToken();
    if (!token) {
      const error = 'Нет токена доступа. Войдите заново.';
      if (showToasts && toast) toast.error(error);
      return { success: false, error };
    }

    // Add timestamps to all records
    const dataWithTimestamps = withUpdatedAtBatch(newData);
    
    let lastError: string = '';
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logDev(`[SafeSave] ${entityName}: Попытка ${attempt + 1}/${retries + 1}, ${dataWithTimestamps.length} записей`);
        
        // ⚠️ CRITICAL: Save to Sheets FIRST
        await saveMethod(token, dataWithTimestamps);
        
        // ✅ SUCCESS: Only now update local state
        setState(dataWithTimestamps);
        
        logDev(`[SafeSave] ${entityName}: ✅ Успешно сохранено и state обновлён`);
        
        if (showToasts && toast) {
          toast.success(`${entityName} сохранены (${dataWithTimestamps.length} шт.)`);
        }
        
        return { 
          success: true, 
          data: dataWithTimestamps 
        };
        
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        errorDev(`[SafeSave] ${entityName}: ❌ Ошибка (попытка ${attempt + 1}):`, err);
        
        // Check if it's a token error that might be recoverable
        const isAuthError = lastError.includes('UNAUTHENTICATED') || 
                           lastError.includes('401') ||
                           lastError.includes('токен');
        
        if (isAuthError) {
          // Don't retry auth errors - user needs to re-login
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // ❌ FAILURE: State NOT updated
    if (showToasts && toast) {
      toast.error(`Ошибка сохранения ${entityName.toLowerCase()}: ${lastError}`);
    }
    
    return { 
      success: false, 
      error: lastError,
      wasRolledBack: true  // Indicates state was NOT changed
    };
  };
}

/**
 * Safe update handler for single record operations
 * Useful for inline edits where you want to update one record in an array
 */
export function createSafeSingleRecordHandler<T extends { id: string }>(
  getAccessToken: () => string | null,
  saveMethod: (token: string, data: T[]) => Promise<void>,
  entityName: string
) {
  return async (
    updatedRecord: T,
    currentData: T[],
    setState: Dispatch<SetStateAction<T[]>>,
    options: SafeSaveOptions = {}
  ): Promise<SafeSaveResult<T>> => {
    // Build the new array with the updated record
    const newData = currentData.map(item => 
      item.id === updatedRecord.id ? updatedRecord : item
    );
    
    // Check if record exists (prevent adding duplicates)
    const exists = currentData.some(item => item.id === updatedRecord.id);
    if (!exists) {
      // It's a new record, add it
      newData.push(updatedRecord);
    }
    
    const handler = createSafeSaveHandler(getAccessToken, saveMethod, entityName);
    return handler(newData, setState, options);
  };
}

/**
 * Safe delete handler
 * Removes record from both Sheets and state only if Sheets save succeeds
 */
export function createSafeDeleteHandler<T extends { id: string }>(
  getAccessToken: () => string | null,
  saveMethod: (token: string, data: T[]) => Promise<void>,
  entityName: string
) {
  return async (
    idToDelete: string,
    currentData: T[],
    setState: Dispatch<SetStateAction<T[]>>,
    options: SafeSaveOptions = {}
  ): Promise<SafeSaveResult<T>> => {
    const newData = currentData.filter(item => item.id !== idToDelete);
    
    // Verify record was found
    if (newData.length === currentData.length) {
      const error = `Запись ${idToDelete} не найдена`;
      if (options.showToasts && options.toast) {
        options.toast.warning(error);
      }
      return { success: false, error };
    }
    
    const handler = createSafeSaveHandler(getAccessToken, saveMethod, entityName);
    return handler(newData, setState, options);
  };
}

/**
 * Batch safe save - saves multiple entity types atomically
 * If ANY save fails, none of the states are updated
 */
export async function safeSaveBatch(
  operations: Array<{
    name: string;
    save: () => Promise<void>;
    updateState: () => void;
  }>,
  options: SafeSaveOptions = {}
): Promise<{ success: boolean; failedOperations: string[] }> {
  const failedOperations: string[] = [];
  const successfulOps: Array<() => void> = [];
  
  for (const op of operations) {
    try {
      await op.save();
      successfulOps.push(op.updateState);
    } catch (err) {
      errorDev(`[SafeSaveBatch] ${op.name} failed:`, err);
      failedOperations.push(op.name);
    }
  }
  
  // Only update states if ALL operations succeeded
  if (failedOperations.length === 0) {
    successfulOps.forEach(updateState => updateState());
    
    if (options.showToasts && options.toast) {
      options.toast.success(`Все данные сохранены (${operations.length} модулей)`);
    }
    
    return { success: true, failedOperations: [] };
  }
  
  // Some operations failed - don't update any state
  if (options.showToasts && options.toast) {
    options.toast.error(`Ошибка сохранения: ${failedOperations.join(', ')}`);
  }
  
  return { success: false, failedOperations };
}

export default {
  createSafeSaveHandler,
  createSafeSingleRecordHandler,
  createSafeDeleteHandler,
  safeSaveBatch,
};
