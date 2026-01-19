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
import { sheetsService } from './services/sheetsService';
import { SUPER_ADMIN_EMAILS, IS_DEV_MODE } from './constants';
import { getErrorMessage } from './utils/errorHandler';
import { validateAccessToken, isTokenExpiredError, logTokenStatus } from './utils/tokenHelper';
import { telegramService } from './services/telegramService';
import { calculateBaseTotals } from './utils/finance';
import { useSaveHandler, createSaveHandlerFactory } from './hooks/useSaveHandler';
import { useConflictHandler } from './hooks/useConflictHandler';

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

const AppContent: React.FC = () => {
  const { user, logout, accessToken, refreshAccessToken } = useAuth();
  const toast = useToast();
  
  // Настраиваем глобальный обработчик конфликтов версий
  useConflictHandler();
  
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
  const [products, setProducts] = useState<Product[]>([]);
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

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [journalEvents, setJournalEvents] = useState<JournalEvent[]>([]);
  const [workflowOrders, setWorkflowOrders] = useState<WorkflowOrder[]>([]);

  // Initialize Save Handlers using the universal hook
  const saveHandlerFactory = createSaveHandlerFactory(
    () => accessToken,
    refreshAccessToken
  );

  const saveProductsHandler = saveHandlerFactory<Product>('Товары', (data) => sheetsService.saveAllProducts(accessToken!, data));
  const saveOrdersHandler = async (newOrders: Order[]) => {
      // Legacy handler replacement
      // If the component tries to save All orders, we might ignore or adapt
      // Ideally components should use addOrder/updateOrder instead of saving the whole array
      console.warn('Full orders save requested - ignored in Firebase mode');
      // We could use this to trigger migration if needed?
      return true; 
  };
  // const saveOrdersHandler = saveHandlerFactory<Order>('Заказы', (data) => sheetsService.saveAllOrders(accessToken!, data));
  const saveExpensesHandler = saveHandlerFactory<Expense>('Расходы', (data) => sheetsService.saveAllExpenses(accessToken!, data));
  const saveFixedAssetsHandler = saveHandlerFactory<FixedAsset>('Основные средства', (data) => sheetsService.saveAllFixedAssets(accessToken!, data));
  const saveClientsHandler = saveHandlerFactory<Client>('Клиенты', (data) => sheetsService.saveAllClients(accessToken!, data));
  const saveEmployeesHandler = saveHandlerFactory<Employee>('Сотрудники', (data) => sheetsService.saveAllEmployees(accessToken!, data));
  const saveTransactionsHandler = saveHandlerFactory<Transaction>('Транзакции', (data) => sheetsService.saveAllTransactions(accessToken!, data));
  const savePurchasesHandler = saveHandlerFactory<Purchase>('Закупки', (data) => sheetsService.saveAllPurchases(accessToken!, data));
  const saveWorkflowOrdersHandler = saveHandlerFactory<WorkflowOrder>('Предзаказы', (data) => sheetsService.saveAllWorkflowOrders(accessToken!, data));
  const saveJournalEventsHandler = saveHandlerFactory<JournalEvent>('Журнал', (data) => sheetsService.addJournalEvent(accessToken!, data[0]));
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('metal_erp_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure expenseCategories exist (fallback for old saved settings)
        if (!parsed.expenseCategories || parsed.expenseCategories.length === 0) {
          parsed.expenseCategories = DEFAULT_EXPENSE_CATEGORIES;
        }
        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch (e) {
      errorDev("Failed to parse settings", e);
      return defaultSettings;
    }
  });

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
    if (user && accessToken) {
      loadData();
    }
  }, [user, accessToken]);

  // Save Settings
  useEffect(() => {
    localStorage.setItem('metal_erp_settings', JSON.stringify(settings));
  }, [settings]);

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('metal_erp_sidebar_open', String(isSidebarOpen));
    } catch {
      // ignore
    }
  }, [isSidebarOpen]);

  // Recalculate client debt based on transactions
  const recalculateClientDebts = (clients: Client[], transactions: Transaction[], orders: Order[]): Client[] => {
    return clients.map(client => {
      let calculatedDebt = 0;
      const clientName = (client.name || '').toLowerCase().trim();
      const companyName = (client.companyName || '').toLowerCase().trim();

      // Найти ВСЕ заказы клиента, которые имеют неоплаченный остаток
      // (debt, unpaid, partial - любые заказы где есть остаток)
      const clientOrders = orders.filter(o => {
        const orderClientName = (o.customerName || '').toLowerCase().trim();
        const matchesClient = o.clientId === client.id || 
                orderClientName === clientName ||
                (clientName && orderClientName.includes(clientName)) ||
                (clientName && clientName.includes(orderClientName)) ||
                (companyName && orderClientName.includes(companyName)) ||
                (companyName && companyName.includes(orderClientName));
        
        // Заказ в долг если: явно debt/unpaid/partial ИЛИ есть остаток (totalAmount > amountPaid)
        const hasUnpaidBalance = ((o.totalAmount || 0) - (o.amountPaid || 0)) > 0.01;
        const isDebtPayment = o.paymentMethod === 'debt' || 
                              o.paymentStatus === 'unpaid' || 
                              o.paymentStatus === 'partial';
        
        return matchesClient && (isDebtPayment || hasUnpaidBalance);
      });
      const clientOrderIds = clientOrders.map(o => o.id.toLowerCase());

      // Считаем долг ИЗ ЗАКАЗОВ (только неоплаченную часть!)
      clientOrders.forEach(order => {
        // Долг = общая сумма - уже оплачено (amountPaid в USD)
        const paidUSD = order.amountPaid || 0;
        const openAmount = (order.totalAmount || 0) - paidUSD;
        calculatedDebt += Math.max(0, openAmount);
      });

      // Также добавляем долг из транзакций debt_obligation (для старых данных)
      // НО только если они НЕ связаны с заказами которые уже посчитаны
      const debtTransactions = transactions.filter(t => {
        if (t.type !== 'debt_obligation') return false;
        const desc = (t.description || '').toLowerCase();
        const matchesClient = t.relatedId === client.id ||
          (clientName && desc.includes(clientName)) ||
          (companyName && desc.includes(companyName));
        // Исключаем если это долг по заказу который уже посчитан
        const relatedToExistingOrder = clientOrderIds.some(orderId => 
          desc.includes(orderId) || t.relatedId?.toLowerCase() === orderId
        );
        return matchesClient && !relatedToExistingOrder;
      });
      debtTransactions.forEach(t => {
        calculatedDebt += t.amount;
      });

      // Вычитаем погашения (client_payment) ТОЛЬКО для debt_obligation транзакций
      // Погашения для заказов уже учтены в amountPaid заказа!
      // Ищем погашения которые относятся к клиенту напрямую (не к заказу)
      const debtTxIds = debtTransactions.map(t => t.id.toLowerCase());
      const paymentTransactions = transactions.filter(t => {
        const desc = (t.description || '').toLowerCase();
        const relatedIdLower = (t.relatedId || '').toLowerCase();
        const isPayment = t.type === 'client_payment' || (t.type === 'income' && desc.includes('погашение'));
        
        // Погашение относится к клиенту напрямую (relatedId = clientId)
        // и НЕ к конкретному заказу (иначе amountPaid заказа уже учтено)
        const isForClientDirectly = t.relatedId === client.id;
        const isForDebtObligation = debtTxIds.includes(relatedIdLower);
        const isForKnownOrder = clientOrderIds.includes(relatedIdLower);
        
        // Учитываем только если:
        // 1. Связано с клиентом напрямую
        // 2. ИЛИ связано с debt_obligation транзакцией
        // 3. И НЕ связано с заказом (заказы используют amountPaid)
        return isPayment && (isForClientDirectly || isForDebtObligation) && !isForKnownOrder;
      });
      paymentTransactions.forEach(t => {
        // Convert to USD if needed
        let amountUSD = t.amount;
        if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
          amountUSD = t.amount / t.exchangeRate;
        }
        calculatedDebt -= amountUSD;
      });

      // Also check for client returns that reduce debt
      const returnTransactions = transactions.filter(t =>
        t.type === 'client_return' && (t as any).method === 'debt' && t.relatedId === client.id
      );
      returnTransactions.forEach(t => {
        let amountUSD = t.amount;
        if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
          amountUSD = t.amount / t.exchangeRate;
        }
        calculatedDebt -= amountUSD;
      });

      return {
        ...client,
        totalDebt: Math.max(0, calculatedDebt) // Ensure debt is never negative
      };
    });
  };

  // Вычисление балансов кассы
  const balances = React.useMemo(() => {
    return calculateBaseTotals(orders, transactions, expenses, settings.defaultExchangeRate);
  }, [orders, transactions, expenses, settings.defaultExchangeRate]);

  // Combine journal events with auto-corrections for the Journal view
  const allJournalEvents = React.useMemo(() => {
    const correctionEvents = (balances.corrections || []).map(c => ({
      id: `auto-fix-${c.id}`,
      date: new Date().toISOString(), // Using current date as placeholder
      type: 'system',
      module: 'finance',
      action: 'Авто-коррекция',
      description: `Исправлена ошибка: ${c.reason}. ${c.type} #${c.id}: ${c.originalAmount} -> ${c.correctedAmount}`,
      employeeName: 'System Auto-Fix'
    }));

    return [...journalEvents, ...correctionEvents as any[]].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [journalEvents, balances.corrections]);

  const loadData = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);

    // Сохраняем текущие данные на случай ошибки
    const currentData = {
      products,
      // orders теперь в Firebase
      expenses,
      fixedAssets,
      clients,
      employees,
      transactions,
      purchases,
      journalEvents,
      workflowOrders
    };

    try {
      await sheetsService.initialize(accessToken);

      // Загружаем данные с обработкой ошибок для каждого типа отдельно
      const loadWithFallback = async <T,>(
        loader: () => Promise<T[]>,
        current: T[],
        name: string
      ): Promise<T[]> => {
        try {
          const loaded = await loader();
          // ВАЖНО: Всегда используем загруженные данные, если загрузка прошла успешно
          // Это гарантирует синхронизацию между устройствами
          // Если загруженные данные пустые - это нормально (таблица может быть пустой)
          logDev(`✅ ${name}: загружено ${loaded.length} записей из Google Sheets`);
          return loaded;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isAuthError = errorMessage.includes('UNAUTHENTICATED') ||
            errorMessage.includes('401') ||
            errorMessage.includes('токен доступа истек');

          errorDev(`❌ Ошибка загрузки ${name}: `, error);

          // При ошибке аутентификации НЕ заменяем данные на пустой массив
          // Это критично для защиты от потери данных при истечении токена
          if (isAuthError && current.length > 0) {
            warnDev(`🔒 ${name}: ошибка аутентификации, сохраняем текущие данные(${current.length} записей)`);
            return current;
          }

          // При других ошибках возвращаем текущие данные, если они есть
          // Это защищает от потери данных при временных проблемах с сетью
          if (current.length > 0) {
            logDev(`📦 ${name}: используем текущие данные(${current.length} записей) из - за ошибки загрузки`);
            return current;
          }

          // Если текущих данных нет и произошла ошибка - возвращаем пустой массив
          // Это нормально для первого входа, когда данных еще нет
          warnDev(`⚠️ ${name}: нет данных и ошибка загрузки, возвращаем пустой массив`);
          return [];
        }
      };

      const [loadedProducts, loadedExpenses, loadedAssets, loadedClients, loadedEmployees, loadedTransactions, loadedPurchases, loadedJournalEvents, loadedWorkflowOrders] = await Promise.allSettled([
        loadWithFallback(() => sheetsService.getProducts(accessToken), currentData.products, 'Products'),
        // Orders are handled via useOrders hook
        loadWithFallback(() => sheetsService.getExpenses(accessToken), currentData.expenses, 'Expenses'),
        loadWithFallback(() => sheetsService.getFixedAssets(accessToken), currentData.fixedAssets, 'FixedAssets'),
        loadWithFallback(() => sheetsService.getClients(accessToken), currentData.clients, 'Clients'),
        loadWithFallback(() => sheetsService.getEmployees(accessToken), currentData.employees, 'Employees'),
        loadWithFallback(() => sheetsService.getTransactions(accessToken), currentData.transactions, 'Transactions'),
        loadWithFallback(() => sheetsService.getPurchases(accessToken), currentData.purchases, 'Purchases'),
        loadWithFallback(() => sheetsService.getJournalEvents(accessToken), currentData.journalEvents, 'JournalEvents'),
        loadWithFallback(() => sheetsService.getWorkflowOrders(accessToken), currentData.workflowOrders, 'WorkflowOrders')
      ]);

      // Обрабатываем результаты Promise.allSettled
      const getResult = <T,>(result: PromiseSettledResult<T[]>, current: T[], name: string): T[] => {
        if (result.status === 'fulfilled') {
          // Всегда используем успешно загруженные данные для синхронизации между устройствами
          return result.value;
        }
        errorDev(`❌ Ошибка загрузки ${name}: `, result.reason);
        // При ошибке используем текущие данные, если они есть
        // Это защищает от потери данных при временных проблемах
        if (current.length > 0) {
          logDev(`📦 ${name}: используем текущие данные(${current.length} записей) из - за ошибки`);
          return current;
        }
        // Если данных нет - возвращаем пустой массив
        return [];
      };

      const finalProducts = getResult(loadedProducts, currentData.products, 'Products');
      // const finalOrders = getResult(loadedOrders, currentData.orders, 'Orders');
      const finalExpenses = getResult(loadedExpenses, currentData.expenses, 'Expenses');
      const finalAssets = getResult(loadedAssets, currentData.fixedAssets, 'FixedAssets');
      const finalClients = getResult(loadedClients, currentData.clients, 'Clients');
      const finalEmployees = getResult(loadedEmployees, currentData.employees, 'Employees');
      const finalTransactions = getResult(loadedTransactions, currentData.transactions, 'Transactions');
      const finalPurchases = getResult(loadedPurchases, currentData.purchases, 'Purchases');
      const finalJournalEvents = getResult(loadedJournalEvents, currentData.journalEvents, 'JournalEvents');
      const finalWorkflowOrders = getResult(loadedWorkflowOrders, currentData.workflowOrders, 'WorkflowOrders');

      // ВАЖНО: Пересчитываем долги клиентов на основе заказов и транзакций
      // Это гарантирует корректность данных после загрузки из Google Sheets
      const clientsWithRecalculatedDebts = recalculateClientDebts(finalClients, finalTransactions, orders); // Use fetched orders from hook

      // Обновляем состояние только если есть изменения
      setProducts(finalProducts);
      // setOrders(finalOrders); - Removed
      setExpenses(finalExpenses);
      setFixedAssets(finalAssets);
      setClients(clientsWithRecalculatedDebts);
      setEmployees(finalEmployees);
      setTransactions(finalTransactions);
      setPurchases(finalPurchases);
      setJournalEvents(finalJournalEvents);
      setWorkflowOrders(finalWorkflowOrders);

      // AUTO-MIGRATE: Orders from Google Sheets to Firebase
      // Only if Firebase has fewer orders than Sheets
      try {
        const sheetsOrders = await sheetsService.getOrders(accessToken, false);
        if (sheetsOrders.length > orders.length) {
          logDev(`📦 Миграция заказов: Sheets=${sheetsOrders.length}, Firebase=${orders.length}`);
          const migrated = await migrateLegacyOrders(sheetsOrders);
          if (migrated > 0) {
            logDev(`✅ Мигрировано ${migrated} заказов из Google Sheets в Firebase`);
            toast.success(`Мигрировано ${migrated} заказов в Firebase`);
          }
        }
      } catch (migErr) {
        warnDev('⚠️ Не удалось мигрировать заказы:', migErr);
      }
      
      // Сохраняем пересчитанные долги в Google Sheets (если они изменились)
      const debtsChanged = clientsWithRecalculatedDebts.some((c, i) => 
        c.totalDebt !== finalClients[i]?.totalDebt
      );
      if (debtsChanged && clientsWithRecalculatedDebts.length > 0) {
        logDev('📊 Долги клиентов пересчитаны, сохраняем...');
        saveClientsHandler(clientsWithRecalculatedDebts).catch(err => 
          warnDev('⚠️ Не удалось сохранить пересчитанные долги:', err)
        );
      }

      // Проверяем, были ли ошибки при загрузке
      const hasErrors = [
        loadedProducts, loadedExpenses, loadedAssets,
        loadedClients, loadedEmployees, loadedTransactions, loadedPurchases, loadedJournalEvents, loadedWorkflowOrders
      ].some(result => result.status === 'rejected');

      if (hasErrors) {
        toast.warning('Некоторые данные не удалось загрузить. Используются локальные данные.');
      }
    } catch (err: unknown) {
      errorDev('❌ Критическая ошибка при загрузке данных:', err);
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      // Проверяем, есть ли текущие данные
      const hasCurrentData = currentData.products.length > 0 || orders.length > 0 || currentData.clients.length > 0;
      if (hasCurrentData) {
        toast.warning(`Не удалось обновить данные: ${errorMessage}. Используются локальные данные.`);
      } else {
        toast.error(`Ошибка при загрузке данных: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        saveProductsHandler(products).then(() => ({ name: 'Товары', success: true })),
        saveOrdersHandler(orders).then(() => ({ name: 'Заказы', success: true })),
        saveExpensesHandler(expenses).then(() => ({ name: 'Расходы', success: true })),
        saveFixedAssetsHandler(fixedAssets).then(() => ({ name: 'Основные средства', success: true })),
        saveClientsHandler(clients).then(() => ({ name: 'Клиенты', success: true })),
        saveEmployeesHandler(employees).then(() => ({ name: 'Сотрудники', success: true })),
        saveTransactionsHandler(transactions).then(() => ({ name: 'Транзакции', success: true })),
        savePurchasesHandler(purchases).then(() => ({ name: 'Закупки', success: true })),
        saveWorkflowOrdersHandler(workflowOrders).then(() => ({ name: 'Предзаказы', success: true }))
      ]);

      const failed = (results as any[])
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
        .map(r => r.status === 'rejected' ? 'Сетевая ошибка' : r.value.name);

      if (failed.length === 0) {
        toast.success(`Все данные успешно синхронизированы (${results.length} модулей)`);
      } else {
        toast.warning(`Сохранено с ошибками: ${failed.join(', ')}`);
      }
    } catch (err) {
      errorDev('Save All failed', err);
      toast.error('Произошла ошибка при массовом сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (newExpense: Expense) => {
    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);

    const success = await saveExpensesHandler(updatedExpenses);
    if (success) {
      // Telegram notification
      sendTelegramMoneyEvent({
        type: 'expense',
        amount: safeNumber(newExpense.amount),
        currency: newExpense.currency || 'USD',
        method: newExpense.paymentMethod,
        description: newExpense.description,
        id: newExpense.id,
        date: newExpense.date
      });
    }
  };

  const handleSaveEmployees = async (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    await saveEmployeesHandler(newEmployees);
  };

  const handleSavePurchases = async (newPurchases: Purchase[]) => {
    const prevIds = new Set(purchases.map(p => p.id));
    const addedPurchases = newPurchases.filter(p => !prevIds.has(p.id));

    setPurchases(newPurchases);
    const success = await savePurchasesHandler(newPurchases);

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
    setClients(newClients);
    await saveClientsHandler(newClients);
  };

  const handleSaveExpenses = async (newExpenses: Expense[]) => {
    const prevIds = new Set(expenses.map(e => e.id));
    const addedExpenses = newExpenses.filter(e => !prevIds.has(e.id));

    setExpenses(newExpenses);
    const success = await saveExpensesHandler(newExpenses);

    if (success) {
      addedExpenses.forEach(exp =>
        sendTelegramMoneyEvent({
          type: 'expense',
          amount: safeNumber(exp.amount),
          currency: exp.currency || 'USD',
          method: exp.paymentMethod,
          description: exp.description,
          id: exp.id,
          date: exp.date
        })
      );
    }
  };

  const handleSaveFixedAssets = async (newAssets: FixedAsset[]) => {
    setFixedAssets(newAssets);
    await saveFixedAssetsHandler(newAssets);
  };

  const handleSaveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    await saveProductsHandler(newProducts);
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
    setWorkflowOrders(newWorkflowOrders);
    return await saveWorkflowOrdersHandler(newWorkflowOrders);
  };

  const handleSaveTransactions = async (newTransactions: Transaction[]) => {
    const prevIds = new Set(transactions.map(t => t.id));
    const addedTransactions = newTransactions.filter(t => !prevIds.has(t.id));

    setTransactions(newTransactions);
    const success = await saveTransactionsHandler(newTransactions);

    if (success) {
      addedTransactions.forEach(t => {
        if (t.type === 'supplier_payment' || t.type === 'client_payment') {
          sendTelegramMoneyEvent({
            type: t.type === 'supplier_payment' ? 'supplier_payment' : 'client_payment',
            amount: safeNumber(t.amount),
            currency: t.currency,
            method: t.method,
            counterparty: t.relatedId,
            description: t.description,
            id: t.id,
            date: t.date
          });
        }
      });
      return true;
    }
    return false;
  };

  const handleAddJournalEvent = async (event: JournalEvent) => {
    setJournalEvents(prev => [event, ...prev]);
    await saveJournalEventsHandler([event]);
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Save to localStorage for persistence
    localStorage.setItem('metal_erp_settings', JSON.stringify(newSettings));

    // Also try to save to Google Sheets if possible (optional, but good for sync)
    // For now, local storage is enough for Telegram tokens as they are device-specific or sensitive
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
        return renderLazyComponent(<Inventory products={products} setProducts={setProducts} onSaveProducts={handleSaveProducts} />);
      case 'import':
        return renderLazyComponent(<Procurement
          products={products}
          setProducts={setProducts}
          settings={settings}
          purchases={purchases}
          onSavePurchases={handleSavePurchases}
          transactions={transactions}
          setTransactions={setTransactions}
          workflowOrders={workflowOrders}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          onSaveProducts={handleSaveProducts}
          onSaveTransactions={handleSaveTransactions}
          balances={balances}
        />);
      case 'journal':
        return renderLazyComponent(<JournalEventsView events={allJournalEvents} />);
      case 'sales':
        return renderLazyComponent(<Sales
          products={products}
          setProducts={setProducts}
          orders={orders}
          setOrders={setOrders}
          settings={settings}
          setSettings={setSettings}
          expenses={expenses}
          setExpenses={setExpenses}
          employees={employees}
          onNavigateToStaff={() => setActiveTab('staff')}
          clients={clients}
          onSaveClients={handleSaveClients}
          transactions={transactions}
          setTransactions={setTransactions}
          workflowOrders={workflowOrders}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          currentUserEmail={user?.email}
          onNavigateToProcurement={() => setActiveTab('import')}
          onSaveOrders={handleSaveOrders}
          onSaveTransactions={handleSaveTransactions}
          onSaveProducts={handleSaveProducts}
          onSaveExpenses={handleSaveExpenses}
          onAddJournalEvent={handleAddJournalEvent}
        />);
      case 'workflow':
        return renderLazyComponent(<Workflow
          products={products}
          setProducts={setProducts}
          workflowOrders={workflowOrders}
          setWorkflowOrders={setWorkflowOrders}
          orders={orders}
          setOrders={setOrders}
          clients={clients}
          onSaveClients={handleSaveClients}
          transactions={transactions}
          setTransactions={setTransactions}
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
        return renderLazyComponent(<Reports orders={orders} expenses={expenses} products={products} purchases={purchases} settings={settings} transactions={transactions} onAddExpense={handleAddExpense} />);
      case 'fixedAssets':
        return renderLazyComponent(<FixedAssets
          assets={fixedAssets}
          setAssets={setFixedAssets}
          onSaveAssets={handleSaveFixedAssets}
          transactions={transactions}
          setTransactions={setTransactions}
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
          setTransactions={setTransactions}
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

  const checkPermission = (module: keyof typeof settings.modules) => {
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
    if (currentEmployee.permissions && currentEmployee.permissions[module] === true) {
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
            <SidebarItem
              icon={<Package size={20} />}
              label="Склад"
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              isOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
              theme={settings.theme}
            />
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
            {checkPermission('staff') && (
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
            <SidebarItem
              icon={<FileText size={20} />}
              label="Прайс"
              active={activeTab === 'priceList'}
              onClick={() => setActiveTab('priceList')}
              isOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
              theme={settings.theme}
            />
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

              {activeTab !== 'settings' && (
                <button
                  onClick={handleSaveAll}
                  disabled={isLoading || !accessToken}
                  className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-2 rounded-lg font-medium transition-all text-sm lg:text-base ${isLoading
                    ? settings.theme === 'light'
                      ? 'bg-slate-200 text-slate-500 cursor-wait'
                      : 'bg-slate-700 text-slate-400 cursor-wait'
                    : !accessToken
                      ? settings.theme === 'light'
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                        : 'bg-slate-600 text-slate-300 cursor-not-allowed opacity-60'
                      : settings.theme === 'light'
                        ? 'bg-[#1A73E8] hover:bg-[#1557B0] text-white shadow-md'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                    }`}
                  title={!accessToken ? 'Войдите в систему для сохранения в Google Sheets' : 'Сохранить в Google Sheets'}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">
                    {isLoading ? 'Сохранение...' : !accessToken ? 'Требуется вход' : 'Сохранить в Google Sheets'}
                  </span>
                  <span className="sm:hidden">{isLoading ? '...' : !accessToken ? '🔒' : '💾'}</span>
                </button>
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
