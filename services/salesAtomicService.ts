import { functions, httpsCallable } from '../lib/firebase';
import { Client, Order, Transaction } from '../types';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface AtomicSaleCommitPayload {
  order: Order;
  client: Client;
  clientPurchaseDeltaUSD: number;
  transactions: Transaction[];
  workflowOrderId?: string;
  workflowConvertedAt?: string;
  linkedBankTransferId?: string;
}

/** Input sent to the commitSale Cloud Function */
interface CommitSaleCloudInput {
  items: Array<{ productId: string; quantity: number }>;
  clientId: string;
  customerName: string;
  paymentMethod: string;
  paymentCurrency?: string;
  amountPaid?: number;
  workflowOrderId?: string;
  sellerId?: string;
  sellerName?: string;
  requestId: string; // Idempotency key (UUID v4) — prevents duplicate sales
  linkedBankTransferId?: string;
}

/** Response from the commitSale Cloud Function */
interface CommitSaleCloudResult {
  success: boolean;
  orderId: string;
  totalAmount: number;
  totalAmountUZS: number;
}

export const salesAtomicService = {
  /**
   * Commit a sale via the server-side Cloud Function.
   * The CF reads prices server-side, computes totals, writes atomically,
   * and generates ledger entries — all inside a single Firestore transaction.
   *
   * No client-side fallback: if the CF is unreachable, the error propagates
   * to the caller (offline sales are not supported for data integrity).
   */
  async commitSale(payload: AtomicSaleCommitPayload): Promise<void> {
    assertAuth();
    await this._commitSaleCloud(payload);
    logger.info('SalesAtomicService', 'Sale committed via Cloud Function');
  },

  /**
   * Call the server-side commitSale Cloud Function.
   * The server reads prices, computes totals, writes atomically.
   */
  async _commitSaleCloud(payload: AtomicSaleCommitPayload): Promise<CommitSaleCloudResult> {
    const input: CommitSaleCloudInput = {
      items: payload.order.items.map(item => ({
        productId: item.productId,
        quantity: toFiniteNumber(item.quantity),
      })),
      clientId: payload.order.clientId || payload.client.id,
      customerName: payload.order.customerName,
      paymentMethod: payload.order.paymentMethod,
      paymentCurrency: payload.order.paymentCurrency,
      amountPaid: toFiniteNumber(payload.order.amountPaid),
      workflowOrderId: payload.workflowOrderId,
      sellerId: payload.order.sellerId,
      sellerName: payload.order.sellerName,
      requestId: crypto.randomUUID(),
      linkedBankTransferId: payload.linkedBankTransferId,
    };

    const callable = httpsCallable<CommitSaleCloudInput, CommitSaleCloudResult>(
      functions,
      'commitSale',
    );

    const result = await callable(input);
    return result.data;
  },
};
