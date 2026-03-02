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

/**
 * Shallow equality check for objects. Compares own enumerable keys.
 * For nested objects/arrays, falls back to JSON comparison only for that value.
 * Much faster than full JSON.stringify on large objects.
 */
function hasChanged<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return true;

  for (const key of keysA) {
    const valA = a[key];
    const valB = b[key];
    if (valA === valB) continue;
    // For primitives, strict equality already failed → changed
    if (typeof valA !== 'object' || typeof valB !== 'object' || valA === null || valB === null) return true;
    // For objects/arrays, use JSON as last resort (only for this single field)
    if (JSON.stringify(valA) !== JSON.stringify(valB)) return true;
  }
  return false;
}

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
        if (oldProduct && hasChanged(oldProduct as unknown as Record<string, unknown>, newProduct as unknown as Record<string, unknown>)) {
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
      } else if (hasChanged(existing as unknown as Record<string, unknown>, tx as unknown as Record<string, unknown>)) {
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

    // 1. Add new employees
    for (const employee of added) {
      await addEmployee(employee);
    }

    // 2. Update existing employees (independently of additions)
    for (const newEmp of newEmployees) {
      if (!added.includes(newEmp)) {
        const oldEmp = employees.find(e => e.id === newEmp.id);
        if (oldEmp && hasChanged(oldEmp as unknown as Record<string, unknown>, newEmp as unknown as Record<string, unknown>)) {
          await updateEmployee(newEmp.id, newEmp);
        }
      }
    }
  }, [employees, addEmployee, updateEmployee]);

  // ── Purchases ──────────────────────────────────────────────────────

  const handleSavePurchases = useCallback(async (newPurchases: Purchase[]) => {
    const prevIds = new Set(purchases.map(p => p.id));
    const addedPurchases = newPurchases.filter(p => !prevIds.has(p.id));

    // 1. Add new purchases
    for (const purchase of addedPurchases) {
      await addPurchase(purchase);
    }

    // 2. Update existing purchases (independently of additions)
    for (const newPurchase of newPurchases) {
      if (!addedPurchases.includes(newPurchase)) {
        const oldPurchase = purchases.find(p => p.id === newPurchase.id);
        if (oldPurchase && hasChanged(oldPurchase as unknown as Record<string, unknown>, newPurchase as unknown as Record<string, unknown>)) {
          await updatePurchase(newPurchase.id, newPurchase);
        }
      }
    }
  }, [purchases, addPurchase, updatePurchase]);

  // ── Clients ────────────────────────────────────────────────────────

  const handleSaveClients = useCallback(async (newClients: Client[]) => {
    const prevIds = new Set(clients.map(c => c.id));
    const added = newClients.filter(c => !prevIds.has(c.id));

    // 1. Add new clients
    for (const client of added) {
      await addClient(client);
    }

    // 2. Update existing clients (independently of additions)
    for (const newClient of newClients) {
      if (!added.includes(newClient)) {
        const oldClient = clients.find(c => c.id === newClient.id);
        if (oldClient && hasChanged(oldClient as unknown as Record<string, unknown>, newClient as unknown as Record<string, unknown>)) {
          await updateClient(newClient.id, newClient);
        }
      }
    }
  }, [clients, addClient, updateClient]);

  // ── Fixed Assets ───────────────────────────────────────────────────

  const handleSaveFixedAssets = useCallback(async (newAssets: FixedAsset[]) => {
    const prevIds = new Set(fixedAssets.map(a => a.id));
    const added = newAssets.filter(a => !prevIds.has(a.id));

    // 1. Add new assets
    for (const asset of added) {
      await addAsset(asset);
    }

    // 2. Update existing assets (independently of additions)
    for (const newAsset of newAssets) {
      if (!added.includes(newAsset)) {
        const oldAsset = fixedAssets.find(a => a.id === newAsset.id);
        if (oldAsset && hasChanged(oldAsset as unknown as Record<string, unknown>, newAsset as unknown as Record<string, unknown>)) {
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
          if (oldVal !== newVal && (typeof oldVal !== 'object' || typeof newVal !== 'object' || JSON.stringify(oldVal) !== JSON.stringify(newVal))) {
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

    // 1. Add new workflow orders
    for (const order of added) {
      await addWorkflowOrder(order);
    }

    // 2. Update existing workflow orders (independently of additions)
    for (const newOrder of newWorkflowOrders) {
      if (!added.includes(newOrder)) {
        const oldOrder = workflowOrders.find(o => o.id === newOrder.id);
        if (oldOrder && hasChanged(oldOrder as unknown as Record<string, unknown>, newOrder as unknown as Record<string, unknown>)) {
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
