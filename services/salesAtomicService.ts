import { db, doc, runTransaction, Timestamp, functions, httpsCallable } from '../lib/firebase';
import { Client, Order, Transaction } from '../types';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';
import { generateSaleEntries } from '../utils/ledgerEntryGenerators';
import { ledgerService } from './ledgerService';

const PRODUCTS_COLLECTION = 'products';
const CLIENTS_COLLECTION = 'clients';
const ORDERS_COLLECTION = 'orders';
const TRANSACTIONS_COLLECTION = 'transactions';
const WORKFLOW_ORDERS_COLLECTION = 'workflowOrders';

export interface AtomicSaleCommitPayload {
  order: Order;
  client: Client;
  clientPurchaseDeltaUSD: number;
  transactions: Transaction[];
  workflowOrderId?: string;
  workflowConvertedAt?: string;
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
}

/** Response from the commitSale Cloud Function */
interface CommitSaleCloudResult {
  success: boolean;
  orderId: string;
  totalAmount: number;
  totalAmountUZS: number;
}

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitize = <T extends Record<string, unknown>>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

export const salesAtomicService = {
  /**
   * Try Cloud Function first; fall back to client-side transaction if CF
   * is unreachable (offline / emulator not running / CF not deployed yet).
   */
  async commitSale(payload: AtomicSaleCommitPayload): Promise<void> {
    assertAuth();

    try {
      await this._commitSaleCloud(payload);
      logger.info('SalesAtomicService', 'Sale committed via Cloud Function');
      return;
    } catch (cfError) {
      // If Cloud Function unavailable → fall back to client-side
      const code = (cfError as { code?: string }).code;
      const isNetworkError = code === 'unavailable' || code === 'internal'
        || code === 'deadline-exceeded' || code === 'not-found'
        || (cfError instanceof TypeError); // fetch failure

      if (isNetworkError) {
        logger.warn('SalesAtomicService', 'Cloud Function unavailable, falling back to client-side:', cfError);
      } else {
        // Validation / business logic error from CF → propagate
        throw cfError;
      }
    }

    // ── Fallback: client-side transaction (deprecated) ────
    await this._commitSaleLocal(payload);
    logger.info('SalesAtomicService', 'Sale committed via client-side fallback');
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
    };

    const callable = httpsCallable<CommitSaleCloudInput, CommitSaleCloudResult>(
      functions,
      'commitSale',
    );

    const result = await callable(input);
    return result.data;
  },

  /**
   * Client-side Firestore transaction (DEPRECATED — kept as offline fallback).
   * @deprecated Use Cloud Function via commitSale() instead.
   */
  async _commitSaleLocal(payload: AtomicSaleCommitPayload): Promise<void> {
    assertAuth();
    const clientId = payload.order.clientId || payload.client.id;

    if (!payload.order.id) {
      throw new Error('Atomic sale commit requires order id');
    }

    if (!clientId) {
      throw new Error('Atomic sale commit requires client id');
    }

    const purchaseDelta = toFiniteNumber(payload.clientPurchaseDeltaUSD);
    const soldQtyByProduct = new Map<string, number>();

    payload.order.items.forEach(item => {
      const qty = toFiniteNumber(item.quantity);
      if (!item.productId || qty <= 0) return;
      soldQtyByProduct.set(item.productId, (soldQtyByProduct.get(item.productId) || 0) + qty);
    });

    const debtDeltaUSD = payload.transactions.reduce((sum, tx) => {
      if (tx.type !== 'debt_obligation' || tx.currency !== 'USD') return sum;
      if (tx.relatedId && tx.relatedId !== clientId) return sum;
      return sum + toFiniteNumber(tx.amount);
    }, 0);

    const nowIso = new Date().toISOString();

    try {
      await runTransaction(db, async firebaseTx => {
        const soldProducts = Array.from(soldQtyByProduct.entries()).filter(([, qty]) => qty > 0);
        const productReads = soldProducts.map(([productId]) => ({
          productId,
          ref: doc(db, PRODUCTS_COLLECTION, productId)
        }));
        const productDocs = await Promise.all(productReads.map(item => firebaseTx.get(item.ref)));

        const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
        const clientDoc = await firebaseTx.get(clientRef);

        const orderRef = doc(db, ORDERS_COLLECTION, payload.order.id);
        const orderDoc = await firebaseTx.get(orderRef);

        const transactionReads = payload.transactions.map(tx => {
          if (!tx.id) {
            throw new Error('Transaction id is required for atomic sale commit');
          }
          return {
            tx,
            ref: doc(db, TRANSACTIONS_COLLECTION, tx.id)
          };
        });
        const transactionDocs = await Promise.all(transactionReads.map(item => firebaseTx.get(item.ref)));

        let workflowRef: ReturnType<typeof doc> | null = null;
        let workflowDoc: Awaited<ReturnType<typeof firebaseTx.get>> | null = null;

        if (payload.workflowOrderId) {
          workflowRef = doc(db, WORKFLOW_ORDERS_COLLECTION, payload.workflowOrderId);
          workflowDoc = await firebaseTx.get(workflowRef);
        }

        if (orderDoc.exists()) {
          throw new Error(`Order ${payload.order.id} already exists`);
        }

        productDocs.forEach((productDoc, index) => {
          const [productId, soldQty] = soldProducts[index];
          if (!productDoc.exists()) {
            throw new Error(`Product ${productId} not found`);
          }

          const currentQty = toFiniteNumber(productDoc.data()?.quantity);
          if (currentQty < soldQty) {
            throw new Error(`Insufficient stock for product ${productId}`);
          }
        });

        transactionDocs.forEach((txDoc, index) => {
          if (txDoc.exists()) {
            throw new Error(`Transaction ${transactionReads[index].tx.id} already exists`);
          }
        });

        if (payload.workflowOrderId && (!workflowDoc || !workflowDoc.exists())) {
          throw new Error(`Workflow order ${payload.workflowOrderId} not found`);
        }

        soldProducts.forEach(([_, soldQty], index) => {
          const productRef = productReads[index].ref;
          const productData = productDocs[index].data() || {};
          const currentQty = toFiniteNumber(productData.quantity);
          const currentVersion = toFiniteNumber(productData._version);

          firebaseTx.update(productRef, {
            quantity: currentQty - soldQty,
            updatedAt: nowIso,
            _version: currentVersion + 1
          });
        });

        if (clientDoc.exists()) {
          const clientData = clientDoc.data() || {};
          const currentPurchases = toFiniteNumber(clientData.totalPurchases);
          const currentDebt = toFiniteNumber(clientData.totalDebt);
          const currentVersion = toFiniteNumber(clientData._version);

          firebaseTx.update(clientRef, {
            totalPurchases: currentPurchases + purchaseDelta,
            totalDebt: currentDebt + debtDeltaUSD,
            updatedAt: Timestamp.now(),
            _version: currentVersion + 1
          });
        } else {
          const clientData = sanitize(payload.client as unknown as Record<string, unknown>);
          delete clientData.id;

          firebaseTx.set(clientRef, {
            ...clientData,
            totalPurchases: toFiniteNumber(payload.client.totalPurchases) + purchaseDelta,
            totalDebt: toFiniteNumber(payload.client.totalDebt) + debtDeltaUSD,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            _version: 1
          });
        }

        firebaseTx.set(orderRef, {
          ...sanitize(payload.order as unknown as Record<string, unknown>),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          _version: 1
        });

        transactionReads.forEach(({ tx, ref }) => {
          const txData = sanitize(tx as unknown as Record<string, unknown>);
          delete txData.id;

          firebaseTx.set(ref, {
            ...txData,
            createdAt: Timestamp.now(),
            updatedAt: nowIso,
            _version: 1
          });
        });

        if (workflowRef && workflowDoc) {
          const workflowData = workflowDoc.data() as Record<string, unknown> | undefined;
          const workflowVersion = toFiniteNumber(workflowData?._version);
          firebaseTx.update(workflowRef, {
            status: 'completed',
            convertedToOrderId: payload.order.id,
            convertedAt: payload.workflowConvertedAt || nowIso,
            updatedAt: Timestamp.now(),
            _version: workflowVersion + 1
          });
        }
      });

      // ── Generate General Ledger entries (fire-and-forget) ──────
      // Runs after the atomic sale succeeds. If ledger write fails,
      // it does NOT roll back the sale — it's supplementary bookkeeping.
      try {
        const totalCOGS = payload.order.items.reduce((sum, item) => {
          return sum + toFiniteNumber(item.costAtSale) * toFiniteNumber(item.quantity);
        }, 0);
        const vatAmount = toFiniteNumber(payload.order.vatAmount);

        const ledgerEntries = generateSaleEntries({
          order: payload.order,
          totalCOGS,
          vatAmount,
          transactions: payload.transactions,
        });

        if (ledgerEntries.length > 0) {
          ledgerService.addEntries(ledgerEntries).catch(err => {
            logger.error('SalesAtomicService', 'Ledger entry creation failed (non-fatal):', err);
          });
        }
      } catch (ledgerErr) {
        logger.error('SalesAtomicService', 'Ledger entry generation failed (non-fatal):', ledgerErr);
      }
    } catch (error) {
      logger.error('SalesAtomicService', 'Atomic sale commit failed:', error);
      throw error;
    }
  }
};
