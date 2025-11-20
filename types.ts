
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
  sellerName?: string; // Added: Who made the sale
  items: OrderItem[];
  
  // Financials
  subtotalAmount: number; // USD before tax
  vatRateSnapshot: number; // VAT % at time of sale
  vatAmount: number; // USD tax amount
  totalAmount: number; // USD total (Subtotal + VAT)
  
  exchangeRate: number; // Rate at time of sale (USD -> UZS)
  totalAmountUZS: number; // Sales currency (UZS)
  status: 'completed' | 'pending' | 'cancelled';
}

export interface Expense {
  id: string;
  date: string;
  category: string; // e.g. Rent, Salary, Logistics, Purchase
  amount: number; // USD
  description: string;
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
