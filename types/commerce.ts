import { Versionable, ProductType, WarehouseType, Unit } from './common';

export interface Client extends Versionable {
  id: string;
  name: string;
  type?: 'individual' | 'legal'; // Default to 'individual'
  phone: string;
  email?: string;
  address?: string; // Physical address

  // Legal Entity Details
  companyName?: string;
  inn?: string; // Tax ID
  mfo?: string; // Bank Code
  bankAccount?: string; // Checking Account
  bankName?: string;
  addressLegal?: string; // Legal Address

  creditLimit: number;
  notes?: string;
  totalPurchases?: number;
  totalDebt?: number;
  // _version and updatedAt inherited from Versionable
}

// Supplier - поставщик
export interface Supplier extends Versionable {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  
  // Legal Entity Details
  companyName?: string;
  inn?: string; // ИНН
  mfo?: string; // МФО банка
  bankAccount?: string; // Расчётный счёт
  bankName?: string;
  addressLegal?: string; // Юридический адрес
  
  // Contact Person
  contactPerson?: string;
  contactPhone?: string;
  
  // Stats
  totalPurchases?: number; // Общая сумма закупок
  totalDebt?: number; // Наш долг поставщику
  
  notes?: string;
  isActive?: boolean; // Активный поставщик
}

export interface Product extends Versionable {
  id: string;
  name: string;
  type: ProductType;
  dimensions: string; // e.g. "50x50x3"
  steelGrade: string; // e.g. "St3sp"
  quantity: number;
  unit: Unit;
  pricePerUnit: number; // Base currency (USD) - Selling Price
  costPrice: number; // Base currency (USD) - Weighted Average Cost
  minStockLevel: number;
  manufacturer?: string; // Производитель
  origin?: 'import' | 'local'; // New field: Origin of the product
  warehouse?: WarehouseType; // Склад: Основной или Облачный
  // _version and updatedAt inherited from Versionable
}

export interface OrderItem {
  productId: string;
  productName: string;
  dimensions?: string;
  quantity: number;
  priceAtSale: number; // Base currency (USD)
  costAtSale: number; // Base currency (USD) - Cost at moment of sale
  unit: Unit;
  total: number; // Base currency (USD)
}

export interface Order extends Versionable {
  id: string;
  reportNo?: number; // Sequential report number
  date: string;
  customerName: string;
  clientId?: string; // Link to Client for debt tracking
  sellerId?: string; // Employee ID for KPI calculation
  sellerName: string; // Added: Who made the sale
  items: OrderItem[];

  // Financials
  subtotalAmount: number; // USD
  vatRateSnapshot: number; // VAT % at time of sale
  vatAmount: number; // USD
  totalAmount: number; // USD

  exchangeRate: number; // Rate at time of sale (USD -> UZS)
  totalAmountUZS: number; // Sales currency (UZS)
  status: 'pending' | 'completed' | 'cancelled';

  // Payment Info
  paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentCurrency?: 'USD' | 'UZS'; // New field for cash currency
  amountPaid: number; // Amount actually paid (USD)
  paymentDueDate?: string; // Deadline for debt repayment
  // _version and updatedAt inherited from Versionable
}

// Workflow Order - Pre-order created by sales department
export interface WorkflowOrder extends Versionable {
  id: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  createdBy: string; // Employee name/email who created the order
  sellerId?: string; // Employee ID for KPI calculation
  sellerName?: string; // Seller name for display
  items: OrderItem[];

  // Financials
  subtotalAmount: number; // USD
  vatRateSnapshot: number; // VAT % at time of order creation
  vatAmount: number; // USD
  totalAmount: number; // USD

  exchangeRate: number; // Rate at time of order creation
  totalAmountUZS: number; // Sales currency (UZS)

  // Status workflow
  status: 'draft' | 'confirmed' | 'sent_to_cash' | 'sent_to_procurement' | 'completed' | 'cancelled';

  // Payment intent (set by sales, verified by cashier)
  paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentCurrency?: 'USD' | 'UZS';
  amountPaid: number; // USD

  // Notes and comments
  notes?: string;
  deliveryDate?: string; // Optional delivery date

  // Cancellation
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;

  // Link to actual Order (when converted to sale)
  convertedToOrderId?: string;
  convertedAt?: string;
  // _version and updatedAt inherited from Versionable
}

export interface Expense extends Versionable {
  id: string;
  date: string;
  description: string;
  amount: number; // USD
  category: string;
  paymentMethod: 'cash' | 'bank' | 'card';
  currency: 'USD' | 'UZS';
  exchangeRate?: number; // Rate at time of expense (USD -> UZS)
  vatAmount?: number; // In original currency
  employeeId?: string; // Link to employee for salary/advances
  // _version and updatedAt inherited from Versionable
}

export interface PurchaseOverheads {
  logistics: number;
  customsDuty: number;
  importVat: number;
  other: number;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  dimensions?: string; // Размер товара
  quantity: number;
  unit: Unit;
  invoicePrice: number; // Цена поставщика за ед. (UZS) - С НДС
  invoicePriceWithoutVat: number; // Цена без НДС (UZS)
  vatAmount: number; // Сумма НДС (UZS)
  landedCost: number; // Финальная себестоимость за ед. (USD) - БЕЗ НДС
  totalLineCost: number; // quantity * landedCost (USD)
  totalLineCostUZS: number; // quantity * invoicePrice (UZS) - С НДС для кредиторки
  warehouse?: WarehouseType; // Склад для этой позиции
}

export interface Purchase extends Versionable {
  id: string;
  date: string;
  supplierName: string;
  status: 'completed';
  items: PurchaseItem[];
  overheads: PurchaseOverheads;
  
  // Суммы в UZS (с НДС) - для кредиторки
  totalInvoiceAmountUZS: number; // Сумма счёта в сумах (с НДС)
  totalVatAmountUZS: number; // Сумма НДС в сумах
  totalWithoutVatUZS: number; // Сумма без НДС в сумах
  
  // Суммы в USD (без НДС) - для ТМЦ
  totalInvoiceAmount: number; // Sum of items invoice prices (USD) - legacy, kept for compatibility
  totalLandedAmount: number; // Sum of landed costs (USD) - БЕЗ НДС
  
  // Курс на момент закупки
  exchangeRate: number;

  // Payment Info
  paymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
  paymentCurrency?: 'USD' | 'UZS'; // Валюта оплаты для наличных
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  amountPaid: number; // Amount actually paid (UZS) - теперь в сумах
  amountPaidUSD: number; // Amount paid converted to USD
  
  // Склад
  warehouse?: WarehouseType; // Склад на который оприходован товар
  // _version and updatedAt inherited from Versionable
}

export interface Transaction extends Versionable {
  id: string;
  date: string;
  type: 'client_payment' | 'supplier_payment' | 'client_return' | 'debt_obligation' | 'client_refund' | 'expense';
  amount: number; // Amount in the specified currency
  currency: 'USD' | 'UZS';
  exchangeRate?: number; // Required if currency is UZS
  method: 'cash' | 'bank' | 'card' | 'debt';
  description: string;
  orderId?: string; // Link to order for sale-linked payments
  relatedId?: string; // Client ID or Purchase ID
  // _version and updatedAt inherited from Versionable
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  lowStockCount: number;
  inventoryValue: number;
}
