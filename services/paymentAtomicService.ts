/**
 * Payment Atomic Service — routes ALL payment/transaction operations through
 * the processPayment Cloud Function (server-side validation, atomic ledger,
 * idempotency, rate limiting, App Check).
 *
 * Replaces client-side transactionService.add/createPayment/addDebt.
 */

import { functions, httpsCallable } from '../lib/firebase';
import { Transaction } from '../types';
import { logger } from '../utils/logger';
import { assertAuth } from '../utils/authGuard';

// ─── Types (mirror processPayment CF input/output) ──────────

type TxType =
  | 'client_payment'
  | 'supplier_payment'
  | 'client_return'
  | 'debt_obligation'
  | 'client_refund'
  | 'expense';

interface ProcessPaymentInput {
  type: TxType;
  amount: number;
  currency: 'USD' | 'UZS';
  method: 'cash' | 'bank' | 'card' | 'debt';
  relatedId?: string;
  orderId?: string;
  supplierId?: string;
  description?: string;
  exchangeRate?: number;
  requestId: string;
}

interface ProcessPaymentResult {
  success: boolean;
  txId: string;
  amountUSD: number;
  type: string;
}

interface DeleteTransactionInput {
  txId: string;
}

interface DeleteTransactionResult {
  success: boolean;
  txId: string;
}

// ─── Service ────────────────────────────────────────────────

export const paymentAtomicService = {
  /**
   * Create a payment/transaction via the processPayment Cloud Function.
   * Handles: client_payment, supplier_payment, debt_obligation,
   * client_return, client_refund, expense.
   *
   * The CF atomically: creates transaction doc, updates client/supplier
   * debt, writes ledger entries — all inside a single Firestore transaction.
   */
  async processPayment(transaction: Omit<Transaction, 'id'>): Promise<{ txId: string; amountUSD: number }> {
    assertAuth();

    const txType = transaction.type as TxType;

    const input: ProcessPaymentInput = {
      type: txType,
      amount: transaction.amount,
      currency: (transaction.currency as 'USD' | 'UZS') || 'USD',
      method: (transaction.method as 'cash' | 'bank' | 'card' | 'debt') || 'cash',
      relatedId: transaction.relatedId,
      orderId: transaction.orderId,
      supplierId: transaction.supplierId,
      description: transaction.description,
      exchangeRate: transaction.exchangeRate,
      requestId: crypto.randomUUID(),
    };

    const callable = httpsCallable<ProcessPaymentInput, ProcessPaymentResult>(
      functions,
      'processPayment',
    );

    const result = await callable(input);
    logger.info('PaymentAtomicService', `Payment processed via CF: ${result.data.txId} (${txType})`);
    return { txId: result.data.txId, amountUSD: result.data.amountUSD };
  },

  /**
   * Delete a transaction via the deleteTransaction Cloud Function.
   * The CF atomically: reverses debt, creates contra-ledger entries (СТОРНО),
   * soft-deletes the transaction — all inside a single Firestore transaction.
   */
  async deleteTransaction(txId: string): Promise<void> {
    assertAuth();

    const callable = httpsCallable<DeleteTransactionInput, DeleteTransactionResult>(
      functions,
      'deleteTransaction',
    );

    await callable({ txId });
    logger.info('PaymentAtomicService', `Transaction deleted via CF: ${txId}`);
  },
};
