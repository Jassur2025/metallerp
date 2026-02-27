import { Order, Transaction, Expense } from '../types';
import { DEFAULT_EXCHANGE_RATE } from '../constants';

// Helper to safely parse numbers
export const num = (v: unknown): number => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(',', '.').replace(/[^\d.-]/g, ''));
    return isFinite(p) ? p : 0;
  }
  return 0;
};

// Helper to get a safe exchange rate
export const getSafeRate = (rate: unknown, defaultRate: number) => {
  const r = num(rate);
  const safeDefault = defaultRate > 100 ? defaultRate : DEFAULT_EXCHANGE_RATE;
  return r > 100 ? r : safeDefault;
};

export interface CorrectionDetails {
  id: string;
  type: 'order' | 'transaction' | 'expense';
  originalAmount: number;
  correctedAmount: number;
  reason: string;
}

/**
 * Validates USD amounts (sanitizes input).
 * 
 * Previously auto-corrected amounts > 500,000 by dividing by exchange rate,
 * assuming they were entered in UZS. This was removed because:
 * - It silently corrupted legitimate large USD amounts
 * - Exchange rate should always come from Settings, not be used for guessing
 * - Data should be entered correctly at the source
 * 
 * Now simply returns the sanitized numeric value.
 */
export const validateUSD = (
  amount: number, 
  _currentRate: number,
  _context?: { id: string, type: 'order' | 'transaction' | 'expense' },
  _onCorrection?: (details: CorrectionDetails) => void
): number => {
  return num(amount);
};

export interface FinancialTotals {
  cashUSD: number;
  cashUZS: number;
  bankUZS: number;
  cardUZS: number;
  corrections: CorrectionDetails[];
}

/**
 * Centralized logic for calculating base financial totals (Cash, Bank, Card balances).
 * Aggregates Orders, Transactions, and Expenses.
 */
export const calculateBaseTotals = (
  orders: Order[],
  transactions: Transaction[],
  expenses: Expense[],
  defaultRate: number
): FinancialTotals => {
  let cashUSD = 0;
  let cashUZS = 0;
  let bankUZS = 0;
  let cardUZS = 0;
  const corrections: CorrectionDetails[] = [];

  const rate = getSafeRate(defaultRate, DEFAULT_EXCHANGE_RATE);

  const handleCorrection = (details: CorrectionDetails) => {
    corrections.push(details);
  };

  // 1. Process Orders (Revenue)
  orders.forEach(o => {
    if (o.paymentMethod === 'cash') {
      if (o.paymentCurrency === 'UZS') {
        cashUZS += num(o.totalAmountUZS);
      } else {
        const paid = num(o.amountPaid);
        const total = num(o.totalAmount);
        const rawAmount = paid > 0 ? paid : total;
        // Apply validation to USD revenue
        cashUSD += validateUSD(rawAmount, rate, { id: o.id, type: 'order' }, handleCorrection);
      }
    } else if (o.paymentMethod === 'bank') {
      bankUZS += num(o.totalAmountUZS);
    } else if (o.paymentMethod === 'card') {
      cardUZS += num(o.totalAmountUZS);
    }
  });

  // 2. Process Transactions
  transactions.forEach(t => {
    const amt = num(t.amount);
    const isUSD = t.currency === 'USD';
    const tRate = getSafeRate(t.exchangeRate, rate);
    
    // Resolve Order ID using explicit link first, then legacy fallbacks
    const orderIdFromRelated = t.relatedId?.startsWith('ORD-') ? t.relatedId : null;
    const orderIdMatch = t.description?.match(/ORD-[A-Z0-9-]+/i);
    const relatedOrderId = t.orderId || orderIdFromRelated || (orderIdMatch ? orderIdMatch[0] : null);
    const relatedOrder = relatedOrderId ? orders.find(o => o.id === relatedOrderId) : null;
    const hasOrderReference = Boolean(relatedOrderId);
    
    // Only count client_payments if they are for mixed orders or debt repayment (not standard cash/bank orders already counted)
    // Standard orders are counted above. Mixed orders have payments in transactions.
    const isMixedPayment = relatedOrder?.paymentMethod === 'mixed';
    const isDebtPayment = t.type === 'client_payment' && !hasOrderReference;

    if (t.type === 'client_payment') {
      if (isMixedPayment || isDebtPayment) {
        if (t.method === 'cash') {
          if (isUSD) cashUSD += validateUSD(amt, tRate, { id: t.id, type: 'transaction' }, handleCorrection); else cashUZS += amt;
        } else if (t.method === 'bank') {
          bankUZS += (isUSD ? amt * tRate : amt);
        } else if (t.method === 'card') {
          cardUZS += (isUSD ? amt * tRate : amt);
        }
      }
    } else if (t.type === 'supplier_payment') {
      // Outgoing payments
      if (t.method === 'cash') {
        if (isUSD) cashUSD -= validateUSD(amt, tRate, { id: t.id, type: 'transaction' }, handleCorrection); else cashUZS -= amt;
      } else if (t.method === 'bank') {
        bankUZS -= (isUSD ? amt * tRate : amt);
      } else if (t.method === 'card') {
        cardUZS -= (isUSD ? amt * tRate : amt);
      }
    } else if (t.type === 'client_return' || t.type === 'client_refund') {
      // Returns/Refunds
      if (t.method === 'cash') {
        if (isUSD) cashUSD -= validateUSD(amt, tRate, { id: t.id, type: 'transaction' }, handleCorrection); else cashUZS -= amt;
      } else if (t.method === 'bank') {
        bankUZS -= (isUSD ? amt * tRate : amt);
      } else if (t.method === 'card') {
        cardUZS -= (isUSD ? amt * tRate : amt);
      }
    } else if (t.type === 'expense') {
      // Deduct fixed asset payments and other expenses from balances
      if (t.method === 'cash') {
        if (isUSD) cashUSD -= validateUSD(amt, tRate, { id: t.id, type: 'transaction' }, handleCorrection); else cashUZS -= amt;
      } else if (t.method === 'bank') {
        bankUZS -= (isUSD ? amt * tRate : amt);
      } else if (t.method === 'card') {
        cardUZS -= (isUSD ? amt * tRate : amt);
      }
    }
  });

  // 3. Process Expenses (only those NOT already in transactions)
  // Since expenses are now stored as transactions (type: 'expense'),
  // we skip expenses whose IDs already exist in the transactions array
  // to avoid double-counting.
  const transactionIds = new Set(transactions.map(t => t.id));
  expenses.forEach(e => {
    if (transactionIds.has(e.id)) return; // Already counted in transactions above

    const amt = num(e.amount);
    const isUSD = e.currency === 'USD';
    const eRate = getSafeRate(e.exchangeRate, rate);

    if (e.paymentMethod === 'cash') {
      if (isUSD) cashUSD -= validateUSD(amt, eRate, { id: e.id, type: 'expense' }, handleCorrection); else cashUZS -= amt;
    } else if (e.paymentMethod === 'bank') {
      bankUZS -= (isUSD ? amt * eRate : amt);
    } else if (e.paymentMethod === 'card') {
      cardUZS -= (isUSD ? amt * eRate : amt);
    }
  });

  return { cashUSD, cashUZS, bankUZS, cardUZS, corrections };
};

export const formatCurrency = (amount: number, currency: 'USD' | 'UZS' = 'USD'): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};
