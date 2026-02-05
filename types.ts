
/**
 * Base interface for optimistic concurrency control
 * All entities should extend this to support version tracking
 */
export interface Versionable {
  /** Version number for optimistic concurrency control. Increments on each update. */
  _version?: number;
  /** ISO timestamp of last update */
  updatedAt?: string;
}

export enum ProductType {
  PIPE = 'Труба',
  PROFILE = 'Профиль',
  SHEET = 'Лист',
  BEAM = 'Балка',
  OTHER = 'Прочее'
}

// Типы складов
export enum WarehouseType {
  MAIN = 'main',      // Основной склад
  CLOUD = 'cloud'     // Облачный склад
}

export const WarehouseLabels: Record<WarehouseType, string> = {
  [WarehouseType.MAIN]: 'Основной склад',
  [WarehouseType.CLOUD]: 'Облачный склад'
};

export enum Unit {
  METER = 'м',
  TON = 'т',
  PIECE = 'шт'
}

export type ExpensePnLCategory = 'administrative' | 'operational' | 'commercial';

export interface ExpenseCategory {
  id: string;
  name: string;
  pnlCategory: ExpensePnLCategory;
}

export interface CompanyDetails {
  name: string;
  address: string;
  phone: string;
  inn: string;
  mfo: string;
  bankName: string;
  accountNumber: string;
  director?: string;
  accountant?: string;
  website?: string;
}

export interface AppSettings {
  vatRate: number; // Percentage (e.g. 12)
  defaultExchangeRate: number;
  theme?: 'light' | 'dark'; // UI theme
  companyDetails?: CompanyDetails; // Added company details for documents
  telegramBotToken?: string;
  telegramChatId?: string;
  expenseCategories?: ExpenseCategory[];
  nextReportNo?: number; // Counter for report numbers
  modules?: {
    dashboard: boolean;
    inventory: boolean;
    import: boolean;
    sales: boolean;
    workflow: boolean;
    reports: boolean;
    balance: boolean;
    fixedAssets: boolean;
    crm: boolean;
    staff: boolean;
    journal: boolean;
    priceList: boolean;
  };
}

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
  origin?: 'import' | 'local'; // New field: Origin of the product
  warehouse?: WarehouseType; // Склад: Основной или Облачный
  manufacturer?: string; // New field: Производитель (e.g. INSIGHT UNION, SOFMET)
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
  relatedId?: string; // Client ID or Purchase ID
  // _version and updatedAt inherited from Versionable
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  lowStockCount: number;
  inventoryValue: number;
}

export interface AiInsight {
  type: 'warning' | 'success' | 'info';
  message: string;
}

export enum FixedAssetCategory {
  BUILDING = 'Здания', // 5%
  STRUCTURE = 'Сооружения', // 5%
  MACHINERY = 'Машины и оборудование', // 15-20% (avg 15%)
  VEHICLE = 'Транспорт', // 15%
  COMPUTER = 'Компьютеры', // 20%
  OFFICE_EQUIPMENT = 'Принтеры / оргтехника', // 20%
  FURNITURE = 'Мебель', // 10%
  INVENTORY = 'Хозяйственный инвентарь', // 10%
  APPLIANCES = 'Бытовая техника', // 15%
  SPECIAL_EQUIPMENT = 'Спецоборудование', // 20%
  LAND = 'Земля' // 0%
}

export interface FixedAsset extends Versionable {
  id: string;
  name: string;
  category: FixedAssetCategory;
  purchaseDate: string;
  purchaseCost: number; // USD
  currentValue: number; // USD (Book Value)
  accumulatedDepreciation: number; // USD
  depreciationRate: number; // Annual %
  lastDepreciationDate?: string;
  paymentMethod?: 'cash' | 'bank' | 'card'; // Способ оплаты
  paymentCurrency?: 'USD' | 'UZS'; // Валюта оплаты (для наличных)
  amountPaid?: number; // USD - сумма оплачено (для частичной оплаты)
  // _version and updatedAt inherited from Versionable
}

// Staff Management & RBAC
export type UserRole = 'admin' | 'manager' | 'accountant' | 'sales' | 'warehouse';

export interface Employee extends Versionable {
  id: string;
  name: string;
  email: string; // Gmail address
  phone?: string;
  position: string;
  role: UserRole;
  hireDate: string; // ISO date
  terminationDate?: string; // ISO date (if fired)
  salary?: number;
  commissionRate?: number; // % of profit for KPI
  hasKPI?: boolean; // Whether the employee has KPI based salary
  status: 'active' | 'inactive';
  notes?: string;
  permissions?: {
    dashboard?: boolean;
    inventory?: boolean;
    import?: boolean;
    sales?: boolean;
    reports?: boolean;
    balance?: boolean;
    fixedAssets?: boolean;
    crm?: boolean;
    staff?: boolean;
    journal?: boolean;
    priceList?: boolean;
    // Granular permissions
    canViewCostPrice?: boolean;
    canProcessReturns?: boolean;
    canEditProducts?: boolean;
    canDeleteOrders?: boolean;
    canManageUsers?: boolean;
  };
}

export interface RolePermissions {
  role: UserRole;
  modules: {
    dashboard?: boolean;
    inventory?: boolean;
    import?: boolean;
    sales?: boolean;
    reports?: boolean;
    balance?: boolean;
    fixedAssets?: boolean;
    crm?: boolean;
    staff?: boolean;
    journal?: boolean;
    priceList?: boolean;
  };
  canEdit: boolean; // Can edit data or view only
}

// Journal Events - для отслеживания операций сотрудников и событий системы
export type JournalEventType =
  | 'employee_action'    // Действия сотрудников (создание заказа, изменение товара и т.д.)
  | 'receipt_operation'  // Операции с чеками (печать, отмена, редактирование)
  | 'system_event'       // Системные события (вход, выход, настройки)
  | 'data_change';       // Изменения данных (обновление товара, клиента и т.d.)

export interface JournalEvent {
  id: string;
  date: string;
  type: JournalEventType;

  // Информация о сотруднике
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;

  // Детали события
  action: string;        // Например: "Создан заказ", "Распечатан чек", "Изменен товар"
  description: string;   // Подробное описание
  module?: string;       // Модуль системы (sales, inventory, crm и т.д.)

  // Связанные данные
  relatedType?: 'order' | 'product' | 'client' | 'expense' | 'purchase' | 'transaction';
  relatedId?: string;

  // Дополнительные данные (для чеков)
  receiptDetails?: {
    orderId: string;
    customerName: string;
    totalAmount: number;
    itemsCount: number;
    paymentMethod: string;
    operation: 'printed' | 'cancelled' | 'edited' | 'created';
  };

  // Метаданные
  metadata?: Record<string, unknown>;
}

