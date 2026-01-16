import {
  Client,
  Employee,
  Expense,
  FixedAsset,
  FixedAssetCategory,
  JournalEvent,
  JournalEventType,
  Order,
  OrderItem,
  Product,
  ProductType,
  Purchase,
  PurchaseOverheads,
  Transaction,
  Unit,
  UserRole,
  WorkflowOrder,
  WarehouseType,
} from '../../types';
import { asNumber, asOptionalNumber, asOptionalString, asString, parseJson, pick, type Row } from './parsers';

const PRODUCT_TYPES = Object.values(ProductType);
const UNITS = Object.values(Unit);
const FIXED_ASSET_CATEGORIES = Object.values(FixedAssetCategory);

const ORDER_STATUSES: readonly Order['status'][] = ['pending', 'completed', 'cancelled'] as const;
const ORDER_PAYMENT_METHODS: readonly Order['paymentMethod'][] = ['cash', 'bank', 'card', 'debt'] as const;
const PAYMENT_STATUSES: readonly Order['paymentStatus'][] = ['paid', 'unpaid', 'partial'] as const;
const CURRENCIES: readonly ('USD' | 'UZS')[] = ['USD', 'UZS'] as const;

const USER_ROLES: readonly UserRole[] = ['admin', 'manager', 'accountant', 'sales', 'warehouse'] as const;
const EMPLOYEE_STATUSES: readonly Employee['status'][] = ['active', 'inactive'] as const;

const WORKFLOW_STATUSES: readonly WorkflowOrder['status'][] = [
  'draft',
  'confirmed',
  'sent_to_cash',
  'sent_to_procurement',
  'completed',
  'cancelled',
] as const;

const TRANSACTION_TYPES: readonly Transaction['type'][] = [
  'client_payment',
  'supplier_payment',
  'client_return',
  'debt_obligation',
] as const;
const TRANSACTION_METHODS: readonly Transaction['method'][] = ['cash', 'bank', 'card', 'debt'] as const;

const JOURNAL_TYPES: readonly JournalEventType[] = [
  'employee_action',
  'receipt_operation',
  'system_event',
  'data_change',
] as const;

const JOURNAL_RELATED_TYPES: readonly NonNullable<JournalEvent['relatedType']>[] = [
  'order',
  'product',
  'client',
  'expense',
  'purchase',
  'transaction',
] as const;

const WAREHOUSE_TYPES = Object.values(WarehouseType);

export function mapRowToProduct(row: Row): Product {
  return {
    id: asString(row, 0),
    name: asString(row, 1),
    type: pick(asString(row, 2), PRODUCT_TYPES, ProductType.OTHER),
    dimensions: asString(row, 3),
    steelGrade: asString(row, 4),
    quantity: asNumber(row, 5, 0),
    unit: pick(asString(row, 6), UNITS, Unit.METER),
    pricePerUnit: asNumber(row, 7, 0),
    costPrice: asNumber(row, 8, 0),
    minStockLevel: asNumber(row, 9, 0),
    origin: pick(asString(row, 10, 'local'), ['import', 'local'] as const, 'local'),
    warehouse: pick(asString(row, 11, 'main'), WAREHOUSE_TYPES, WarehouseType.MAIN),
    updatedAt: asOptionalString(row, 12),
    _version: asOptionalNumber(row, 13),
  };
}

export function mapProductToRow(p: Product): unknown[] {
  return [
    p.id,
    p.name,
    p.type,
    p.dimensions,
    p.steelGrade,
    p.quantity,
    p.unit,
    p.pricePerUnit,
    p.costPrice,
    p.minStockLevel,
    p.origin || 'local',
    p.warehouse || 'main',
    p.updatedAt || '',
    p._version ?? 1,
  ];
}

export function mapRowToOrder(row: Row): Order {
  return {
    id: asString(row, 0),
    date: asString(row, 1),
    customerName: asString(row, 2),
    sellerName: asString(row, 3),
    items: parseJson<OrderItem[]>(row, 4, []),
    subtotalAmount: asNumber(row, 5, 0),
    vatRateSnapshot: asNumber(row, 6, 0),
    vatAmount: asNumber(row, 7, 0),
    totalAmount: asNumber(row, 8, 0),
    exchangeRate: asNumber(row, 9, 0),
    totalAmountUZS: asNumber(row, 10, 0),
    status: pick(asString(row, 11), ORDER_STATUSES, 'completed'),
    paymentMethod: pick(asString(row, 12), ORDER_PAYMENT_METHODS, 'cash'),
    paymentStatus: pick(asString(row, 13), PAYMENT_STATUSES, 'paid'),
    amountPaid: asNumber(row, 14, 0),
    paymentCurrency: pick(asString(row, 15, 'USD'), CURRENCIES, 'USD'),
    updatedAt: asOptionalString(row, 16),
    sellerId: asOptionalString(row, 17),
    _version: asOptionalNumber(row, 18),
    reportNo: asOptionalNumber(row, 19),
    paymentDueDate: asOptionalString(row, 20),
  };
}

export function mapOrderToRow(o: Order): unknown[] {
  return [
    o.id,
    o.date,
    o.customerName,
    o.sellerName,
    JSON.stringify(o.items),
    o.subtotalAmount,
    o.vatRateSnapshot,
    o.vatAmount,
    o.totalAmount,
    o.exchangeRate,
    o.totalAmountUZS,
    o.status,
    o.paymentMethod,
    o.paymentStatus,
    o.amountPaid,
    o.paymentCurrency || 'USD',
    o.updatedAt || '',
    o.sellerId || '',
    o._version ?? 1,
    o.reportNo ?? '',
    o.paymentDueDate || '',
  ];
}

export function mapRowToExpense(row: Row): Expense {
  return {
    id: asString(row, 0),
    date: asString(row, 1),
    description: asString(row, 2),
    amount: asNumber(row, 3, 0),
    category: asString(row, 4),
    paymentMethod: pick(asString(row, 5), ['cash', 'bank', 'card'] as const, 'cash'),
    currency: pick(asString(row, 6, 'USD'), CURRENCIES, 'USD'),
    updatedAt: asOptionalString(row, 7),
    _version: asOptionalNumber(row, 8),
  };
}

export function mapExpenseToRow(e: Expense): unknown[] {
  return [e.id, e.date, e.description, e.amount, e.category, e.paymentMethod || 'cash', e.currency || 'USD', e.updatedAt || '', e._version ?? 1];
}

export function mapRowToFixedAsset(row: Row): FixedAsset {
  return {
    id: asString(row, 0),
    name: asString(row, 1),
    category: pick(asString(row, 2), FIXED_ASSET_CATEGORIES, FixedAssetCategory.MACHINERY),
    purchaseDate: asString(row, 3),
    purchaseCost: asNumber(row, 4, 0),
    currentValue: asNumber(row, 5, 0),
    accumulatedDepreciation: asNumber(row, 6, 0),
    depreciationRate: asNumber(row, 7, 0),
    lastDepreciationDate: asOptionalString(row, 8),
    updatedAt: asOptionalString(row, 9),
    _version: asOptionalNumber(row, 10),
  };
}

export function mapFixedAssetToRow(fa: FixedAsset): unknown[] {
  return [
    fa.id,
    fa.name,
    fa.category,
    fa.purchaseDate,
    fa.purchaseCost,
    fa.currentValue,
    fa.accumulatedDepreciation,
    fa.depreciationRate,
    fa.lastDepreciationDate || '',
    fa.updatedAt || '',
    fa._version ?? 1,
  ];
}

export function mapRowToClient(row: Row): Client {
  return {
    id: asString(row, 0),
    name: asString(row, 1),
    type: pick(asString(row, 2, 'individual'), ['individual', 'legal'] as const, 'individual'),
    phone: asString(row, 3),
    email: asOptionalString(row, 4),
    address: asOptionalString(row, 5),
    creditLimit: asNumber(row, 6, 0),
    notes: asOptionalString(row, 7),
    totalPurchases: asNumber(row, 8, 0),
    totalDebt: asNumber(row, 9, 0),
    // Legal entity fields
    companyName: asOptionalString(row, 10),
    inn: asOptionalString(row, 11),
    mfo: asOptionalString(row, 12),
    bankAccount: asOptionalString(row, 13),
    bankName: asOptionalString(row, 14),
    addressLegal: asOptionalString(row, 15),
    updatedAt: asOptionalString(row, 16),
    _version: asOptionalNumber(row, 17),
  };
}

export function mapClientToRow(c: Client): unknown[] {
  return [
    c.id,
    c.name,
    c.type || 'individual',
    c.phone,
    c.email || '',
    c.address || '',
    c.creditLimit,
    c.notes || '',
    c.totalPurchases || 0,
    c.totalDebt || 0,
    // Legal entity fields
    c.companyName || '',
    c.inn || '',
    c.mfo || '',
    c.bankAccount || '',
    c.bankName || '',
    c.addressLegal || '',
    c.updatedAt || '',
    c._version ?? 1,
  ];
}

export function mapRowToEmployee(row: Row): Employee {
  return {
    id: asString(row, 0),
    name: asString(row, 1),
    email: asString(row, 2),
    phone: asOptionalString(row, 3),
    position: asString(row, 4),
    role: pick(asString(row, 5), USER_ROLES, 'sales'),
    hireDate: asString(row, 6),
    salary: asNumber(row, 7, 0),
    status: pick(asString(row, 8, 'active'), EMPLOYEE_STATUSES, 'active'),
    notes: asOptionalString(row, 9),
    permissions: parseJson<Employee['permissions']>(row, 10, undefined),
    updatedAt: asOptionalString(row, 11),
    commissionRate: asNumber(row, 12, 0),
    hasKPI: asString(row, 13) === 'true',
    terminationDate: asOptionalString(row, 14),
    _version: asOptionalNumber(row, 15),
  };
}

export function mapEmployeeToRow(e: Employee): unknown[] {
  return [
    e.id,
    e.name,
    e.email,
    e.phone || '',
    e.position,
    e.role,
    e.hireDate,
    e.salary || 0,
    e.status,
    e.notes || '',
    e.permissions ? JSON.stringify(e.permissions) : '',
    e.updatedAt || '',
    e.commissionRate || 0,
    e.hasKPI ? 'true' : 'false',
    e.terminationDate || '',
    e._version ?? 1,
  ];
}

export function mapRowToPurchase(row: Row): Purchase {
  const overheads = parseJson<PurchaseOverheads>(row, 5, { logistics: 0, customsDuty: 0, importVat: 0, other: 0 });
  const paymentStatus = pick(asString(row, 9), PAYMENT_STATUSES, 'paid');

  // If status is 'unpaid', force amountPaid to 0 regardless of what's in the column
  let amountPaid = asNumber(row, 10, 0);
  if (paymentStatus === 'unpaid') {
    amountPaid = 0;
  }

  return {
    id: asString(row, 0),
    date: asString(row, 1),
    supplierName: asString(row, 2),
    status: 'completed',
    items: parseJson<Purchase['items']>(row, 4, []),
    overheads,
    totalInvoiceAmount: asNumber(row, 6, 0),
    totalLandedAmount: asNumber(row, 7, 0),
    paymentMethod: pick(asString(row, 8), ['cash', 'bank', 'card', 'debt', 'mixed'] as const, 'cash'),
    paymentStatus,
    amountPaid,
    updatedAt: asOptionalString(row, 11),
    _version: asOptionalNumber(row, 12),
    // New fields
    exchangeRate: asNumber(row, 13, 12800),
    paymentCurrency: pick(asString(row, 14, 'UZS'), CURRENCIES, 'UZS'),
    amountPaidUSD: asNumber(row, 15, 0),
    totalInvoiceAmountUZS: asNumber(row, 16, 0),
    totalVatAmountUZS: asNumber(row, 17, 0),
    totalWithoutVatUZS: asNumber(row, 18, 0),
    warehouse: pick(asString(row, 19, 'main'), WAREHOUSE_TYPES, WarehouseType.MAIN),
  };
}

export function mapPurchaseToRow(p: Purchase): unknown[] {
  return [
    p.id,
    p.date,
    p.supplierName,
    p.status,
    JSON.stringify(p.items),
    JSON.stringify(p.overheads),
    p.totalInvoiceAmount,
    p.totalLandedAmount,
    p.paymentMethod,
    p.paymentStatus,
    p.amountPaid,
    p.updatedAt || '',
    p._version ?? 1,
    // New fields
    p.exchangeRate || 12800,
    p.paymentCurrency || 'UZS',
    p.amountPaidUSD || 0,
    p.totalInvoiceAmountUZS || 0,
    p.totalVatAmountUZS || 0,
    p.totalWithoutVatUZS || 0,
    p.warehouse || 'main',
  ];
}

export function mapRowToTransaction(row: Row): Transaction {
  return {
    id: asString(row, 0),
    date: asString(row, 1),
    type: pick(asString(row, 2), TRANSACTION_TYPES, 'client_payment'),
    amount: asNumber(row, 3, 0),
    currency: pick(asString(row, 4, 'USD'), CURRENCIES, 'USD'),
    exchangeRate: asOptionalNumber(row, 5),
    method: pick(asString(row, 6), TRANSACTION_METHODS, 'cash'),
    description: asString(row, 7),
    relatedId: asOptionalString(row, 8),
    updatedAt: asOptionalString(row, 9),
    _version: asOptionalNumber(row, 10),
  };
}

export function mapTransactionToRow(t: Transaction): unknown[] {
  return [
    t.id,
    t.date,
    t.type,
    t.amount,
    t.currency || 'USD',
    t.exchangeRate ?? '',
    t.method,
    t.description,
    t.relatedId || '',
    t.updatedAt || '',
    t._version ?? 1,
  ];
}

export function mapRowToWorkflowOrder(row: Row): WorkflowOrder {
  return {
    id: asString(row, 0),
    date: asString(row, 1),
    customerName: asString(row, 2),
    customerPhone: asOptionalString(row, 3),
    createdBy: asString(row, 4),
    items: parseJson<OrderItem[]>(row, 5, []),
    subtotalAmount: asNumber(row, 6, 0),
    vatRateSnapshot: asNumber(row, 7, 0),
    vatAmount: asNumber(row, 8, 0),
    totalAmount: asNumber(row, 9, 0),
    exchangeRate: asNumber(row, 10, 0),
    totalAmountUZS: asNumber(row, 11, 0),
    status: pick(asString(row, 12), WORKFLOW_STATUSES, 'draft'),
    notes: asOptionalString(row, 13),
    deliveryDate: asOptionalString(row, 14),
    paymentMethod: pick(asString(row, 15), ORDER_PAYMENT_METHODS, 'cash'),
    paymentStatus: pick(asString(row, 16), PAYMENT_STATUSES, 'unpaid'),
    paymentCurrency: pick(asString(row, 17, 'UZS'), CURRENCIES, 'UZS'),
    amountPaid: asNumber(row, 18, 0),
    convertedToOrderId: asOptionalString(row, 19),
    convertedAt: asOptionalString(row, 20),
    updatedAt: asOptionalString(row, 21),
    sellerId: asOptionalString(row, 22),
    sellerName: asOptionalString(row, 23),
    _version: asOptionalNumber(row, 24),
  };
}

export function mapWorkflowOrderToRow(o: WorkflowOrder): unknown[] {
  return [
    o.id,
    o.date,
    o.customerName,
    o.customerPhone || '',
    o.createdBy,
    JSON.stringify(o.items || []),
    o.subtotalAmount,
    o.vatRateSnapshot,
    o.vatAmount,
    o.totalAmount,
    o.exchangeRate,
    o.totalAmountUZS,
    o.status,
    o.notes || '',
    o.deliveryDate || '',
    o.paymentMethod,
    o.paymentStatus,
    o.paymentCurrency || '',
    o.amountPaid || 0,
    o.convertedToOrderId || '',
    o.convertedAt || '',
    o.updatedAt || '',
    o.sellerId || '',
    o.sellerName || '',
    o._version ?? 1,
  ];
}

export function mapRowToJournalEvent(row: Row): JournalEvent {
  return {
    id: asString(row, 0),
    date: asString(row, 1),
    type: pick(asString(row, 2), JOURNAL_TYPES, 'system_event'),
    employeeId: asOptionalString(row, 3),
    employeeName: asOptionalString(row, 4),
    employeeEmail: asOptionalString(row, 5),
    action: asString(row, 6),
    description: asString(row, 7),
    module: asOptionalString(row, 8),
    relatedType: asOptionalString(row, 9)
      ? pick(asString(row, 9), JOURNAL_RELATED_TYPES, 'order')
      : undefined,
    relatedId: asOptionalString(row, 10),
    receiptDetails: parseJson(row, 11, undefined),
    metadata: parseJson(row, 12, undefined),
  };
}

export function mapJournalEventToRow(e: JournalEvent): unknown[] {
  return [
    e.id,
    e.date,
    e.type,
    e.employeeId || '',
    e.employeeName || '',
    e.employeeEmail || '',
    e.action,
    e.description,
    e.module || '',
    e.relatedType || '',
    e.relatedId || '',
    e.receiptDetails ? JSON.stringify(e.receiptDetails) : '',
    e.metadata ? JSON.stringify(e.metadata) : '',
  ];
}


