import { Product, Order, OrderItem, AppSettings, Expense, Employee, Client, Transaction, JournalEvent, WorkflowOrder } from '../../types';

export interface SalesProps {
  products: Product[];
  setProducts: (p: Product[]) => void;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  settings: AppSettings;
  setSettings?: (s: AppSettings) => void;
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
  onAddExpense?: (expense: Expense) => Promise<void>;
  onAddJournalEvent?: (event: JournalEvent) => Promise<void>;
  onDeleteTransaction?: (id: string) => Promise<boolean>;
  onDeleteExpense?: (id: string) => Promise<boolean>;
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

export type SalesMode = 'sale' | 'expense' | 'return' | 'workflow' | 'transactions';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
export type Currency = 'USD' | 'UZS';

