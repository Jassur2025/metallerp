import type { AppSettings, Product, Purchase, PurchaseItem, PurchaseOverheads, Transaction, WorkflowOrder } from '../../types';

export interface Balances {
  cashUSD: number;
  cashUZS: number;
  bankUZS: number;
  cardUZS: number;
}

export interface ProcurementProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  settings: AppSettings;
  purchases: Purchase[];
  onSavePurchases: (purchases: Purchase[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  workflowOrders: WorkflowOrder[];
  onSaveWorkflowOrders: (workflowOrders: WorkflowOrder[]) => Promise<boolean | void>;
  onSaveProducts?: (products: Product[]) => Promise<void>;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  onUpdatePurchase?: (id: string, updates: Partial<Purchase>) => Promise<void>;
  // Балансы кассы
  balances?: Balances;
}

export type ProcurementTab = 'new' | 'history' | 'workflow';
export type ProcurementType = 'local' | 'import';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
export type PaymentCurrency = 'USD' | 'UZS';

export interface Totals {
  totalInvoiceValue: number; // USD (legacy)
  totalInvoiceValueUZS: number; // UZS с НДС - для кредиторки
  totalVatAmountUZS: number; // Сумма НДС в UZS
  totalWithoutVatUZS: number; // Сумма без НДС в UZS
  totalOverheads: number;
  totalLandedValue: number; // USD без НДС - для ТМЦ
  itemsWithLandedCost: PurchaseItem[];
}

export interface MissingItemRow {
  item: { productId: string; productName: string; quantity: number; unit: string; dimensions?: string };
  available: number;
  missingQty: number;
}








