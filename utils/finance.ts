import { Order, Transaction, Expense } from '../types';

// Helper to safely parse numbers
const num = (v: any): number => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(',', '.').replace(/[^\d.-]/g, ''));
    return isFinite(p) ? p : 0;
  }
  return 0;
};

// Helper to get a safe exchange rate
const getSafeRate = (rate: any, defaultRate: number) => {
  const r = num(rate);
  const safeDefault = defaultRate > 100 ? defaultRate : 12800;
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
 * Validates and auto-corrects USD amounts that might be mistakenly entered in UZS.
 * 
 * Rules:
 * 1. Suspicion threshold: $1,000,000 (logs warning).
 * 2. Auto-correction threshold: $500,000.
 * 3. If > $500,000, tries to convert from UZS using rate.
 * 4. If converted amount is reasonable (<= $500,000), returns converted amount.
 * 5. Otherwise returns original amount (but logs warning).
 */
export const validateUSD = (
  amount: number, 
  currentRate: number,
  context?: { id: string, type: 'order' | 'transaction' | 'expense' },
  onCorrection?: (details: CorrectionDetails) => void
): number => {
  const safeAmount = num(amount);
  const rate = getSafeRate(currentRate, 12800);

  // Thresholds
  const SUSPICION_THRESHOLD = 1000000;
  const CORRECTION_THRESHOLD = 500000;
  const MAX_REASONABLE_AFTER_CORRECTION = 500000;

  if (safeAmount > CORRECTION_THRESHOLD) {
    const possibleUSD = safeAmount / rate;
    
    // Check if it looks like a UZS entry
    if (possibleUSD <= MAX_REASONABLE_AFTER_CORRECTION) {
      console.warn(`[Finance] Auto-correction: ${safeAmount} -> ${possibleUSD.toFixed(2)} USD (assumed UZS entry)`);
      
      if (context && onCorrection) {
        onCorrection({
          id: context.id,
          type: context.type,
          originalAmount: safeAmount,
          correctedAmount: possibleUSD,
          reason: 'Auto-corrected UZS entry in USD field'
        });
      }
      
      return possibleUSD;
    }
  }

  if (safeAmount > SUSPICION_THRESHOLD) {
    console.warn(`[Finance] Suspiciously large USD amount: ${safeAmount}`);
  }

  return safeAmount;
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

  const rate = getSafeRate(defaultRate, 12800);

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
    
    // Extract Order ID: prefer relatedId, fallback to description regex
    const orderIdMatch = t.description?.match(/ORD-\d+/);
    const relatedOrderId = t.relatedId || (orderIdMatch ? orderIdMatch[0] : null);
    const relatedOrder = relatedOrderId ? orders.find(o => o.id === relatedOrderId) : null;
    
    // Only count client_payments if they are for mixed orders or debt repayment (not standard cash/bank orders already counted)
    // Standard orders are counted above. Mixed orders have payments in transactions.
    const isMixedPayment = relatedOrder?.paymentMethod === 'mixed';
    const isDebtPayment = t.type === 'client_payment' && !relatedOrder; // No linked order = standalone debt repayment

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

  // 3. Process Expenses
  expenses.forEach(e => {
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
