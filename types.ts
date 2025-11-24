
export enum ProductType {
  PIPE = 'Труба',
  PROFILE = 'Профиль',
  SHEET = 'Лист',
  BEAM = 'Балка',
  OTHER = 'Прочее'
}

export enum Unit {
  METER = 'м',
  TON = 'т',
  PIECE = 'шт'
}

export interface AppSettings {
  vatRate: number; // Percentage (e.g. 12)
  defaultExchangeRate: number;
  modules?: {
    dashboard: boolean;
    inventory: boolean;
    import: boolean;
    sales: boolean;
    reports: boolean;
    balance: boolean;
    fixedAssets: boolean;
    crm: boolean;
    staff: boolean;
  };
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit: number;
  notes?: string;
  totalPurchases?: number;
  totalDebt?: number;
}

export interface Product {
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
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  priceAtSale: number; // Base currency (USD)
  costAtSale: number; // Base currency (USD) - Cost at moment of sale
  unit: Unit;
  total: number; // Base currency (USD)
}

export interface Order {
  id: string;
  date: string;
  customerName: string;
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
  paymentMethod: 'cash' | 'bank' | 'card' | 'debt';
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentCurrency?: 'USD' | 'UZS'; // New field for cash currency
  amountPaid: number; // Amount actually paid (USD)
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number; // USD
  category: string;
  paymentMethod: 'cash' | 'bank' | 'card';
  currency: 'USD' | 'UZS';
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
  quantity: number;
  unit: Unit;
  invoicePrice: number; // Supplier price per unit (USD)
  landedCost: number; // Final calculated cost per unit (USD)
  totalLineCost: number; // quantity * landedCost
}

export interface Purchase {
  id: string;
  date: string;
  supplierName: string;
  status: 'completed';
  items: PurchaseItem[];
  overheads: PurchaseOverheads;
  totalInvoiceAmount: number; // Sum of items invoice prices
  totalLandedAmount: number; // Sum of landed costs (Invoice + Overheads)

  // Payment Info
  paymentMethod: 'cash' | 'bank' | 'debt';
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  amountPaid: number; // Amount actually paid (USD)
}

export interface Transaction {
  id: string;
  date: string;
  type: 'client_payment' | 'supplier_payment' | 'client_return' | 'debt_obligation';
  amount: number; // Amount in the specified currency
  currency: 'USD' | 'UZS';
  exchangeRate?: number; // Required if currency is UZS
  method: 'cash' | 'bank' | 'card' | 'debt';
  description: string;
  relatedId?: string; // Client ID or Purchase ID
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

export interface FixedAsset {
  id: string;
  name: string;
  category: FixedAssetCategory;
  purchaseDate: string;
  purchaseCost: number; // USD
  currentValue: number; // USD (Book Value)
  accumulatedDepreciation: number; // USD
  depreciationRate: number; // Annual %
  lastDepreciationDate?: string;
}

// Staff Management & RBAC
export type UserRole = 'admin' | 'manager' | 'accountant' | 'sales' | 'warehouse';

export interface Employee {
  id: string;
  name: string;
  email: string; // Gmail address
  phone?: string;
  position: string;
  role: UserRole;
  hireDate: string; // ISO date
  salary?: number;
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
  };
  canEdit: boolean; // Can edit data or view only
}

