/**
 * Order Atomic Service — routes order deletion through the
 * deleteOrder Cloud Function (server-side validation, atomic inventory
 * reversal, debt reversal, ledger СТОРНО, audit trail).
 *
 * Replaces client-side orderService.delete() with its client-side
 * runTransaction that was vulnerable to DevTools manipulation.
 */

import { functions, httpsCallable } from '../lib/firebase';
import { Order } from '../types';
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

interface UpdateOrderInput {
  orderId: string;
  updates: Partial<Omit<Order, 'id'>>;
}

interface UpdateOrderResult {
  success: boolean;
  orderId: string;
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

  /**
   * Update an order via the updateOrder Cloud Function.
   *
   * The CF atomically:
   *  - adjusts client debt and totalPurchases (for completed orders)
   *  - creates СТОРНО contra-entries for old ledger entries
   *  - creates new ledger entries from merged order data
   *  - updates the order document
   *  - writes a journal event for audit trail
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    assertAuth();

    const callable = httpsCallable<UpdateOrderInput, UpdateOrderResult>(
      functions,
      'updateOrder',
    );

    await callable({ orderId, updates });
    logger.info('OrderAtomicService', `Order updated via CF: ${orderId}`);
  },
};
