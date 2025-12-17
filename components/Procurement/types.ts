import type { AppSettings, Product, Purchase, PurchaseItem, PurchaseOverheads, Transaction, WorkflowOrder } from '../../types';

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
}

export type ProcurementTab = 'new' | 'history' | 'workflow';
export type ProcurementType = 'local' | 'import';
export type PaymentMethod = 'cash' | 'bank' | 'debt';
export type PaymentCurrency = 'USD' | 'UZS';

export interface Totals {
  totalInvoiceValue: number;
  totalOverheads: number;
  totalLandedValue: number;
  itemsWithLandedCost: PurchaseItem[];
}

export interface MissingItemRow {
  item: { productId: string; productName: string; quantity: number; unit: string; dimensions?: string };
  available: number;
  missingQty: number;
}



