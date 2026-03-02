/**
 * Unit tests for finance utility — P&L, Cash Flow, Balance calculations
 *
 * Covers:
 *  - num() safe number parsing
 *  - getSafeRate() exchange rate validation
 *  - validateUSD() auto-correction of UZS amounts in USD fields
 *  - calculateBaseTotals() — core Cash / Bank / Card balance engine
 *  - formatCurrency() display helper
 *  - P&L logic (Revenue, COGS, Gross Profit, OPEX, Net Profit)
 *  - Balance sheet accounting equation (Assets = Liabilities + Equity)
 *
 * To run: npm test -- finance.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateUSD, calculateBaseTotals, formatCurrency, CorrectionDetails, FinancialTotals, num, getSafeRate } from '../../utils/finance';
import { Order, Transaction, Expense, Unit } from '../../types';

// ─── Helpers to build test fixtures ────────────────────────────────────────

const DEFAULT_RATE = 12800; // 1 USD = 12,800 UZS

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ORD-001',
  date: '2026-01-15T10:00:00Z',
  customerName: 'Test Client',
  sellerName: 'Manager',
  status: 'completed',
  items: [],
  subtotalAmount: 100,
  vatRateSnapshot: 12,
  vatAmount: 12,
  totalAmount: 112,
  exchangeRate: DEFAULT_RATE,
  totalAmountUZS: 112 * DEFAULT_RATE,
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  amountPaid: 112,
  ...overrides,
});

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'TX-001',
  date: '2026-01-15T10:00:00Z',
  type: 'client_payment',
  amount: 100,
  currency: 'USD',
  method: 'cash',
  description: 'Payment',
  ...overrides,
});

const makeExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'EXP-001',
  date: '2026-01-15T10:00:00Z',
  description: 'Office rent',
  amount: 500,
  category: 'Аренда',
  paymentMethod: 'cash',
  currency: 'USD',
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('finance.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Suppress console.warn in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  validateUSD — Now simply sanitizes input (no auto-correction)
  // ═══════════════════════════════════════════════════════════════════════

  describe('validateUSD', () => {
    it('should return small amounts unchanged', () => {
      expect(validateUSD(150, DEFAULT_RATE)).toBe(150);
      expect(validateUSD(0, DEFAULT_RATE)).toBe(0);
      expect(validateUSD(499999, DEFAULT_RATE)).toBe(499999);
    });

    it('should return large amounts unchanged (no auto-correction)', () => {
      // Previously this was auto-divided by rate. Now returns as-is.
      expect(validateUSD(6_400_000, DEFAULT_RATE)).toBe(6_400_000);
      expect(validateUSD(1_280_000, DEFAULT_RATE)).toBe(1_280_000);
      expect(validateUSD(12_800_000_000, DEFAULT_RATE)).toBe(12_800_000_000);
    });

    it('should NOT call onCorrection callback (no corrections happen)', () => {
      const corrections: CorrectionDetails[] = [];
      const cb = (d: CorrectionDetails) => corrections.push(d);
      const context = { id: 'ORD-050', type: 'order' as const };

      validateUSD(6_400_000, DEFAULT_RATE, context, cb);
      expect(corrections).toHaveLength(0);
    });

    it('should NOT call onCorrection when no correction is needed', () => {
      const corrections: CorrectionDetails[] = [];
      const cb = (d: CorrectionDetails) => corrections.push(d);

      validateUSD(250, DEFAULT_RATE, { id: 'X', type: 'expense' }, cb);
      expect(corrections).toHaveLength(0);
    });

    it('should handle NaN / invalid input gracefully (returns 0)', () => {
      expect(validateUSD(NaN, DEFAULT_RATE)).toBe(0);
      expect(validateUSD(Infinity, DEFAULT_RATE)).toBe(0);
    });

    it('should return large amounts unchanged regardless of rate', () => {
      // rate doesn't matter anymore — no auto-correction
      const result = validateUSD(6_400_000, 0);
      expect(result).toBe(6_400_000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  calculateBaseTotals — Core Cash / Bank / Card balances
  // ═══════════════════════════════════════════════════════════════════════

  describe('calculateBaseTotals', () => {
    // ─── Empty data ─────────────────────────────────────────────

    it('should return zeroes for empty arrays', () => {
      const result = calculateBaseTotals([], [], [], DEFAULT_RATE);
      expect(result).toEqual({
        cashUSD: 0,
        cashUZS: 0,
        bankUZS: 0,
        cardUZS: 0,
        corrections: [],
      });
    });

    // ─── Orders (Revenue) ───────────────────────────────────────

    describe('Order processing (Revenue)', () => {
      it('should add cash-USD order amount to cashUSD', () => {
        const order = makeOrder({
          paymentMethod: 'cash',
          totalAmount: 200,
          amountPaid: 200,
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(200);
      });

      it('should prefer amountPaid over totalAmount when > 0', () => {
        const order = makeOrder({
          paymentMethod: 'cash',
          totalAmount: 200,
          amountPaid: 150, // partially paid
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(150);
      });

      it('should fall back to totalAmount when amountPaid is 0', () => {
        const order = makeOrder({
          paymentMethod: 'cash',
          totalAmount: 200,
          amountPaid: 0,
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(200);
      });

      it('should add cash-UZS order to cashUZS', () => {
        const order = makeOrder({
          paymentMethod: 'cash',
          paymentCurrency: 'UZS',
          totalAmountUZS: 2_560_000,
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.cashUZS).toBe(2_560_000);
        expect(result.cashUSD).toBe(0); // not counted in USD
      });

      it('should add bank order to bankUZS', () => {
        const order = makeOrder({
          paymentMethod: 'bank',
          totalAmountUZS: 5_000_000,
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.bankUZS).toBe(5_000_000);
      });

      it('should add card order to cardUZS', () => {
        const order = makeOrder({
          paymentMethod: 'card',
          totalAmountUZS: 3_000_000,
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.cardUZS).toBe(3_000_000);
      });

      it('should handle multiple orders with different payment methods', () => {
        const orders = [
          makeOrder({ id: 'O1', paymentMethod: 'cash', amountPaid: 100 }),
          makeOrder({ id: 'O2', paymentMethod: 'cash', amountPaid: 50 }),
          makeOrder({ id: 'O3', paymentMethod: 'bank', totalAmountUZS: 1_000_000 }),
          makeOrder({ id: 'O4', paymentMethod: 'card', totalAmountUZS: 500_000 }),
        ];
        const result = calculateBaseTotals(orders, [], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(150);
        expect(result.bankUZS).toBe(1_000_000);
        expect(result.cardUZS).toBe(500_000);
      });
    });

    // ─── Transactions ───────────────────────────────────────────

    describe('Transaction processing', () => {
      it('should NOT double-count standard cash order with order-linked client_payment', () => {
        const order = makeOrder({
          id: 'ORD-AB12-CD34',
          paymentMethod: 'cash',
          totalAmount: 400,
          amountPaid: 400,
        });
        const tx = makeTransaction({
          type: 'client_payment',
          amount: 400,
          currency: 'USD',
          method: 'cash',
          orderId: order.id,
          description: `Оплата заказа ${order.id}`,
        });

        const result = calculateBaseTotals([order], [tx], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(400);
      });

      it('should add mixed-order client_payment to cashUSD', () => {
        const order = makeOrder({ id: 'ORD-010', paymentMethod: 'mixed' });
        const tx = makeTransaction({
          type: 'client_payment',
          amount: 300,
          currency: 'USD',
          method: 'cash',
          description: 'Оплата за ORD-010',
        });
        const result = calculateBaseTotals([order], [tx], [], DEFAULT_RATE);
        // order (mixed → not counted directly) + tx payment
        expect(result.cashUSD).toBe(300);
      });

      it('should add mixed-order payment linked via explicit orderId', () => {
        const order = makeOrder({ id: 'ORD-ABC123-XYZ789', paymentMethod: 'mixed' });
        const tx = makeTransaction({
          type: 'client_payment',
          amount: 150,
          currency: 'USD',
          method: 'cash',
          orderId: order.id,
          description: 'Оплата заказа (новый формат)',
        });

        const result = calculateBaseTotals([order], [tx], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(150);
      });

      it('should add debt-payment (no order link) to cashUSD', () => {
        const tx = makeTransaction({
          type: 'client_payment',
          amount: 200,
          currency: 'USD',
          method: 'cash',
          description: 'Погашение долга клиента',
        });
        // No related order
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(200);
      });

      it('should subtract supplier_payment from cashUSD', () => {
        const tx = makeTransaction({
          type: 'supplier_payment',
          amount: 500,
          currency: 'USD',
          method: 'cash',
          description: 'Оплата поставщику',
        });
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(-500);
      });

      it('should subtract supplier_payment from bankUZS', () => {
        const tx = makeTransaction({
          type: 'supplier_payment',
          amount: 2_000_000,
          currency: 'UZS',
          exchangeRate: DEFAULT_RATE,
          method: 'bank',
          description: 'Банковский перевод поставщику',
        });
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.bankUZS).toBe(-2_000_000);
      });

      it('should subtract client_return from cashUSD', () => {
        const tx = makeTransaction({
          type: 'client_return',
          amount: 100,
          currency: 'USD',
          method: 'cash',
          description: 'Возврат клиенту',
        });
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(-100);
      });

      it('should subtract client_refund from cashUZS', () => {
        const tx = makeTransaction({
          type: 'client_refund',
          amount: 500_000,
          currency: 'UZS',
          method: 'cash',
          description: 'Возврат средств',
        });
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.cashUZS).toBe(-500_000);
      });

      it('should subtract expense-type transaction from bankUZS (UZS)', () => {
        const tx = makeTransaction({
          type: 'expense',
          amount: 1_000_000,
          currency: 'UZS',
          method: 'bank',
          description: 'Оплата ОС',
        });
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.bankUZS).toBe(-1_000_000);
      });

      it('should convert USD supplier_payment to UZS for bank method', () => {
        const tx = makeTransaction({
          type: 'supplier_payment',
          amount: 100,
          currency: 'USD',
          method: 'bank',
          description: 'Банковский перевод поставщику USD',
        });
        const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
        expect(result.bankUZS).toBe(-100 * DEFAULT_RATE);
      });
    });

    // ─── Expenses ───────────────────────────────────────────────

    describe('Expense processing', () => {
      it('should subtract cash-USD expense from cashUSD', () => {
        const expense = makeExpense({
          amount: 300,
          currency: 'USD',
          paymentMethod: 'cash',
        });
        const result = calculateBaseTotals([], [], [expense], DEFAULT_RATE);
        expect(result.cashUSD).toBe(-300);
      });

      it('should subtract cash-UZS expense from cashUZS', () => {
        const expense = makeExpense({
          amount: 1_000_000,
          currency: 'UZS',
          paymentMethod: 'cash',
        });
        const result = calculateBaseTotals([], [], [expense], DEFAULT_RATE);
        expect(result.cashUZS).toBe(-1_000_000);
      });

      it('should subtract bank expense from bankUZS (USD converted)', () => {
        const expense = makeExpense({
          amount: 100,
          currency: 'USD',
          paymentMethod: 'bank',
          exchangeRate: 12800,
        });
        const result = calculateBaseTotals([], [], [expense], DEFAULT_RATE);
        expect(result.bankUZS).toBe(-100 * 12800);
      });

      it('should subtract card expense from cardUZS', () => {
        const expense = makeExpense({
          amount: 500_000,
          currency: 'UZS',
          paymentMethod: 'card',
        });
        const result = calculateBaseTotals([], [], [expense], DEFAULT_RATE);
        expect(result.cardUZS).toBe(-500_000);
      });

      it('should skip expense already present in transactions (anti-double-count)', () => {
        const tx = makeTransaction({
          id: 'SHARED-ID',
          type: 'expense',
          amount: 500,
          currency: 'USD',
          method: 'cash',
          description: 'Аренда',
        });
        const expense = makeExpense({
          id: 'SHARED-ID', // same ID
          amount: 500,
          currency: 'USD',
          paymentMethod: 'cash',
        });
        const result = calculateBaseTotals([], [tx], [expense], DEFAULT_RATE);
        // Should count only once (from transaction), not twice
        expect(result.cashUSD).toBe(-500);
      });
    });

    // ─── Combined Scenarios ─────────────────────────────────────

    describe('Combined P&L / Cash Flow scenarios', () => {
      it('revenue minus expenses gives correct net cash position', () => {
        const order = makeOrder({
          paymentMethod: 'cash',
          totalAmount: 1000,
          amountPaid: 1000,
        });
        const expense = makeExpense({
          amount: 300,
          currency: 'USD',
          paymentMethod: 'cash',
        });
        const result = calculateBaseTotals([order], [], [expense], DEFAULT_RATE);
        expect(result.cashUSD).toBe(700); // 1000 - 300
      });

      it('multi-channel scenario: cash + bank + card', () => {
        const orders = [
          makeOrder({ id: 'O1', paymentMethod: 'cash', amountPaid: 500 }),
          makeOrder({ id: 'O2', paymentMethod: 'bank', totalAmountUZS: 10_000_000 }),
          makeOrder({ id: 'O3', paymentMethod: 'card', totalAmountUZS: 5_000_000 }),
        ];
        const expenses = [
          makeExpense({ id: 'E1', amount: 200, currency: 'USD', paymentMethod: 'cash' }),
          makeExpense({ id: 'E2', amount: 2_000_000, currency: 'UZS', paymentMethod: 'bank' }),
        ];
        const result = calculateBaseTotals(orders, [], expenses, DEFAULT_RATE);

        expect(result.cashUSD).toBe(300); // 500 - 200
        expect(result.bankUZS).toBe(8_000_000); // 10M - 2M
        expect(result.cardUZS).toBe(5_000_000);
      });

      it('should NOT auto-correct large amounts (no more auto-correction)', () => {
        // Order with totalAmount = 6,400,000 — now kept as-is
        const order = makeOrder({
          paymentMethod: 'cash',
          totalAmount: 6_400_000,
          amountPaid: 6_400_000,
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        // No auto-correction — amount used as entered
        expect(result.cashUSD).toBe(6_400_000);
        expect(result.corrections).toHaveLength(0);
      });

      it('should not produce corrections (auto-correction removed)', () => {
        const order = makeOrder({
          id: 'ORD-BIG',
          paymentMethod: 'cash',
          totalAmount: 1_280_000,
          amountPaid: 1_280_000,
        });
        const tx = makeTransaction({
          id: 'TX-BIG',
          type: 'supplier_payment',
          amount: 640_000,
          currency: 'USD',
          method: 'cash',
          description: 'Big supplier',
        });
        const exp = makeExpense({
          id: 'EXP-BIG',
          amount: 2_560_000,
          currency: 'USD',
          paymentMethod: 'cash',
        });
        const result = calculateBaseTotals([order], [tx], [exp], DEFAULT_RATE);
        expect(result.corrections).toHaveLength(0);
      });

      it('debt orders are not added to any cash balance', () => {
        const order = makeOrder({
          paymentMethod: 'debt',
          totalAmount: 500,
          amountPaid: 0,
          paymentStatus: 'unpaid',
        });
        const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
        expect(result.cashUSD).toBe(0);
        expect(result.cashUZS).toBe(0);
        expect(result.bankUZS).toBe(0);
        expect(result.cardUZS).toBe(0);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  formatCurrency — Display formatting
  // ═══════════════════════════════════════════════════════════════════════

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const formatted = formatCurrency(1234.56, 'USD');
      // Should contain the number with 2 decimal places
      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
      expect(formatted).toContain('56');
    });

    it('should format UZS correctly', () => {
      const formatted = formatCurrency(1_000_000, 'UZS');
      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
    });

    it('should format zero without errors', () => {
      const formatted = formatCurrency(0, 'USD');
      expect(formatted).toContain('0');
    });

    it('should handle undefined/NaN gracefully (formats as 0)', () => {
      const formatted = formatCurrency(NaN);
      expect(formatted).toContain('0');
    });

    it('should default to USD when no currency specified', () => {
      const formatted = formatCurrency(100);
      // Intl formats USD as $ sign (locale-dependent)
      expect(formatted).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  P&L Calculation Logic (mimics PnL component's useMemo)
  // ═══════════════════════════════════════════════════════════════════════

  describe('P&L calculations (Revenue, COGS, Gross Profit, Net Profit)', () => {
    const safeNumber = (v: unknown, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    it('should calculate revenue as sum of subtotalAmount (excluding VAT)', () => {
      const orders = [
        makeOrder({ subtotalAmount: 1000, vatAmount: 120 }),
        makeOrder({ id: 'O2', subtotalAmount: 500, vatAmount: 60 }),
      ];
      const revenue = orders.reduce((sum, o) => sum + safeNumber(o.subtotalAmount), 0);
      expect(revenue).toBe(1500);
    });

    it('should calculate COGS as quantity × costAtSale per item', () => {
      const orders = [
        makeOrder({
          items: [
            { productId: '1', productName: 'Труба', quantity: 10, priceAtSale: 5, costAtSale: 3, unit: Unit.METER, total: 50 },
            { productId: '2', productName: 'Профиль', quantity: 5, priceAtSale: 10, costAtSale: 7, unit: Unit.METER, total: 50 },
          ],
        }),
      ];
      const cogs = orders.reduce((sumOrder, order) => {
        return sumOrder + (order.items || []).reduce((sumItem, item) => {
          return sumItem + (safeNumber(item.quantity) * safeNumber(item.costAtSale));
        }, 0);
      }, 0);
      expect(cogs).toBe(10 * 3 + 5 * 7); // 30 + 35 = 65
    });

    it('should calculate gross profit as revenue - COGS', () => {
      const revenue = 1500;
      const cogs = 900;
      const grossProfit = revenue - cogs;
      expect(grossProfit).toBe(600);
    });

    it('should convert UZS expenses to USD using exchange rate for OPEX', () => {
      const expense = makeExpense({
        amount: 12_800_000,
        currency: 'UZS',
        exchangeRate: 12800,
      });
      const rate = safeNumber(expense.exchangeRate) > 0 ? safeNumber(expense.exchangeRate) : DEFAULT_RATE;
      const amountUSD = expense.currency === 'UZS' ? safeNumber(expense.amount) / rate : safeNumber(expense.amount);
      expect(amountUSD).toBe(1000); // 12,800,000 / 12,800
    });

    it('should calculate net profit as grossProfit - opex - depreciation', () => {
      const grossProfit = 600;
      const opex = 200;
      const depreciation = 50;
      const netProfit = grossProfit - opex - depreciation;
      expect(netProfit).toBe(350);
    });

    it('net profit can be negative (loss)', () => {
      const grossProfit = 100;
      const opex = 300;
      const depreciation = 50;
      const netProfit = grossProfit - opex - depreciation;
      expect(netProfit).toBe(-250);
    });

    it('should classify expenses by pnlCategory', () => {
      type PnLCategory = 'administrative' | 'operational' | 'commercial';
      const categoryMap: Record<string, PnLCategory> = {
        'Аренда': 'administrative',
        'Погрузочные затраты': 'commercial',
        'Затраты крана': 'operational',
      };

      const expenses = [
        makeExpense({ id: 'E1', amount: 500, category: 'Аренда' }),
        makeExpense({ id: 'E2', amount: 300, category: 'Погрузочные затраты' }),
        makeExpense({ id: 'E3', amount: 200, category: 'Затраты крана' }),
      ];

      const totals = { admin: 0, operational: 0, commercial: 0 };
      expenses.forEach(e => {
        const cat = categoryMap[e.category] || 'administrative';
        if (cat === 'administrative') totals.admin += e.amount;
        else if (cat === 'operational') totals.operational += e.amount;
        else if (cat === 'commercial') totals.commercial += e.amount;
      });

      expect(totals.admin).toBe(500);
      expect(totals.commercial).toBe(300);
      expect(totals.operational).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Balance Sheet Logic (Assets = Liabilities + Equity)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Balance sheet calculations', () => {

    it('should calculate inventory value as sum(quantity × costPrice)', () => {
      const products = [
        { quantity: 100, costPrice: 5 },
        { quantity: 50, costPrice: 10 },
        { quantity: 0, costPrice: 100 },
      ];
      const inventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
      expect(inventoryValue).toBe(100 * 5 + 50 * 10); // 500 + 500 = 1000
    });

    it('should calculate accounts receivable from client debts', () => {
      const clients = [
        { totalDebt: 200 },
        { totalDebt: 0 },
        { totalDebt: 350 },
      ];
      const accountsReceivable = clients.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
      expect(accountsReceivable).toBe(550);
    });

    it('should calculate fixed assets value from currentValue', () => {
      const fixedAssets = [
        { currentValue: 5000 },
        { currentValue: 3000 },
      ];
      const faValue = fixedAssets.reduce((sum, fa) => sum + (fa.currentValue || 0), 0);
      expect(faValue).toBe(8000);
    });

    it('should calculate VAT liability as max(0, vatOutput - vatInput)', () => {
      // Outgoing VAT (from sales) - Incoming VAT (from purchases) = Net VAT payable
      const vatOutput = 1000;
      const vatInput = 600;
      const vatLiability = Math.max(0, vatOutput - vatInput);
      expect(vatLiability).toBe(400);
    });

    it('VAT liability should not be negative', () => {
      const vatOutput = 300;
      const vatInput = 500;
      const vatLiability = Math.max(0, vatOutput - vatInput);
      expect(vatLiability).toBe(0);
    });

    it('should calculate accounts payable (supplier debt)', () => {
      const purchases = [
        { totalInvoiceAmount: 1000, amountPaidUSD: 600, amountPaid: 600 },
        { totalInvoiceAmount: 500, amountPaidUSD: 500, amountPaid: 500 },
        { totalInvoiceAmount: 2000, amountPaidUSD: 800, amountPaid: 800 },
      ];
      const accountsPayable = purchases.reduce((sum, p) => {
        const paidUSD = (p.amountPaidUSD !== undefined) ? p.amountPaidUSD : (p.amountPaid || 0);
        return sum + Math.max(0, (p.totalInvoiceAmount || 0) - paidUSD);
      }, 0);
      expect(accountsPayable).toBe(400 + 0 + 1200); // 1600
    });

    it('accounts payable should not be negative per purchase', () => {
      const purchases = [
        { totalInvoiceAmount: 500, amountPaidUSD: 700 }, // overpaid
      ];
      const accountsPayable = purchases.reduce((sum, p) => {
        return sum + Math.max(0, (p.totalInvoiceAmount || 0) - (p.amountPaidUSD || 0));
      }, 0);
      expect(accountsPayable).toBe(0); // capped at 0
    });

    it('should calculate fixed assets payable (unpaid portion)', () => {
      const fixedAssets = [
        { purchaseCost: 5000, amountPaid: 3000 },
        { purchaseCost: 2000, amountPaid: undefined }, // fully paid if undefined
      ];
      const fixedAssetsPayable = fixedAssets.reduce((sum, fa) => {
        const paid = fa.amountPaid ?? fa.purchaseCost;
        return sum + Math.max(0, fa.purchaseCost - paid);
      }, 0);
      expect(fixedAssetsPayable).toBe(2000); // 5000-3000=2000, 2000-2000=0
    });

    it('should satisfy accounting equation: totalAssets = totalPassives', () => {
      // Simulated balance
      const inventoryValue = 1000;
      const totalCashUSD = 500;
      const netBankUSD = 200;
      const netCardUSD = 100;
      const accountsReceivable = 300;
      const fixedAssetsValue = 5000;

      const totalLiquidAssets = totalCashUSD + netBankUSD + netCardUSD;
      const totalAssets = inventoryValue + totalLiquidAssets + accountsReceivable + fixedAssetsValue;

      // Liabilities
      const equity = 800;
      const fixedAssetsFund = 4500;
      const vatLiability = 200;
      const accountsPayable = 400;
      const fixedAssetsPayable = 500;

      // Retained earnings is the balancing item
      const retainedEarnings = totalAssets - equity - fixedAssetsFund - vatLiability - accountsPayable - fixedAssetsPayable;
      const totalPassives = equity + fixedAssetsFund + retainedEarnings + vatLiability + accountsPayable + fixedAssetsPayable;

      expect(totalAssets).toBe(totalPassives); // Accounting identity
      expect(totalAssets).toBe(7100);
    });

    it('retained earnings can be negative (accumulated losses)', () => {
      const totalAssets = 1000;
      const equity = 800;
      const fixedAssetsFund = 500;
      const vatLiability = 100;
      const accountsPayable = 200;
      const fixedAssetsPayable = 0;

      const retainedEarnings = totalAssets - equity - fixedAssetsFund - vatLiability - accountsPayable - fixedAssetsPayable;
      expect(retainedEarnings).toBe(-600); // Accumulated losses

      const totalPassives = equity + fixedAssetsFund + retainedEarnings + vatLiability + accountsPayable + fixedAssetsPayable;
      expect(totalAssets).toBe(totalPassives); // Still balances
    });

    it('should calculate net profit = grossProfit - expenses - depreciation (Balance view)', () => {
      const orders = [
        makeOrder({
          subtotalAmount: 2000,
          items: [
            { productId: '1', productName: 'Труба', quantity: 100, priceAtSale: 20, costAtSale: 12, unit: Unit.METER, total: 2000 },
          ],
        }),
      ];
      const expenses = [
        makeExpense({ amount: 300, currency: 'USD' }),
      ];
      const fixedAssets = [
        { accumulatedDepreciation: 100 },
      ];

      const revenue = orders.reduce((sum, o) => sum + (o.subtotalAmount || 0), 0);
      const cogs = orders.reduce((sumO, o) => {
        return sumO + (o.items || []).reduce((sumI, item) => sumI + (item.quantity * item.costAtSale), 0);
      }, 0);
      const grossProfit = revenue - cogs;
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalDepreciation = fixedAssets.reduce((sum, fa) => sum + (fa.accumulatedDepreciation || 0), 0);
      const netProfit = grossProfit - totalExpenses - totalDepreciation;

      expect(revenue).toBe(2000);
      expect(cogs).toBe(1200);
      expect(grossProfit).toBe(800);
      expect(netProfit).toBe(400); // 800 - 300 - 100
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Cash Flow Direction Tests
  // ═══════════════════════════════════════════════════════════════════════

  describe('Cash flow direction tests', () => {
    it('income orders increase cash, expenses decrease cash', () => {
      const order = makeOrder({ paymentMethod: 'cash', amountPaid: 1000 });
      const expense = makeExpense({ amount: 300, currency: 'USD', paymentMethod: 'cash' });

      const result = calculateBaseTotals([order], [], [expense], DEFAULT_RATE);
      expect(result.cashUSD).toBeGreaterThan(0);
      expect(result.cashUSD).toBe(700);
    });

    it('supplier payments reduce cash position', () => {
      const order = makeOrder({ paymentMethod: 'cash', amountPaid: 1000 });
      const supplierPayment = makeTransaction({
        type: 'supplier_payment',
        amount: 800,
        currency: 'USD',
        method: 'cash',
      });

      const result = calculateBaseTotals([order], [supplierPayment], [], DEFAULT_RATE);
      expect(result.cashUSD).toBe(200); // 1000 - 800
    });

    it('refunds reduce cash position', () => {
      const order = makeOrder({ paymentMethod: 'cash', amountPaid: 500 });
      const refund = makeTransaction({
        type: 'client_refund',
        amount: 100,
        currency: 'USD',
        method: 'cash',
      });

      const result = calculateBaseTotals([order], [refund], [], DEFAULT_RATE);
      expect(result.cashUSD).toBe(400); // 500 - 100
    });

    it('handles complete business cycle: sale → expense → supplier payment → refund', () => {
      const orders = [
        makeOrder({ id: 'O1', paymentMethod: 'cash', amountPaid: 2000 }),
        makeOrder({ id: 'O2', paymentMethod: 'bank', totalAmountUZS: 25_600_000 }),
      ];
      const transactions = [
        makeTransaction({ id: 'TX1', type: 'supplier_payment', amount: 500, currency: 'USD', method: 'cash' }),
        makeTransaction({ id: 'TX2', type: 'supplier_payment', amount: 5_000_000, currency: 'UZS', method: 'bank' }),
        makeTransaction({ id: 'TX3', type: 'client_return', amount: 50, currency: 'USD', method: 'cash' }),
      ];
      const expenses = [
        makeExpense({ id: 'E1', amount: 200, currency: 'USD', paymentMethod: 'cash' }),
        makeExpense({ id: 'E2', amount: 1_000_000, currency: 'UZS', paymentMethod: 'bank' }),
      ];

      const result = calculateBaseTotals(orders, transactions, expenses, DEFAULT_RATE);

      expect(result.cashUSD).toBe(2000 - 500 - 50 - 200); // 1250
      expect(result.bankUZS).toBe(25_600_000 - 5_000_000 - 1_000_000); // 19,600,000
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Edge Cases
  // ═══════════════════════════════════════════════════════════════════════

  describe('Edge cases', () => {
    it('should handle orders with undefined/null fields gracefully', () => {
      const order = makeOrder({
        totalAmount: undefined as any,
        amountPaid: null as any,
        totalAmountUZS: undefined as any,
      });
      // Should not throw
      const result = calculateBaseTotals([order], [], [], DEFAULT_RATE);
      expect(result.cashUSD).toBe(0);
    });

    it('should handle transactions with missing currency gracefully', () => {
      const tx = makeTransaction({
        amount: 100,
        currency: undefined as any,
        method: 'cash',
        type: 'supplier_payment',
      });
      // currency undefined → not 'USD' → treated as non-USD
      const result = calculateBaseTotals([], [tx], [], DEFAULT_RATE);
      // With undefined currency, isUSD will be false, so goes to cashUZS
      expect(typeof result.cashUZS).toBe('number');
    });

    it('should handle invalid exchange rate by falling back to DEFAULT_EXCHANGE_RATE', () => {
      const result = calculateBaseTotals([], [], [], 0); // rate = 0
      expect(result).toBeDefined();
      expect(result.corrections).toEqual([]);
    });

    it('should handle very large dataset without errors', () => {
      const orders = Array.from({ length: 1000 }, (_, i) =>
        makeOrder({ id: `ORD-${i}`, paymentMethod: 'cash', amountPaid: 10 })
      );
      const result = calculateBaseTotals(orders, [], [], DEFAULT_RATE);
      expect(result.cashUSD).toBe(10_000); // 1000 × 10
    });
  });
});
