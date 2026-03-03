/**
 * Order Atomic Service — routes order deletion through the
 * deleteOrder Cloud Function (server-side validation, atomic inventory
 * reversal, debt reversal, ledger СТОРНО, audit trail).
 *
 * Replaces client-side orderService.delete() with its client-side
 * runTransaction that was vulnerable to DevTools manipulation.
 */

import { functions, httpsCallable } from '../lib/firebase';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';

// ─── Types (mirror deleteOrder CF input/output) ─────────────

interface DeleteOrderInput {
  orderId: string;
}

interface DeleteOrderResult {
  success: boolean;
  orderId: string;
  contraEntries: number;
}

// ─── Service ────────────────────────────────────────────────

export const orderAtomicService = {
  /**
   * Delete an order via the deleteOrder Cloud Function.
   *
   * The CF atomically:
   *  - restores product quantities (for completed orders)
   *  - reverses client debt and totalPurchases (for completed orders)
   *  - creates СТОРНО contra-entries for all ledger entries
   *  - soft-deletes the order document
   *  - writes a journal event for audit trail
   */
  async deleteOrder(orderId: string): Promise<DeleteOrderResult> {
    assertAuth();

    const callable = httpsCallable<DeleteOrderInput, DeleteOrderResult>(
      functions,
      'deleteOrder',
    );

    const result = await callable({ orderId });
    logger.info(
      'OrderAtomicService',
      `Order deleted via CF: ${orderId} (${result.data.contraEntries} contra-entries)`,
    );
    return result.data;
  },
};
