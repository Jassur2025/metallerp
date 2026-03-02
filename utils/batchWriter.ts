import { WriteBatch, doc, collection, writeBatch, DocumentReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from './logger';

/**
 * Configuration for safe batch operations
 */
interface BatchConfig {
    batchSize?: number; // Default: 450 (SAFE limit under 500)
    throttleMs?: number; // Default: 200ms sleep between batches
    collectionName: string; // For logging
}

interface BatchStats {
    totalProcessed: number;
    batchesCommitted: number;
    errors: unknown[];
}

/**
 * SAFE BATCH WRITER
 * 
 * Utility to perform mass database updates safely.
 * - Automatically splits data into chunks (batches).
 * - Pauses between batches to strictly avoid "Write Limit Exceeded".
 * - Provides progress logging.
 * 
 * @example
 * await executeSafeBatch(products, { collectionName: 'products' }, (product, batch) => {
 *     const ref = doc(db, 'products', product.id);
 *     batch.set(ref, product);
 * });
 */
export async function executeSafeBatch<T>(
    items: T[],
    config: BatchConfig,
    operation: (item: T, batch: WriteBatch) => void
): Promise<BatchStats> {
    const BATCH_SIZE = config.batchSize || 450;
    const THROTTLE_MS = config.throttleMs || 200;
    const stats: BatchStats = {
        totalProcessed: 0,
        batchesCommitted: 0,
        errors: []
    };

    logger.debug('BatchWriter', `Starting Safe Batch Operation on [${config.collectionName}]`);
    logger.debug('BatchWriter', `Total Items: ${items.length} | Chunk Size: ${BATCH_SIZE}`);

    // Helper for sleep
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Execute user-defined operation (add to batch)
            try {
                operation(item, currentBatch);
                operationCount++;
                stats.totalProcessed++;
            } catch (err) {
                logger.error('BatchWriter', `Error processing item index ${i}:`, err);
                stats.errors.push({ index: i, error: err });
                continue; // Skip this item but keep going
            }

            // If batch is full, commit and reset
            if (operationCount >= BATCH_SIZE) {
                await currentBatch.commit();
                stats.batchesCommitted++;
                logger.debug('BatchWriter', `Committed batch ${stats.batchesCommitted} (${operationCount} ops)`);

                // Reset
                currentBatch = writeBatch(db);
                operationCount = 0;

                // Throttle
                if (i < items.length - 1) {
                    await sleep(THROTTLE_MS);
                }
            }
        }

        // Commit remaining items
        if (operationCount > 0) {
            await currentBatch.commit();
            stats.batchesCommitted++;
            logger.debug('BatchWriter', `Committed final batch ${stats.batchesCommitted} (${operationCount} ops)`);
        }

        logger.debug('BatchWriter', `Batch Operation Complete! Processed: ${stats.totalProcessed}`);

    } catch (globalError) {
        logger.error('BatchWriter', 'Critical Batch Error:', globalError);
        throw globalError;
    }

    return stats;
}

/**
 * Helper to generate a deterministic ID for idempotency.
 * Useful for migration scripts to avoid duplicates on re-run.
 */
export function generateDeterministicId(sourceString: string): string {
    // Simple hash function for client-side usage (or use a library if available)
    let hash = 0;
    for (let i = 0; i < sourceString.length; i++) {
        const char = sourceString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `id_${Math.abs(hash).toString(16)}`;
}
