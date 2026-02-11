import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Container,
  Landmark,
  RefreshCw,
  Wallet,
  Users,
  FileText,
  UserCircle2,
  Shield,
  BookOpen,
  ClipboardList,
  Book,
  DollarSign
} from 'lucide-react';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('./components/Inventory').then(m => ({ default: m.Inventory })));
const Sales = lazy(() => import('./components/Sales').then(m => ({ default: m.Sales })));
const Procurement = lazy(() => import('./components/Procurement').then(m => ({ default: m.Procurement })));
const Balance = lazy(() => import('./components/Balance').then(m => ({ default: m.Balance })));
const CRM = lazy(() => import('./components/CRM').then(m => ({ default: m.CRM })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const Staff = lazy(() => import('./components/Staff').then(m => ({ default: m.Staff })));
const JournalEventsView = lazy(() => import('./components/JournalEventsView').then(m => ({ default: m.JournalEventsView })));
const FixedAssets = lazy(() => import('./components/FixedAssets').then(m => ({ default: m.FixedAssets })));
const SettingsComponent = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const Workflow = lazy(() => import('./components/Workflow').then(m => ({ default: m.Workflow })));
const PriceList = lazy(() => import('./components/PriceList').then(m => ({ default: m.PriceList })));
const Payroll = lazy(() => import('./components/Payroll').then(m => ({ default: m.Payroll })));

import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TokenExpiryWarning } from './components/TokenExpiryWarning';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConfirmProvider } from './components/ConfirmDialog';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Product, Order, AppSettings, Expense, FixedAsset, Client, Employee, Transaction, Purchase, JournalEvent, WorkflowOrder } from './types';
import { SUPER_ADMIN_EMAILS, IS_DEV_MODE } from './constants';
import { getErrorMessage } from './utils/errorHandler';
import { validateAccessToken, isTokenExpiredError, logTokenStatus } from './utils/tokenHelper';
import { telegramService } from './services/telegramService';
import { calculateBaseTotals } from './utils/finance';

const isDev = import.meta.env.DEV;
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };
const warnDev = (...args: unknown[]) => { if (isDev) console.warn(...args); };
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

// Default Expense Categories for PnL
const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'rent', name: 'Аренда земельных участков, зданий и сооружений', pnlCategory: 'administrative' as const },
  { id: 'special_equipment', name: 'Аренда специальной техники', pnlCategory: 'operational' as const },
  { id: 'bank_fees', name: 'Банковские комиссии', pnlCategory: 'administrative' as const },
  { id: 'sales_bonus', name: 'Бонусы от продаж', pnlCategory: 'commercial' as const },
  { id: 'customs', name: 'Государственные пошлины', pnlCategory: 'administrative' as const },
  { id: 'salary', name: 'Зарплата', pnlCategory: 'administrative' as const },
  { id: 'advance', name: 'Аванс сотрудникам', pnlCategory: 'administrative' as const },
  { id: 'crane_costs', name: 'Затраты крана', pnlCategory: 'operational' as const },
  { id: 'food', name: 'Затраты питания', pnlCategory: 'operational' as const },
  { id: 'corporate_events', name: 'Затраты по корпоративно-культурным мероприятиям', pnlCategory: 'operational' as const },
  { id: 'office_supplies', name: 'Канцелярские затраты', pnlCategory: 'administrative' as const },
  { id: 'business_trips', name: 'Командировки и встречи', pnlCategory: 'administrative' as const },
  { id: 'utilities', name: 'Коммунальные затраты', pnlCategory: 'administrative' as const },
  { id: 'training', name: 'Корпоративное обучение', pnlCategory: 'administrative' as const },
  { id: 'corporate_gifts', name: 'Корпоративные подарки', pnlCategory: 'administrative' as const },
  { id: 'courier_fuel', name: 'Курьерские\\ГСМ затраты', pnlCategory: 'administrative' as const },
  { id: 'marketing', name: 'Маркетинг и реклама', pnlCategory: 'commercial' as const },
  { id: 'loading', name: 'Погрузочные затраты', pnlCategory: 'commercial' as const },
  { id: 'postal', name: 'Почтовые затраты', pnlCategory: 'administrative' as const },
  { id: 'bonus', name: 'Премии', pnlCategory: 'commercial' as const },
  { id: 'professional_services', name: 'Профессиональные услуги', pnlCategory: 'administrative' as const },
  { id: 'other_services', name: 'Прочие услуги', pnlCategory: 'administrative' as const },
  { id: 'metal_services', name: 'Прочие услуги по металл сервису', pnlCategory: 'operational' as const },
  { id: 'materials', name: 'Расходные материалы для обработки металла', pnlCategory: 'operational' as const },
  { id: 'overtime', name: 'Сверхурочная работа', pnlCategory: 'operational' as const },
  { id: 'internet', name: 'Связь и интернет', pnlCategory: 'administrative' as const },
  { id: 'social', name: 'Социальная политика', pnlCategory: 'administrative' as const },
  { id: 'construction', name: 'Строительные затраты', pnlCategory: 'operational' as const },
  { id: 'telecom_it', name: 'Телекоммуникации и ИТ', pnlCategory: 'administrative' as const },
  { id: 'os_maintenance', name: 'Техническое обслуживание ОС', pnlCategory: 'administrative' as const },
  { id: 'transport_purchases', name: 'Транспортные услуги при закупках', pnlCategory: 'operational' as const },
  { id: 'crane_services', name: 'Услуги крана при закупках', pnlCategory: 'operational' as const },
  { id: 'insurance', name: 'Услуги страхования', pnlCategory: 'commercial' as const },
  { id: 'household', name: 'Хозяйственные затраты', pnlCategory: 'administrative' as const },
];

// Default Settings
const defaultSettings: AppSettings = {
  vatRate: 12,
  defaultExchangeRate: 12800,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  nextReportNo: 1, // Start from 1
  modules: {
    dashboard: true,
    inventory: true,
    import: true,
    sales: true,
    workflow: true,
    reports: true,
    balance: true,
    fixedAssets: true,
    crm: true,
    staff: true,
    journal: true,
    priceList: true
  }
};

import { useOrders } from './hooks/useOrders';
import { usePurchases } from './hooks/usePurchases';
import { useProducts } from './hooks/useProducts';
import { useTransactions } from './hooks/useTransactions';
import { useExpenses } from './hooks/useExpenses';
import { useClients } from './hooks/useClients';
import { useEmployees } from './hooks/useEmployees';
import { useFixedAssets } from './hooks/useFixedAssets';
import { useWorkflowOrders } from './hooks/useWorkflowOrders';
import { useJournal } from './hooks/useJournal';
import { useSettings } from './hooks/useSettings';

const AppContent: React.FC = () => {
  const { user, logout, accessToken, refreshAccessToken } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('metal_erp_sidebar_open');
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch {
      // ignore
    }
    // Default: open on desktop, closed on mobile
    return window.innerWidth >= 1024;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data State
  // Use Firebase Hook for Products
  const {
    products,
    addProduct,
    updateProduct,
    migrateProducts: migrateLegacyProducts
  } = useProducts();

  // Use Firebase Hook for Orders
  const {
    orders,
    setOrders,
    loading: ordersLoading,
    addOrder,
    updateOrder,
    migrateOrders: migrateLegacyOrders
  } = useOrders();
  // const [orders, setOrders] = useState<Order[]>([]); // Replaced by hook

  // Use Firebase Hook for Expenses
  const {
    expenses,
    addExpense,
    deleteExpense,
    migrateLegacyExpenses
  } = useExpenses();
  // const [expenses, setExpenses] = useState<Expense[]>([]); // Replaced by hook

  // Use Firebase Hook for Fixed Assets
  const {
    fixedAssets,
    addAsset,
    updateAsset,
    migrateAssets: migrateLegacyAssets
  } = useFixedAssets();
  // const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]); // Replaced by hook

  // Use Firebase Hook for Clients
  const {
    clients,
    addClient,
    updateClient,
    migrateClients: migrateLegacyClients
  } = useClients();
  // const [clients, setClients] = useState<Client[]>([]); // Replaced by hook

  // Use Firebase Hook for Employees
  const {
    employees,
    addEmployee,
    updateEmployee,
    migrateFromSheets: migrateLegacyEmployees
  } = useEmployees();
  // const [employees, setEmployees] = useState<Employee[]>([]); // Replaced by hook
  // Use Firebase Hook for Transactions
  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    migrateTransactions: migrateLegacyTransactions
  } = useTransactions();
  // const [transactions, setTransactions] = useState<Transaction[]>([]); // Replaced by hook

  // Use Firebase Hook for Purchases
  const {
    purchases,
    setPurchases, // Optimistic updates
    addPurchase,
    updatePurchase,
    deletePurchase, // We might need to expose this if Procurement supports deletion
    migratePurchases: migrateLegacyPurchases
  } = usePurchases();
  // const [purchases, setPurchases] = useState<Purchase[]>([]); // Replaced by hook
  // const [purchases, setPurchases] = useState<Purchase[]>([]); // Replaced by hook
  // const [journalEvents, setJournalEvents] = useState<JournalEvent[]>([]); // Replaced by hook

  // Use Firebase Hook for Journal
  const {
    journalEvents,
    addEvent: addJournalEvent,
    migrateEvents: migrateLegacyJournalEvents
  } = useJournal();

  // const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]); // Replaced by hook
  // const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]); // Replaced by hook

  // Use Firebase Hook for Workflow Orders
  const {
    workflowOrders,
    addWorkflowOrder,
    updateWorkflowOrder,
    migrateWorkflowOrders: migrateLegacyWorkflowOrders
  } = useWorkflowOrders();
  // const [workflowOrders, setWorkflowOrders] = useState<WorkflowOrder[]>([]);

  // Initialize Save Handlers using the universal hook
  // const [workflowOrders, setWorkflowOrders] = useState<WorkflowOrder[]>([]);

  const handleSaveProducts = async (newProducts: Product[]): Promise<void> => {
    // Firebase Product Sync Adapter
    // Compare newProducts with current products to find Add/Update
    const prevIds = new Set(products.map(p => p.id));
    const addedProducts = newProducts.filter(p => !prevIds.has(p.id));

    // 1. Handle New Products
    for (const product of addedProducts) {
      await addProduct(product);
    }

    // 2. Handle Updates (Processed regardless of adding new products)
    for (const newProduct of newProducts) {
      if (!addedProducts.includes(newProduct)) { // Skip the ones we just added
        const oldProduct = products.find(p => p.id === newProduct.id);
        if (oldProduct) {
          // Check for meaningful changes
          if (JSON.stringify(oldProduct) !== JSON.stringify(newProduct)) {
            await updateProduct(newProduct.id, newProduct);
          }
        }
      }
    }

  };
  const saveOrdersHandler = async (newOrders: Order[]): Promise<void> => {
    console.warn('Full orders save requested - ignored in Firebase mode');
  };

  const handleSaveTransactions = async (newTransactions: Transaction[]): Promise<void> => {
    // Firebase Adapter
    // Similar to products, we key off IDs.
    const prevIds = new Set(transactions.map(t => t.id));
    const added = newTransactions.filter(t => !prevIds.has(t.id));

    for (const tx of added) {
      await addTransaction(tx);
    }
  };

  // Legacy Save Handlers (Removed)
  const saveExpensesHandler = async (...args: any[]): Promise<void> => {};
  const saveFixedAssetsHandler = async (...args: any[]): Promise<void> => {};
  const saveClientsHandler = async (...args: any[]): Promise<void> => {};
  const saveEmployeesHandler = async (...args: any[]): Promise<void> => {};
  const saveWorkflowOrdersHandler = async (...args: any[]): Promise<void> => {};
  const saveJournalEventsHandler = async (...args: any[]): Promise<void> => {};
  const { settings, saveSettings: saveSettingsToFirestore } = useSettings(defaultSettings);

  type MoneyEvent = {
    type: 'expense' | 'purchase' | 'supplier_payment' | 'client_payment' | 'sale';
    amount: number;
    currency: 'USD' | 'UZS';
    method?: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
    counterparty?: string;
    description?: string;
    id?: string;
    date?: string;
    details?: string;
  };

  const safeNumber = (value: unknown, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const sendTelegramMoneyEvent = (event: MoneyEvent) => {
    if (!settings.telegramBotToken || !settings.telegramChatId) return;
    telegramService
      .sendMoneyEvent(settings.telegramBotToken, settings.telegramChatId, event)
      .catch(err => errorDev('Telegram money event failed', err));
  };

  // Load Data on Mount
  useEffect(() => {
    // Firebase hooks load data automatically
  }, []);

  // Settings are now synced via useSettings hook (Firestore + localStorage cache)

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('metal_erp_sidebar_open', String(isSidebarOpen));
    } catch {
      // ignore
    }
  }, [isSidebarOpen]);

  // Real-time Debt Recalculation Effect
  // Uses useRef to access latest data without causing re-triggers,
  // and a running guard to prevent overlapping/cyclic updates.
  const clientsRef = React.useRef(clients);
  const ordersRef = React.useRef(orders);
  const transactionsRef = React.useRef(transactions);
  const updateClientRef = React.useRef(updateClient);
  const isRecalculatingRef = React.useRef(false);

  React.useEffect(() => { clientsRef.current = clients; }, [clients]);
  React.useEffect(() => { ordersRef.current = orders; }, [orders]);
  React.useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  React.useEffect(() => { updateClientRef.current = updateClient; }, [updateClient]);

  useEffect(() => {
    if (clients.length === 0 || orders.length === 0) return;

    const checkDebts = async () => {
      if (isRecalculatingRef.current) return;
      isRecalculatingRef.current = true;

      try {
        const currentClients = clientsRef.current;
        const currentOrders = ordersRef.current;
        const currentTransactions = transactionsRef.current;
        let updatesCount = 0;

        for (const client of currentClients) {
          let calculatedDebt = 0;
          const clientName = (client.name || '').toLowerCase().trim();
          const companyName = (client.companyName || '').toLowerCase().trim();

          // Find unpaid orders for this client
          const clientOrders = currentOrders.filter(o => {
            const orderClientName = (o.customerName || '').toLowerCase().trim();
            const matchesClient = o.clientId === client.id ||
              orderClientName === clientName ||
              (clientName && orderClientName.includes(clientName)) ||
              (clientName && clientName.includes(orderClientName)) ||
              (companyName && orderClientName.includes(companyName)) ||
              (companyName && companyName.includes(orderClientName));

            const hasUnpaidBalance = ((o.totalAmount || 0) - (o.amountPaid || 0)) > 0.01;
            const isDebtPayment = o.paymentMethod === 'debt' ||
              o.paymentStatus === 'unpaid' ||
              o.paymentStatus === 'partial';

            return matchesClient && (isDebtPayment || hasUnpaidBalance);
          });
          const clientOrderIds = clientOrders.map(o => o.id.toLowerCase());

          // Sum unpaid amounts from orders
          clientOrders.forEach(order => {
            const paidUSD = order.amountPaid || 0;
            const openAmount = (order.totalAmount || 0) - paidUSD;
            calculatedDebt += Math.max(0, openAmount);
          });

          // Add debt_obligation transactions not linked to counted orders
          const debtTransactions = currentTransactions.filter(t => {
            if (t.type !== 'debt_obligation') return false;
            const desc = (t.description || '').toLowerCase();
            const matchesClient = t.relatedId === client.id ||
              (clientName && desc.includes(clientName)) ||
              (companyName && desc.includes(companyName));
            const relatedToExistingOrder = clientOrderIds.some(orderId =>
              desc.includes(orderId) || t.relatedId?.toLowerCase() === orderId
            );
            return matchesClient && !relatedToExistingOrder;
          });
          debtTransactions.forEach(t => {
            calculatedDebt += t.amount;
          });

          // Subtract direct client payments (not linked to specific orders)
          const debtTxIds = debtTransactions.map(t => t.id.toLowerCase());
          const paymentTransactions = currentTransactions.filter(t => {
            const desc = (t.description || '').toLowerCase();
            const relatedIdLower = (t.relatedId || '').toLowerCase();
            const isPayment = t.type === 'client_payment' || desc.includes('погашение');

            const isForClientDirectly = t.relatedId === client.id;
            const isForDebtObligation = debtTxIds.includes(relatedIdLower);
            const isForKnownOrder = clientOrderIds.includes(relatedIdLower);

            return isPayment && (isForClientDirectly || isForDebtObligation) && !isForKnownOrder;
          });
          paymentTransactions.forEach(t => {
            let amountUSD = t.amount;
            if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
              amountUSD = t.amount / t.exchangeRate;
            }
            calculatedDebt -= amountUSD;
          });

          // Subtract debt-method returns
          const returnTransactions = currentTransactions.filter(t =>
            t.type === 'client_return' && t.method === 'debt' && t.relatedId === client.id
          );
          returnTransactions.forEach(t => {
            let amountUSD = t.amount;
            if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
              amountUSD = t.amount / t.exchangeRate;
            }
            calculatedDebt -= amountUSD;
          });

          const finalDebt = Math.max(0, calculatedDebt);

          if (Math.abs(finalDebt - (client.totalDebt || 0)) > 0.01) {
            await updateClientRef.current(client.id, { totalDebt: finalDebt });
            updatesCount++;
          }
        }

        if (updatesCount > 0) {
          logDev(`📊 Updated debt for ${updatesCount} clients`);
        }
      } finally {
        isRecalculatingRef.current = false;
      }
    };

    const timeoutId = setTimeout(checkDebts, 2000);
    return () => clearTimeout(timeoutId);

    // Trigger only on data count changes — NOT on reference changes from our own updates
  }, [clients.length, orders.length, transactions.length]);

  // Вычисление балансов кассы
  const balances = React.useMemo(() => {
    return calculateBaseTotals(orders, transactions, expenses, settings.defaultExchangeRate);
  }, [orders, transactions, expenses, settings.defaultExchangeRate]);

  // Combine journal events with auto-corrections for the Journal view
  const allJournalEvents = React.useMemo(() => {
    // Ensure journalEvents is an array before spreading
    const safeEvents = Array.isArray(journalEvents) ? journalEvents : [];

    const correctionEvents: JournalEvent[] = (balances.corrections || []).map(c => ({
      id: `auto-fix-${c.id}`,
      date: new Date().toISOString(),
      type: 'system_event' as const,
      module: 'finance',
      action: 'Авто-коррекция',
      description: `Исправлена ошибка: ${c.reason}. ${c.type} #${c.id}: ${c.originalAmount} -> ${c.correctedAmount}`,
      employeeName: 'System Auto-Fix'
    }));

    return [...safeEvents, ...correctionEvents].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [journalEvents, balances.corrections]);

  const loadData = async () => {
    // Legacy loadData removed (using Firebase hooks)
  };

  /* handleSaveAll removed - fully disconnected from Sheets */

  const handleAddExpense = async (newExpense: Expense) => {
    const id = await addExpense(newExpense);

    if (id) {
      // Telegram notification
      sendTelegramMoneyEvent({
        type: 'expense',
        amount: safeNumber(newExpense.amount),
        currency: newExpense.currency || 'USD',
        method: newExpense.paymentMethod,
        description: newExpense.description,
        id: id,
        date: newExpense.date
      });
    }
  };

  const handleSaveEmployees = async (newEmployees: Employee[]) => {
    // Firebase Update Logic
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
  };

  const handleSavePurchases = async (newPurchases: Purchase[]) => {
    // Firebase Migration/Update Logic:
    // We receive the full list of purchases from Procurement component.
    // We need to identify NEW or UPDATED purchases and persist them to Firebase.

    // 1. Identify new purchases
    const prevIds = new Set(purchases.map(p => p.id));
    const addedPurchases = newPurchases.filter(p => !prevIds.has(p.id));

    // 2. Persist new purchases
    for (const purchase of addedPurchases) {
      await addPurchase(purchase);
    }

    // 3. Persist updates (check for changes)
    if (addedPurchases.length === 0) {
      for (const newPurchase of newPurchases) {
        const oldPurchase = purchases.find(p => p.id === newPurchase.id);
        if (oldPurchase) {
          // Simple deep comparison or check key fields
          if (JSON.stringify(oldPurchase) !== JSON.stringify(newPurchase)) {
            await updatePurchase(newPurchase.id, newPurchase);
          }
        }
      }
    }

    // Identify deleted purchases (if any) - optional feature
    // const newIds = new Set(newPurchases.map(p => p.id));
    // const deletedPurchases = purchases.filter(p => !newIds.has(p.id));
    // for (const del of deletedPurchases) { await deletePurchase(del.id); }

    const success = true; // Assume success for Firebase ops

    if (success) {
      addedPurchases.forEach(p =>
        sendTelegramMoneyEvent({
          type: 'purchase',
          amount: safeNumber(p.totalLandedAmount ?? p.totalInvoiceAmount ?? 0),
          currency: 'USD',
          method: p.paymentMethod,
          counterparty: p.supplierName,
          id: p.id,
          date: p.date
        })
      );
    }
  };

  const handleSaveClients = async (newClients: Client[]) => {
    // Firebase Update Logic
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
  };

  const handleSaveExpenses = async (newExpenses: Expense[]): Promise<void> => {
    // Firebase Migration logic if needed, but for now we just log
    console.warn('handleSaveExpenses called - ignoring in Firebase mode');
  };

  const handleSaveFixedAssets = async (newAssets: FixedAsset[]) => {
    // Firebase Update Logic
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
  };

  const handleSaveOrders = async (newOrders: Order[]) => {
    // Firebase Migration Logic:
    // We receive the full list of orders from legacy components.
    // We need to identify NEW or UPDATED orders and persist them to Firebase.

    // 1. Identify new orders
    const prevIds = new Set(orders.map(o => o.id));
    const addedOrders = newOrders.filter(o => !prevIds.has(o.id));

    // 2. Persist new orders
    for (const order of addedOrders) {
      await addOrder(order);
    }

    // 3. Persist specific updates (focusing on Payment Status changes from CRM)
    if (addedOrders.length === 0) {
      // Detect changed orders
      for (const newOrder of newOrders) {
        const oldOrder = orders.find(o => o.id === newOrder.id);
        if (oldOrder) {
          if (oldOrder.amountPaid !== newOrder.amountPaid ||
            oldOrder.paymentStatus !== newOrder.paymentStatus ||
            oldOrder.paymentMethod !== newOrder.paymentMethod) {

            await updateOrder(newOrder.id, {
              amountPaid: newOrder.amountPaid,
              paymentStatus: newOrder.paymentStatus,
              paymentMethod: newOrder.paymentMethod,
              // Add other fields if needed
            });
          }
        }
      }
    }

    // setOrders(newOrders); // Removed: orders are managed by hook now
    // const success = await saveOrdersHandler(newOrders); // Removed legacy save
    const success = true; // Assume logic above succeeded

    if (success) {
      addedOrders.forEach(o =>
        sendTelegramMoneyEvent({
          type: 'sale',
          amount: safeNumber(o.totalAmount),
          currency: (o.paymentCurrency as 'USD' | 'UZS') || 'USD',
          method: o.paymentMethod,
          counterparty: o.customerName,
          id: o.id,
          date: o.date,
          details: (() => {
            if (!o.items || !Array.isArray(o.items)) return undefined;
            const lines = o.items.slice(0, 3).map(it =>
              `${it.productName}${it.dimensions ? ` (${it.dimensions})` : ''} × ${safeNumber(it.quantity)} ${it.unit} `
            );
            const extra = o.items.length > 3 ? `, +${o.items.length - 3} поз.` : '';
            return lines.join(', ') + extra;
          })()
        })
      );
      return true;
    }
    return false;
  };

  const handleSaveWorkflowOrders = async (newWorkflowOrders: WorkflowOrder[]) => {
    // Firebase Update Logic
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
  };



  const handleAddJournalEvent = async (event: JournalEvent) => {
    // setJournalEvents(prev => [event, ...prev]); // Replaced by hook
    // await saveJournalEventsHandler([event]); // Replaced by hook
    await addJournalEvent(event);
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await saveSettingsToFirestore(newSettings);
    toast.success('Настройки сохранены!');
  };

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    // Security check: if user doesn't have permission for active tab, show access denied or redirect
    // We skip check for 'settings' as it might be needed for basic user profile, 
    // but if you want to restrict settings too, add it to permissions.
    // Currently settings permission is checked in sidebar, but let's be safe.
    if (activeTab !== 'settings' && !checkPermission(activeTab as keyof typeof settings.modules)) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Shield size={64} className="mb-4 opacity-20" />
          <h2 className="text-xl font-bold text-white mb-2">Доступ ограничен</h2>
          <p>У вас нет прав для просмотра этого раздела.</p>
        </div>
      );
    }

    const renderLazyComponent = (component: React.ReactNode) => (
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      }>
        {component}
      </Suspense>
    );

    switch (activeTab) {
      case 'dashboard':
        return renderLazyComponent(<Dashboard products={products} orders={orders} clients={clients} transactions={transactions} settings={settings} />);
      case 'inventory':
        return renderLazyComponent(<Inventory products={products} setProducts={(val) => console.warn('setProducts ignored in Firebase mode', val)} onSaveProducts={handleSaveProducts} />);
      case 'import':
        return renderLazyComponent(<Procurement
          products={products}
          setProducts={(val) => console.warn('setProducts ignored in Firebase mode', val)}
          settings={settings}
          purchases={purchases}
          onSavePurchases={handleSavePurchases}
          transactions={transactions}
          setTransactions={(val) => console.warn('setTransactions ignored (Firebase)', val)}
          workflowOrders={workflowOrders}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          onSaveProducts={handleSaveProducts}
          onSaveTransactions={handleSaveTransactions}
          onUpdatePurchase={updatePurchase}
          balances={balances}
        />);
      case 'journal':
        return renderLazyComponent(<JournalEventsView events={allJournalEvents} />);
      case 'sales':
        return renderLazyComponent(<Sales
          products={products}
          setProducts={(val) => console.warn('setProducts ignored in Firebase mode', val)}
          orders={orders}
          setOrders={setOrders}
          settings={settings}
          setSettings={saveSettingsToFirestore}
          expenses={expenses}
          setExpenses={(val) => console.warn('setExpenses ignored (Firebase)', val)}
          employees={employees}
          onNavigateToStaff={() => setActiveTab('staff')}
          clients={clients}
          onSaveClients={handleSaveClients}
          transactions={transactions}
          setTransactions={(val) => console.warn('setTransactions ignored (Firebase)', val)}
          workflowOrders={workflowOrders}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          currentUserEmail={user?.email}
          onNavigateToProcurement={() => setActiveTab('import')}
          onSaveOrders={handleSaveOrders}
          onSaveTransactions={handleSaveTransactions}
          onSaveProducts={handleSaveProducts}
          onSaveExpenses={handleSaveExpenses}
          onAddJournalEvent={handleAddJournalEvent}
          onDeleteTransaction={deleteTransaction}
          onDeleteExpense={deleteExpense}
        />);
      case 'workflow':
        return renderLazyComponent(<Workflow
          products={products}
          setProducts={(val) => console.warn('setProducts ignored (Firebase)', val)}
          workflowOrders={workflowOrders}
          setWorkflowOrders={(val) => console.warn('setWorkflowOrders ignored (Firebase)', val)}
          orders={orders}
          setOrders={setOrders}
          clients={clients}
          onSaveClients={handleSaveClients}
          transactions={transactions}
          setTransactions={(val) => console.warn('setTransactions ignored (Firebase)', val)}
          employees={employees}
          settings={settings}
          currentUserEmail={user?.email}
          onSaveOrders={handleSaveOrders}
          onSaveProducts={handleSaveProducts}
          onSaveTransactions={handleSaveTransactions}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          onAddJournalEvent={handleAddJournalEvent}
          onNavigateToProcurement={() => setActiveTab('import')}
        />);
      case 'reports':
        return renderLazyComponent(<Reports orders={orders} expenses={expenses} products={products} purchases={purchases} settings={settings} transactions={transactions} fixedAssets={fixedAssets} onAddExpense={handleAddExpense} />);
      case 'fixedAssets':
        return renderLazyComponent(<FixedAssets
          assets={fixedAssets}
          setAssets={(val) => console.warn('setAssets ignored (Firebase)', val)}
          onSaveAssets={handleSaveFixedAssets}
          transactions={transactions}
          setTransactions={(val) => console.warn('setTransactions ignored (Firebase)', val)}
          onSaveTransactions={handleSaveTransactions}
          defaultExchangeRate={settings.defaultExchangeRate}
        />);
      case 'crm':
        return renderLazyComponent(<CRM
          clients={clients}
          onSave={handleSaveClients}
          orders={orders}
          onSaveOrders={handleSaveOrders}
          transactions={transactions}
          setTransactions={(val) => console.warn('setTransactions ignored (Firebase)', val)}
          onSaveTransactions={handleSaveTransactions}
          currentUser={user}
        />);
      case 'staff':
        return renderLazyComponent(<Staff employees={employees} onSave={handleSaveEmployees} />);
      case 'payroll':
        return renderLazyComponent(<Payroll employees={employees} orders={orders} expenses={expenses} />);
      case 'balance':
        return renderLazyComponent(<Balance
          orders={orders}
          products={products}
          expenses={expenses}
          fixedAssets={fixedAssets}
          settings={settings}
          transactions={transactions}
          clients={clients}
          purchases={purchases}
        />);
      case 'settings':
        return renderLazyComponent(<SettingsComponent settings={settings} onSave={handleSaveSettings} />);
      case 'priceList':
        return renderLazyComponent(<PriceList products={products} onSaveProducts={handleSaveProducts} settings={settings} />);
      default:
        return renderLazyComponent(<Dashboard products={products} orders={orders} settings={settings} />);
    }
  };

  // Current Employee Permissions
  const currentEmployee = employees.find(e => e.email.toLowerCase() === user?.email?.toLowerCase());

  const checkPermission = (module: string) => {
    // 0. Dev Mode Bypass
    if (IS_DEV_MODE) return true;

    // 1. Super Admin Bypass
    if (user?.email && (
      // Check against hardcoded super admins
      (typeof SUPER_ADMIN_EMAILS !== 'undefined' && SUPER_ADMIN_EMAILS.includes(user.email)) ||
      // Or check if the user is marked as 'admin' role in the staff list (optional, but good practice)
      currentEmployee?.role === 'admin'
    )) {
      return true;
    }

    // 2. Default Deny: If employee not found, block everything
    if (!currentEmployee) return false;

    // 3. Check specific module permission
    // If permissions object exists and module is explicitly set to true, allow.
    // Otherwise, deny.
    if (currentEmployee.permissions && (currentEmployee.permissions as Record<string, boolean>)[module] === true) {
      return true;
    }

    return false;
  };

  return (
    <ThemeProvider theme={settings.theme || 'dark'}>
      <div className={`flex h-screen font-sans overflow-hidden ${settings.theme === 'light'
        ? 'bg-[#F8F9FA] text-slate-800'
        : 'bg-slate-900 text-slate-100'
        }`}>
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 w-20'
            } fixed lg:relative h-full ${settings.theme === 'light'
              ? 'bg-white border-r border-slate-200 shadow-sm'
              : 'bg-slate-800 border-r border-slate-700'
            } transition-all duration-300 flex flex-col z-40 lg:z-20`}
        >
          {/* Header */}
          <div className={`p-4 flex items-center justify-between h-16 ${settings.theme === 'light'
            ? 'border-b border-slate-200'
            : 'border-b border-slate-700'
            }`}>
            {isSidebarOpen && <span className={`font-bold text-xl tracking-tight ${settings.theme === 'light' ? 'text-slate-800' : 'text-white'
              }`}>Metal ERP</span>}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded-lg transition-colors ${settings.theme === 'light'
                ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
                : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                }`}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {checkPermission('dashboard') && (
              <SidebarItem
                icon={<LayoutDashboard size={20} />}
                label="Дашборд"
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('inventory') && (
              <SidebarItem
                icon={<Package size={20} />}
                label="Склад"
                active={activeTab === 'inventory'}
                onClick={() => setActiveTab('inventory')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('import') && (
              <SidebarItem
                icon={<Container size={20} />}
                label="Закуп"
                active={activeTab === 'import'}
                onClick={() => setActiveTab('import')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('sales') && (
              <SidebarItem
                icon={<Wallet size={20} />}
                label="Касса"
                active={activeTab === 'sales'}
                onClick={() => setActiveTab('sales')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('workflow') && (
              <SidebarItem
                icon={<BookOpen size={20} />}
                label="Workflow"
                active={activeTab === 'workflow'}
                onClick={() => setActiveTab('workflow')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('reports') && (
              <SidebarItem
                icon={<FileText size={20} />}
                label="Отчеты"
                active={activeTab === 'reports'}
                onClick={() => setActiveTab('reports')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('crm') && (
              <SidebarItem
                icon={<Users size={20} />}
                label="Клиенты"
                active={activeTab === 'crm'}
                onClick={() => setActiveTab('crm')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('staff') && (
              <SidebarItem
                icon={<UserCircle2 size={20} />}
                label="Сотрудники"
                active={activeTab === 'staff'}
                onClick={() => setActiveTab('staff')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('payroll') && (
              <SidebarItem
                icon={<DollarSign size={20} />}
                label="Зарплата"
                active={activeTab === 'payroll'}
                onClick={() => setActiveTab('payroll')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('fixedAssets') && (
              <SidebarItem
                icon={<Landmark size={20} />}
                label="Осн. Средства"
                active={activeTab === 'fixedAssets'}
                onClick={() => setActiveTab('fixedAssets')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('balance') && (
              <SidebarItem
                icon={<BarChart3 size={20} />}
                label="Баланс"
                active={activeTab === 'balance'}
                onClick={() => setActiveTab('balance')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('journal') && (
              <SidebarItem
                icon={<Book size={20} />}
                label="Журнал"
                active={activeTab === 'journal'}
                onClick={() => setActiveTab('journal')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            {checkPermission('priceList') && (
              <SidebarItem
                icon={<FileText size={20} />}
                label="Прайс"
                active={activeTab === 'priceList'}
                onClick={() => setActiveTab('priceList')}
                isOpen={isSidebarOpen}
                onMobileClose={() => setIsSidebarOpen(false)}
                theme={settings.theme}
              />
            )}
            <div className="my-4 border-t border-slate-700 mx-4"></div>
            <SidebarItem
              icon={<Settings size={20} />}
              label="Настройки"
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              isOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
              theme={settings.theme}
            />
          </nav>

          {/* Footer */}
          <div className={`p-4 ${settings.theme === 'light'
            ? 'border-t border-slate-200 bg-slate-50'
            : 'border-t border-slate-700 bg-slate-800/50'
            }`}>
            {isSidebarOpen && (
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${settings.theme === 'light'
                  ? 'bg-[#1A73E8] text-white'
                  : 'bg-indigo-500 text-white'
                  }`}>
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className={`text-sm font-medium truncate ${settings.theme === 'light' ? 'text-slate-800' : 'text-white'
                    }`}>{user.displayName || 'Пользователь'}</p>
                  <p className={`text-xs truncate ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>{user.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={logout}
              className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} gap-3 p-2 rounded-lg transition-colors ${settings.theme === 'light'
                ? 'text-red-600 hover:bg-red-50'
                : 'text-red-400 hover:bg-red-500/10'
                }`}
              title="Выйти"
            >
              <LogOut size={20} />
              {isSidebarOpen && <span>Выйти</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative w-full lg:w-auto">
          {/* Header */}
          <header className={`h-16 flex items-center justify-between px-4 lg:px-6 z-10 ${settings.theme === 'light'
            ? 'bg-white border-b border-slate-200 shadow-sm'
            : 'bg-slate-800 border-b border-slate-700'
            }`}>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`lg:hidden p-2 rounded-lg transition-colors mr-2 ${settings.theme === 'light'
                ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
                : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                }`}
            >
              <Menu size={24} />
            </button>
            <h1 className={`text-lg lg:text-xl font-bold truncate ${settings.theme === 'light' ? 'text-slate-800' : 'text-white'
              }`}>
              {activeTab === 'dashboard' && 'Обзор показателей'}
              {activeTab === 'inventory' && 'Управление складом'}
              {activeTab === 'import' && 'Закуп и Импорт'}
              {activeTab === 'sales' && 'Касса и Расходы'}
              {activeTab === 'workflow' && 'Workflow заявки'}
              {activeTab === 'reports' && 'Финансовые Отчеты'}
              {activeTab === 'crm' && 'База Клиентов'}
              {activeTab === 'staff' && 'Управление Сотрудниками'}
              {activeTab === 'fixedAssets' && 'Основные Средства'}
              {activeTab === 'balance' && 'Управленческий Баланс'}
              {activeTab === 'settings' && 'Настройки системы'}
            </h1>

            <div className="flex items-center gap-2 lg:gap-4">
              {error && (
                <div className="text-red-400 text-xs lg:text-sm bg-red-500/10 px-2 lg:px-3 py-1 rounded-full border border-red-500/20 animate-pulse hidden sm:block">
                  {error}
                </div>
              )}



            </div>
          </header>

          {/* Content Area */}
          <div className={`flex-1 overflow-hidden relative ${settings.theme === 'light' ? 'bg-[#F8F9FA]' : 'bg-slate-900'
            }`}>
            {renderContent()}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isOpen: boolean;
  onMobileClose?: () => void;
  theme?: 'light' | 'dark';
}

const SidebarItem = ({ icon, label, active, onClick, isOpen, onMobileClose, theme = 'dark' }: SidebarItemProps) => {
  const handleClick = () => {
    onClick();
    // Close sidebar only on mobile/tablet (below lg)
    if (onMobileClose && window.matchMedia('(max-width: 1023px)').matches) {
      onMobileClose();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center ${isOpen ? 'justify-start px-4' : 'justify-center'} gap-3 py-3 transition-all relative group ${active
        ? theme === 'light'
          ? 'text-[#1A73E8] bg-blue-50 rounded-lg mx-2 font-medium'
          : 'text-white bg-gradient-to-r from-indigo-600/20 to-transparent border-r-2 border-indigo-500'
        : theme === 'light'
          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg mx-2'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      title={!isOpen ? label : ''}
    >
      <div className={`${active ? (theme === 'light' ? 'text-[#1A73E8]' : 'text-indigo-400') : ''} `}>{icon}</div>
      {isOpen && <span className="font-medium">{label}</span>}
      {!isOpen && (
        <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700 shadow-xl">
          {label}
        </div>
      )}
    </button>
  );
};

const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <ConfirmProvider>
            <AppContent />
            <TokenExpiryWarning />
            <OfflineIndicator />
          </ConfirmProvider>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
