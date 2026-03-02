/**
 * useAppHandlers — extracted handler functions from App.tsx
 * Handles save/sync logic for all data entities.
 */
import { useCallback } from 'react';
import { Product, Order, AppSettings, Expense, FixedAsset, Client, Employee, Transaction, Purchase, JournalEvent, WorkflowOrder } from '../types';
import { logger } from '../utils/logger';

export interface AppHandlersDeps {
  // Data arrays
  products: Product[];
  orders: Order[];
  transactions: Transaction[];
  purchases: Purchase[];
  clients: Client[];
  employees: Employee[];
  fixedAssets: FixedAsset[];
  workflowOrders: WorkflowOrder[];

  // CRUD operations (signatures match actual hooks)
  addProduct: (p: Omit<Product, 'id'>) => Promise<Product | null>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<boolean>;
  addOrder: (o: Order) => Promise<boolean>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<boolean>;
  deleteOrder: (id: string) => Promise<boolean>;
  addExpense: (e: Omit<Expense, 'id'>) => Promise<string | null>;
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<Transaction | null>;
  updateTransaction?: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
  addPurchase: (p: Purchase) => Promise<Purchase>;
  updatePurchase: (id: string, data: Partial<Purchase>) => Promise<void>;
  addClient: (c: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  addEmployee: (e: Omit<Employee, 'id'>) => Promise<Employee>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  addAsset: (a: Omit<FixedAsset, 'id'>) => Promise<FixedAsset>;
  updateAsset: (id: string, data: Partial<FixedAsset>) => Promise<void>;
  addWorkflowOrder: (o: Omit<WorkflowOrder, 'id'>) => Promise<WorkflowOrder>;
  updateWorkflowOrder: (id: string, data: Partial<WorkflowOrder>) => Promise<void>;
  addJournalEvent: (e: Omit<JournalEvent, 'id'>) => Promise<JournalEvent>;
  saveSettingsToFirestore: (s: AppSettings) => Promise<void>;

  // Context
  settings: AppSettings;
  toast: { success: (msg: string) => void };
}

// ── Helpers ────────────────────────────────────────────────────────────

const safeNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useAppHandlers(deps: AppHandlersDeps) {
  const {
    products, orders, transactions, purchases, clients, employees,
    fixedAssets, workflowOrders,
    addProduct, updateProduct, addOrder, updateOrder, deleteOrder,
    addExpense, addTransaction, addPurchase, updatePurchase,
    addClient, updateClient, addEmployee, updateEmployee,
    addAsset, updateAsset, addWorkflowOrder, updateWorkflowOrder,
    addJournalEvent, saveSettingsToFirestore,
    settings, toast,
  } = deps;

  // ── Products ───────────────────────────────────────────────────────

  const handleSaveProducts = useCallback(async (newProducts: Product[]): Promise<void> => {
    const prevIds = new Set(products.map(p => p.id));
    const addedProducts = newProducts.filter(p => !prevIds.has(p.id));

    // 1. Handle New Products
    for (const product of addedProducts) {
      await addProduct(product);
    }

    // 2. Handle Updates (Processed regardless of adding new products)
    for (const newProduct of newProducts) {
      if (!addedProducts.includes(newProduct)) {
        const oldProduct = products.find(p => p.id === newProduct.id);
        if (oldProduct && JSON.stringify(oldProduct) !== JSON.stringify(newProduct)) {
          await updateProduct(newProduct.id, newProduct);
        }
      }
    }
  }, [products, addProduct, updateProduct]);

  // ── Transactions ───────────────────────────────────────────────────

  const handleSaveTransactions = useCallback(async (newTransactions: Transaction[]): Promise<void> => {
    const prevMap = new Map(transactions.map(t => [t.id, t]));
    
    for (const tx of newTransactions) {
      const existing = prevMap.get(tx.id);
      if (!existing) {
        // New transaction
        await addTransaction(tx);
      } else if (JSON.stringify(existing) !== JSON.stringify(tx)) {
        // Updated transaction
        const { id, ...updates } = tx;
        await deps.updateTransaction?.(id, updates) ?? Promise.resolve();
      }
    }
  }, [transactions, addTransaction, deps]);

  // ── Expenses ───────────────────────────────────────────────────────

  const handleAddExpense = useCallback(async (newExpense: Expense) => {
    await addExpense(newExpense);
  }, [addExpense]);

  // Legacy no-op — expenses are now stored as transactions via addExpense.
  // Kept for backward compatibility with components that still pass onSaveExpenses.
  const handleSaveExpenses = useCallback(async (_newExpenses: Expense[]): Promise<void> => {
    // No-op: expenses are managed via addExpense/deleteExpense directly
  }, []);

  // ── Employees ──────────────────────────────────────────────────────

  const handleSaveEmployees = useCallback(async (newEmployees: Employee[]) => {
    const prevIds = new Set(employees.map(e => e.id));
    const added = newEmployees.filter(e => !prevIds.has(e.id));

    for (const employee of added) {
      await addEmployee(employee);
    }

    if (added.length === 0) {
      for (const newEmp of newEmployees) {
        const oldEmp = employees.find(e => e.id === newEmp.id);
        if (oldEmp && JSON.stringify(oldEmp) !== JSON.stringify(newEmp)) {
          await updateEmployee(newEmp.id, newEmp);
        }
      }
    }
  }, [employees, addEmployee, updateEmployee]);

  // ── Purchases ──────────────────────────────────────────────────────

  const handleSavePurchases = useCallback(async (newPurchases: Purchase[]) => {
    const prevIds = new Set(purchases.map(p => p.id));
    const addedPurchases = newPurchases.filter(p => !prevIds.has(p.id));

    for (const purchase of addedPurchases) {
      await addPurchase(purchase);
    }

    if (addedPurchases.length === 0) {
      for (const newPurchase of newPurchases) {
        const oldPurchase = purchases.find(p => p.id === newPurchase.id);
        if (oldPurchase && JSON.stringify(oldPurchase) !== JSON.stringify(newPurchase)) {
          await updatePurchase(newPurchase.id, newPurchase);
        }
      }
    }

  }, [purchases, addPurchase, updatePurchase]);

  // ── Clients ────────────────────────────────────────────────────────

  const handleSaveClients = useCallback(async (newClients: Client[]) => {
    const prevIds = new Set(clients.map(c => c.id));
    const added = newClients.filter(c => !prevIds.has(c.id));

    for (const client of added) {
      await addClient(client);
    }

    if (added.length === 0) {
      for (const newClient of newClients) {
        const oldClient = clients.find(c => c.id === newClient.id);
        if (oldClient && JSON.stringify(oldClient) !== JSON.stringify(newClient)) {
          await updateClient(newClient.id, newClient);
        }
      }
    }
  }, [clients, addClient, updateClient]);

  // ── Fixed Assets ───────────────────────────────────────────────────

  const handleSaveFixedAssets = useCallback(async (newAssets: FixedAsset[]) => {
    const prevIds = new Set(fixedAssets.map(a => a.id));
    const added = newAssets.filter(a => !prevIds.has(a.id));

    for (const asset of added) {
      await addAsset(asset);
    }

    if (added.length === 0) {
      for (const newAsset of newAssets) {
        const oldAsset = fixedAssets.find(a => a.id === newAsset.id);
        if (oldAsset && JSON.stringify(oldAsset) !== JSON.stringify(newAsset)) {
          await updateAsset(newAsset.id, newAsset);
        }
      }
    }
  }, [fixedAssets, addAsset, updateAsset]);

  // ── Orders ─────────────────────────────────────────────────────────

  const handleSaveOrders = useCallback(async (newOrders: Order[]) => {
    const prevMap = new Map(orders.map(o => [o.id, o]));
    const newIds = new Set(newOrders.map(o => o.id));

    // 1. Detect deletions — orders in prev but not in new
    for (const [id] of prevMap) {
      if (!newIds.has(id)) {
        await deleteOrder(id);
      }
    }

    // 2. Detect additions and updates
    for (const newOrder of newOrders) {
      const oldOrder = prevMap.get(newOrder.id);
      if (!oldOrder) {
        // New order
        await addOrder(newOrder);
      } else {
        // Existing order — diff ALL fields
        const updates: Partial<Order> = {};
        const keys = Object.keys(newOrder) as (keyof Order)[];
        for (const key of keys) {
          if (key === 'id' || key === '_version' || key === 'updatedAt') continue;
          const oldVal = oldOrder[key];
          const newVal = newOrder[key];
          if (oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            (updates as Record<string, unknown>)[key] = newVal;
          }
        }
        if (Object.keys(updates).length > 0) {
          await updateOrder(newOrder.id, updates);
        }
      }
    }

    return true;
  }, [orders, addOrder, updateOrder, deleteOrder]);

  // ── Workflow Orders ────────────────────────────────────────────────

  const handleSaveWorkflowOrders = useCallback(async (newWorkflowOrders: WorkflowOrder[]) => {
    const prevIds = new Set(workflowOrders.map(o => o.id));
    const added = newWorkflowOrders.filter(o => !prevIds.has(o.id));

    for (const order of added) {
      await addWorkflowOrder(order);
    }

    if (added.length === 0) {
      for (const newOrder of newWorkflowOrders) {
        const oldOrder = workflowOrders.find(o => o.id === newOrder.id);
        if (oldOrder && JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) {
          await updateWorkflowOrder(newOrder.id, newOrder);
        }
      }
    }
  }, [workflowOrders, addWorkflowOrder, updateWorkflowOrder]);

  // ── Journal ────────────────────────────────────────────────────────

  const handleAddJournalEvent = useCallback(async (event: JournalEvent) => {
    await addJournalEvent(event);
  }, [addJournalEvent]);

  // ── Settings ───────────────────────────────────────────────────────

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    await saveSettingsToFirestore(newSettings);
    toast.success('Настройки сохранены!');
  }, [saveSettingsToFirestore, toast]);

  return {
    handleSaveProducts,
    handleSaveTransactions,
    handleAddExpense,
    handleSaveExpenses,
    handleSaveEmployees,
    handleSavePurchases,
    handleSaveClients,
    handleSaveFixedAssets,
    handleSaveOrders,
    handleSaveWorkflowOrders,
    handleAddJournalEvent,
    handleSaveSettings,
  };
}
