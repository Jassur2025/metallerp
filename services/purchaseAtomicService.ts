/**
 * Purchase Atomic Service — routes purchase creation through the
 * commitPurchase Cloud Function (server-side validation, weighted-avg cost,
 * atomic ledger, idempotency, rate limiting, App Check).
 *
 * Replaces client-side purchaseService.add() and manual product/transaction
 * updates in Procurement.tsx.
 */

import { functions, httpsCallable } from '../lib/firebase';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';

// ─── Types (mirror commitPurchase CF input/output) ──────────

interface PurchaseItemInput {
  productId: string;
  quantity: number;
  invoicePrice: number; // UZS per unit WITH VAT
  vatAmount: number;    // UZS VAT per unit
}

interface PurchaseOverheads {
  logistics: number;
  customsDuty: number;
  importVat: number;
  other: number;
}

interface CommitPurchaseInput {
  items: PurchaseItemInput[];
  supplierName: string;
  supplierId?: string;
  overheads: PurchaseOverheads;
  paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
  paymentCurrency?: 'USD' | 'UZS';
  amountPaid?: number; // UZS
  warehouse?: 'main' | 'cloud';
  requestId: string;
}

interface CommitPurchaseResult {
  success: boolean;
  purchaseId: string;
  totalLandedAmount: number;
}

interface DeletePurchaseInput {
  purchaseId: string;
}

interface DeletePurchaseResult {
  success: boolean;
  purchaseId: string;
  contraEntries: number;
}

// ─── Public payload (used by Procurement.tsx) ───────────────

export interface AtomicPurchasePayload {
  items: PurchaseItemInput[];
  supplierName: string;
  supplierId?: string; // Optional — CF auto-resolves by name if not provided
  overheads: PurchaseOverheads;
  paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
  paymentCurrency?: 'USD' | 'UZS';
  amountPaid?: number; // UZS
  warehouse?: 'main' | 'cloud';
}

// ─── Service ────────────────────────────────────────────────

export const purchaseAtomicService = {
  /**
   * Commit a purchase via the commitPurchase Cloud Function.
   *
   * The CF atomically:
   *  - reads product data server-side
   *  - computes weighted-average costs and landed costs
   *  - updates product quantities and costPrice
   *  - creates the purchase document
   *  - creates supplier payment transaction (if paid)
   *  - writes ledger entries (inventory, VAT, supplier payment)
   *
   * No client-side fallback: errors propagate to the caller.
   */
  async commitPurchase(payload: AtomicPurchasePayload): Promise<CommitPurchaseResult> {
    assertAuth();

    const input: CommitPurchaseInput = {
      items: payload.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        invoicePrice: item.invoicePrice,
        vatAmount: item.vatAmount,
      })),
      supplierName: payload.supplierName,
      supplierId: payload.supplierId,
      overheads: payload.overheads,
      paymentMethod: payload.paymentMethod,
      paymentCurrency: payload.paymentCurrency,
      amountPaid: payload.amountPaid,
      warehouse: payload.warehouse,
      requestId: crypto.randomUUID(),
    };

    const callable = httpsCallable<CommitPurchaseInput, CommitPurchaseResult>(
      functions,
      'commitPurchase',
    );

    const result = await callable(input);
    logger.info(
      'PurchaseAtomicService',
      `Purchase committed via CF: ${result.data.purchaseId} ($${result.data.totalLandedAmount})`,
    );
    return result.data;
  },

  /**
   * Delete a purchase via the deletePurchase Cloud Function.
   *
   * The CF atomically:
   *  - reverses product quantities (removes what was added)
   *  - creates СТОРНО contra-entries for all ledger entries
   *  - soft-deletes the purchase document
   *  - writes a journal event for audit trail
   */
  async deletePurchase(purchaseId: string): Promise<DeletePurchaseResult> {
    assertAuth();

    const callable = httpsCallable<DeletePurchaseInput, DeletePurchaseResult>(
      functions,
      'deletePurchase',
    );

    const result = await callable({ purchaseId });
    logger.info(
      'PurchaseAtomicService',
      `Purchase deleted via CF: ${purchaseId} (${result.data.contraEntries} contra-entries)`,
    );
    return result.data;
  },
};
