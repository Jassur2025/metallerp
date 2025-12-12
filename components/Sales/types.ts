import { Product, Order, OrderItem, AppSettings, Expense, Employee, Client, Transaction, JournalEvent, WorkflowOrder } from '../../types';

export interface SalesProps {
  products: Product[];
  setProducts: (p: Product[]) => void;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  settings: AppSettings;
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  employees: Employee[];
  onNavigateToStaff: () => void;
  clients: Client[];
  onSaveClients: (clients: Client[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  workflowOrders: WorkflowOrder[];
  onSaveWorkflowOrders: (workflowOrders: WorkflowOrder[]) => Promise<boolean | void>;
  currentUserEmail?: string | null;
  onNavigateToProcurement?: () => void;
  onSaveOrders?: (orders: Order[]) => Promise<boolean | void>;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  onSaveProducts?: (products: Product[]) => Promise<void>;
  onSaveExpenses?: (expenses: Expense[]) => Promise<void>;
  onAddJournalEvent?: (event: JournalEvent) => Promise<void>;
}

export interface Balances {
  balanceCashUSD: number;
  balanceCashUZS: number;
  balanceBankUZS: number;
  balanceCardUZS: number;
}

export interface FlyingItem {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export type SalesMode = 'sale' | 'expense' | 'return' | 'workflow';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'debt';
export type Currency = 'USD' | 'UZS';

