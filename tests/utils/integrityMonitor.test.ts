/**
 * Unit tests for data integrity monitor
 *
 * Covers:
 *  - runIntegrityCheck — duplicate IDs, orphaned refs, negative qty,
 *    debt consistency, suspicious values, required fields, timestamps
 *  - getIssuesBySeverity — filtering
 *  - formatReportForDisplay — markdown output
 */

import { describe, it, expect } from 'vitest';
import { runIntegrityCheck, getIssuesBySeverity, formatReportForDisplay } from '../../utils/integrityMonitor';
import type { Product, Order, Client, Transaction, Purchase, Employee } from '../../types';
import { Unit, ProductType } from '../../types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'PRD-001',
  name: 'Pipe 50x50',
  type: ProductType.PIPE,
  dimensions: '50x50x3',
  steelGrade: 'Ст3',
  quantity: 100,
  unit: Unit.METER,
  pricePerUnit: 10,
  costPrice: 8,
  minStockLevel: 5,
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ORD-001',
  date: '2026-01-15T10:00:00Z',
  customerName: 'Client A',
  sellerName: 'Manager',
  status: 'completed',
  items: [{ productId: 'PRD-001', productName: 'Pipe 50x50', quantity: 5, priceAtSale: 10, costAtSale: 8, unit: Unit.METER, total: 50 }],
  subtotalAmount: 50,
  vatRateSnapshot: 12,
  vatAmount: 6,
  totalAmount: 56,
  exchangeRate: 12800,
  totalAmountUZS: 56 * 12800,
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  amountPaid: 56,
  updatedAt: '2026-01-15T10:00:00Z',
  ...overrides,
});

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'CLI-001',
  name: 'Client A',
  phone: '901234567',
  creditLimit: 1000,
  totalPurchases: 500,
  totalDebt: 0,
  ...overrides,
});

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'TRX-001',
  date: '2026-01-15T10:00:00Z',
  type: 'client_payment',
  amount: 50,
  currency: 'USD',
  method: 'cash',
  description: 'Payment',
  ...overrides,
});

const makePurchase = (overrides: Partial<Purchase> = {}): Purchase => ({
  id: 'PUR-001',
  date: '2026-01-10T00:00:00Z',
  supplierName: 'Supplier X',
  status: 'completed',
  items: [],
  totalInvoiceAmount: 100,
  totalLandedAmount: 100,
  exchangeRate: 12800,
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  amountPaid: 100,
  ...overrides,
});

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'EMP-001',
  name: 'John',
  email: 'john@test.com',
  position: 'Manager',
  role: 'manager',
  salary: 1000,
  ...overrides,
});

const emptyData = () => ({
  products: [] as Product[],
  orders: [] as Order[],
  clients: [] as Client[],
  transactions: [] as Transaction[],
  purchases: [] as Purchase[],
  employees: [] as Employee[],
});

// ─── runIntegrityCheck ──────────────────────────────────────────────────────

describe('runIntegrityCheck', () => {
  it('returns clean report for valid data', () => {
    const data = {
      ...emptyData(),
      products: [makeProduct()],
      orders: [makeOrder()],
      clients: [makeClient()],
    };
    const report = runIntegrityCheck(data);
    expect(report.criticalCount).toBe(0);
    expect(report.highCount).toBe(0);
  });

  it('returns zero issues for empty data', () => {
    const report = runIntegrityCheck(emptyData());
    expect(report.totalIssues).toBe(0);
    expect(report.summary).toContain('No critical issues');
  });

  it('has valid timestamp', () => {
    const report = runIntegrityCheck(emptyData());
    expect(new Date(report.timestamp).getTime()).not.toBeNaN();
  });

  // --- Duplicate IDs ---
  it('detects duplicate product IDs', () => {
    const p = makeProduct();
    const report = runIntegrityCheck({ ...emptyData(), products: [p, { ...p }] });
    expect(report.criticalCount).toBeGreaterThanOrEqual(1);
    const critical = getIssuesBySeverity(report, 'critical');
    expect(critical.some(i => i.message.includes('Duplicate ID'))).toBe(true);
  });

  it('detects duplicate order IDs', () => {
    const o = makeOrder();
    const report = runIntegrityCheck({ ...emptyData(), orders: [o, { ...o }], products: [makeProduct()], clients: [makeClient()] });
    expect(report.criticalCount).toBeGreaterThanOrEqual(1);
  });

  // --- Orphaned refs ---
  it('detects order referencing non-existent product', () => {
    const order = makeOrder({ items: [{ productId: 'MISSING', productName: 'Gone', quantity: 1, priceAtSale: 10, costAtSale: 8, unit: Unit.METER, total: 10 }] });
    const report = runIntegrityCheck({ ...emptyData(), orders: [order], clients: [makeClient()] });
    const high = getIssuesBySeverity(report, 'high');
    expect(high.some(i => i.message.includes('non-existent product'))).toBe(true);
  });

  it('detects order customer not in client list', () => {
    const order = makeOrder({ customerName: 'Unknown Customer' });
    const report = runIntegrityCheck({ ...emptyData(), orders: [order], products: [makeProduct()] });
    const low = getIssuesBySeverity(report, 'low');
    expect(low.some(i => i.message.includes('not in client list'))).toBe(true);
  });

  // --- Negative quantities ---
  it('detects negative product quantity', () => {
    const p = makeProduct({ quantity: -5 });
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    expect(report.criticalCount).toBeGreaterThanOrEqual(1);
    const critical = getIssuesBySeverity(report, 'critical');
    expect(critical.some(i => i.message.includes('Negative quantity'))).toBe(true);
  });

  // --- Client debt inconsistency ---
  it('detects debt mismatch', () => {
    const client = makeClient({ totalDebt: 100 }); // stored: $100 debt
    // No transactions → calculated debt should be $0 → mismatch
    const report = runIntegrityCheck({ ...emptyData(), clients: [client] });
    const high = getIssuesBySeverity(report, 'high');
    expect(high.some(i => i.message.includes('Debt mismatch'))).toBe(true);
  });

  it('no debt mismatch when consistent', () => {
    const client = makeClient({ id: 'CLI-002', totalDebt: 100 });
    const tx = makeTransaction({ type: 'debt_obligation', amount: 100, relatedId: 'CLI-002' });
    const report = runIntegrityCheck({ ...emptyData(), clients: [client], transactions: [tx] });
    const high = getIssuesBySeverity(report, 'high');
    expect(high.filter(i => i.message.includes('Debt mismatch'))).toHaveLength(0);
  });

  // --- Suspicious values ---
  it('flags order with >$1M total', () => {
    const order = makeOrder({ totalAmount: 2000000 });
    const report = runIntegrityCheck({ ...emptyData(), orders: [order], products: [makeProduct()], clients: [makeClient()] });
    const medium = getIssuesBySeverity(report, 'medium');
    expect(medium.some(i => i.message.includes('Suspiciously large'))).toBe(true);
  });

  it('flags product with cost > 2x selling price', () => {
    const p = makeProduct({ costPrice: 250, pricePerUnit: 100 });
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    const low = getIssuesBySeverity(report, 'low');
    expect(low.some(i => i.message.includes('Cost price'))).toBe(true);
  });

  // --- Missing required fields ---
  it('detects missing product name', () => {
    const p = makeProduct({ name: '' });
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    const medium = getIssuesBySeverity(report, 'medium');
    expect(medium.some(i => i.field === 'name' && i.entity === 'Product')).toBe(true);
  });

  // --- Missing timestamps ---
  it('detects missing updatedAt on product', () => {
    const p = makeProduct({ updatedAt: undefined });
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    const low = getIssuesBySeverity(report, 'low');
    expect(low.some(i => i.field === 'updatedAt')).toBe(true);
  });

  // --- Old-style IDs ---
  it('flags old-style numeric IDs', () => {
    const p = makeProduct({ id: '1706123456789' }); // 13-digit timestamp
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    const medium = getIssuesBySeverity(report, 'medium');
    expect(medium.some(i => i.message.includes('Old-style numeric'))).toBe(true);
  });
});

// ─── getIssuesBySeverity ────────────────────────────────────────────────────

describe('getIssuesBySeverity', () => {
  it('filters issues by severity', () => {
    const p = makeProduct({ quantity: -1 }); // critical
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    
    const critical = getIssuesBySeverity(report, 'critical');
    const low = getIssuesBySeverity(report, 'low');
    
    expect(critical.length).toBeGreaterThan(0);
    critical.forEach(i => expect(i.severity).toBe('critical'));
    low.forEach(i => expect(i.severity).toBe('low'));
  });
});

// ─── formatReportForDisplay ─────────────────────────────────────────────────

describe('formatReportForDisplay', () => {
  it('generates markdown with header', () => {
    const report = runIntegrityCheck(emptyData());
    const output = formatReportForDisplay(report);
    expect(output).toContain('# Data Integrity Report');
    expect(output).toContain('## Summary');
  });

  it('includes critical section when issues exist', () => {
    const p = makeProduct({ quantity: -1 });
    const report = runIntegrityCheck({ ...emptyData(), products: [p] });
    const output = formatReportForDisplay(report);
    expect(output).toContain('Critical Issues');
  });

  it('includes high section when issues exist', () => {
    const client = makeClient({ totalDebt: 999 }); // mismatch with no transactions
    const report = runIntegrityCheck({ ...emptyData(), clients: [client] });
    const output = formatReportForDisplay(report);
    expect(output).toContain('High Priority Issues');
  });
});
