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
  Book
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

import { Login } from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { Product, Order, AppSettings, Expense, FixedAsset, Client, Employee, Transaction, Purchase, JournalEvent, WorkflowOrder } from './types';
import { sheetsService } from './services/sheetsService';
import { SUPER_ADMIN_EMAILS, IS_DEV_MODE } from './constants';
import { getErrorMessage } from './utils/errorHandler';
import { validateAccessToken, isTokenExpiredError, logTokenStatus } from './utils/tokenHelper';
import { telegramService } from './services/telegramService';

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

const AppContent: React.FC = () => {
  const { user, logout, accessToken } = useAuth();
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
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [journalEvents, setJournalEvents] = useState<JournalEvent[]>([]);
  const [workflowOrders, setWorkflowOrders] = useState<WorkflowOrder[]>([]);
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
    method?: 'cash' | 'bank' | 'card' | 'debt';
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
  const recalculateClientDebts = (clients: Client[], transactions: Transaction[]): Client[] => {
    return clients.map(client => {
      let calculatedDebt = 0;

      // Sum all debt_obligation transactions for this client
      const debtTransactions = transactions.filter(t =>
        t.type === 'debt_obligation' && t.relatedId === client.id
      );
      debtTransactions.forEach(t => {
        calculatedDebt += t.amount; // debt_obligation always in USD
      });

      // Subtract all client_payment transactions for this client
      const paymentTransactions = transactions.filter(t =>
        t.type === 'client_payment' && t.relatedId === client.id
      );
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
        t.type === 'client_return' && t.method === 'debt' && t.relatedId === client.id
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

  const loadData = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);

    // Сохраняем текущие данные на случай ошибки
    const currentData = {
      products,
      orders,
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

      const [loadedProducts, loadedOrders, loadedExpenses, loadedAssets, loadedClients, loadedEmployees, loadedTransactions, loadedPurchases, loadedJournalEvents, loadedWorkflowOrders] = await Promise.allSettled([
        loadWithFallback(() => sheetsService.getProducts(accessToken), currentData.products, 'Products'),
        loadWithFallback(() => sheetsService.getOrders(accessToken), currentData.orders, 'Orders'),
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
      const finalOrders = getResult(loadedOrders, currentData.orders, 'Orders');
      const finalExpenses = getResult(loadedExpenses, currentData.expenses, 'Expenses');
      const finalAssets = getResult(loadedAssets, currentData.fixedAssets, 'FixedAssets');
      const finalClients = getResult(loadedClients, currentData.clients, 'Clients');
      const finalEmployees = getResult(loadedEmployees, currentData.employees, 'Employees');
      const finalTransactions = getResult(loadedTransactions, currentData.transactions, 'Transactions');
      const finalPurchases = getResult(loadedPurchases, currentData.purchases, 'Purchases');
      const finalJournalEvents = getResult(loadedJournalEvents, currentData.journalEvents, 'JournalEvents');
      const finalWorkflowOrders = getResult(loadedWorkflowOrders, currentData.workflowOrders, 'WorkflowOrders');

      // Recalculate client debts based on transactions to ensure accuracy
      const clientsWithRecalculatedDebts = recalculateClientDebts(finalClients, finalTransactions);

      // Обновляем состояние только если есть изменения
      setProducts(finalProducts);
      setOrders(finalOrders);
      setExpenses(finalExpenses);
      setFixedAssets(finalAssets);
      setClients(clientsWithRecalculatedDebts);
      setEmployees(finalEmployees);
      setTransactions(finalTransactions);
      setPurchases(finalPurchases);
      setJournalEvents(finalJournalEvents);
      setWorkflowOrders(finalWorkflowOrders);

      // Проверяем, были ли ошибки при загрузке
      const hasErrors = [
        loadedProducts, loadedOrders, loadedExpenses, loadedAssets,
        loadedClients, loadedEmployees, loadedTransactions, loadedPurchases, loadedJournalEvents, loadedWorkflowOrders
      ].some(result => result.status === 'rejected');

      if (hasErrors) {
        toast.warning('Некоторые данные не удалось загрузить. Используются локальные данные.');
      }

      // If debts were recalculated and differ from saved values, save updated clients
      const debtsChanged = clientsWithRecalculatedDebts.some((client, index) =>
        Math.abs((client.totalDebt || 0) - (finalClients[index]?.totalDebt || 0)) > 0.01
      );
      if (debtsChanged) {
        logDev('🔄 Долги клиентов пересчитаны на основе транзакций, сохраняем обновленные данные...');
        await sheetsService.saveAllClients(accessToken, clientsWithRecalculatedDebts);
      }
    } catch (err: unknown) {
      errorDev('❌ Критическая ошибка при загрузке данных:', err);
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      // Проверяем, есть ли текущие данные
      const hasCurrentData = currentData.products.length > 0 || currentData.orders.length > 0 || currentData.clients.length > 0;
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
    // Проверяем токен перед сохранением
    logTokenStatus(accessToken, 'before saveAll');

    if (!validateAccessToken(accessToken)) {
      toast.error('Токен доступа отсутствует. Пожалуйста, войдите заново.');
      return;
    }

    setIsLoading(true);
    const results: { success: boolean; name: string; error?: string }[] = [];

    try {
      // Используем Promise.allSettled чтобы сохранить все возможные данные даже при ошибках
      const saveResults = await Promise.allSettled([
        sheetsService.saveAllProducts(accessToken!, products).then(() => ({ name: 'Товары', success: true })),
        sheetsService.saveAllOrders(accessToken!, orders).then(() => ({ name: 'Заказы', success: true })),
        sheetsService.saveAllExpenses(accessToken!, expenses).then(() => ({ name: 'Расходы', success: true })),
        sheetsService.saveAllFixedAssets(accessToken!, fixedAssets).then(() => ({ name: 'Основные средства', success: true })),
        sheetsService.saveAllClients(accessToken!, clients).then(() => ({ name: 'Клиенты', success: true })),
        sheetsService.saveAllEmployees(accessToken!, employees).then(() => ({ name: 'Сотрудники', success: true })),
        sheetsService.saveAllTransactions(accessToken!, transactions).then(() => ({ name: 'Транзакции', success: true })),
        sheetsService.saveAllPurchases(accessToken!, purchases).then(() => ({ name: 'Закупки', success: true })),
        sheetsService.saveAllWorkflowOrders(accessToken!, workflowOrders).then(() => ({ name: 'Workflow', success: true }))
      ]);

      // Обрабатываем результаты
      saveResults.forEach((result, index) => {
        const names = ['Товары', 'Заказы', 'Расходы', 'Основные средства', 'Клиенты', 'Сотрудники', 'Транзакции', 'Закупки', 'Workflow'];
        if (result.status === 'fulfilled') {
          results.push({ success: true, name: names[index] });
        } else {
          const errorMsg = getErrorMessage(result.reason);
          results.push({ success: false, name: names[index], error: errorMsg });
          errorDev(`❌ Ошибка сохранения ${names[index]}: `, result.reason);

          // Если ошибка связана с токеном, предлагаем перелогиниться
          if (isTokenExpiredError(result.reason)) {
            warnDev(`⚠️ Токен истек при сохранении ${names[index]} `);
          }
        }
      });

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      // Проверяем, есть ли ошибки связанные с токеном
      const hasTokenErrors = results.some(r => !r.success && r.error && isTokenExpiredError(new Error(r.error)));

      if (hasTokenErrors) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново и попробуйте сохранить снова.');
      } else if (failCount === 0) {
        toast.success(`Все данные успешно сохранены в Google Sheets!(${successCount} модулей)`);
      } else if (successCount > 0) {
        const failedNames = results.filter(r => !r.success).map(r => r.name).join(', ');
        toast.warning(`Сохранено ${successCount} из ${results.length} модулей.Ошибки: ${failedNames} `);
      } else {
        const errorMessages = results.filter(r => !r.success).map(r => `${r.name}: ${r.error} `).join('; ');
        toast.error(`Не удалось сохранить данные: ${errorMessages} `);
      }
    } catch (err) {
      errorDev('❌ Критическая ошибка при сохранении:', err);
      const errorMessage = getErrorMessage(err);

      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении данных: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (newExpense: Expense) => {
    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);
    // Save to Google Sheets
    // Save to Google Sheets
    if (accessToken) {
      try {
        await sheetsService.saveAllExpenses(accessToken, updatedExpenses);
      } catch (err) {
        errorDev('Ошибка при сохранении расхода:', err);
        const errorMessage = getErrorMessage(err);
        if (isTokenExpiredError(err)) {
          toast.error('Сессия истекла. Пожалуйста, войдите заново.');
        } else {
          toast.warning(`Расход добавлен локально, но не удалось сохранить в Google Sheets: ${errorMessage} `);
        }
      }
    }

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
  };

  const handleSaveEmployees = async (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return;
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllEmployees(accessToken, newEmployees);
    } catch (err) {
      errorDev(err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении сотрудников: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePurchases = async (newPurchases: Purchase[]) => {
    logDev(`📦 handleSavePurchases called with ${newPurchases.length} purchases`);
    const prevIds = new Set(purchases.map(p => p.id));
    const addedPurchases = newPurchases.filter(p => !prevIds.has(p.id));

    setPurchases(newPurchases);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return;
    }
    setIsLoading(true);
    try {
      logDev('💾 Calling sheetsService.saveAllPurchases...');
      await sheetsService.saveAllPurchases(accessToken, newPurchases);
      logDev('✅ Purchases saved successfully to Google Sheets');

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
    } catch (err) {
      errorDev('❌ Error saving purchases:', err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении закупок: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClients = async (newClients: Client[]) => {
    logDev('💾 Saving clients to Google Sheets:', newClients.map(c => ({ name: c.name, totalDebt: c.totalDebt })));
    setClients(newClients);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return;
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllClients(accessToken, newClients);
      logDev('✅ Clients saved successfully!');
    } catch (err) {
      errorDev('❌ Error saving clients:', err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении клиентов: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExpenses = async (newExpenses: Expense[]) => {
    const prevIds = new Set(expenses.map(e => e.id));
    const addedExpenses = newExpenses.filter(e => !prevIds.has(e.id));

    setExpenses(newExpenses);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return;
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllExpenses(accessToken, newExpenses);

      // Telegram notifications for newly added expenses
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
    } catch (err) {
      errorDev(err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении расходов: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFixedAssets = async (newAssets: FixedAsset[]) => {
    setFixedAssets(newAssets);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return;
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllFixedAssets(accessToken, newAssets);
    } catch (err) {
      errorDev(err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении основных средств: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProducts = async (newProducts: Product[]) => {
    logDev(`📦 handleSaveProducts called with ${newProducts.length} products`);
    setProducts(newProducts);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return;
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllProducts(accessToken, newProducts);
      logDev(`✅ Products saved successfully to Google Sheets`);
    } catch (err) {
      errorDev(err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении товаров: ${errorMessage} `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOrders = async (newOrders: Order[]) => {
    const prevIds = new Set(orders.map(o => o.id));
    const addedOrders = newOrders.filter(o => !prevIds.has(o.id));

    logDev('💾 Saving orders to Google Sheets:', newOrders.length, 'orders');
    logDev('📋 Orders details:', newOrders.map(o => ({
      id: o.id,
      customer: o.customerName,
      total: o.totalAmount,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus
    })));

    logTokenStatus(accessToken, 'before saveOrders');

    setOrders(newOrders);

    // Проверяем токен
    if (!validateAccessToken(accessToken)) {
      warnDev('⚠️ Access token not available, order saved locally only');
      toast.warning('Заказ сохранен локально. Войдите заново для сохранения в Google Sheets.');
      return false; // Saved locally but not in Sheets
    }

    // Дополнительная проверка: если токен есть, но он может быть невалидным
    const currentToken = localStorage.getItem('google_access_token');
    if (!currentToken || currentToken !== accessToken) {
      warnDev('⚠️ Токен в localStorage не совпадает с токеном в состоянии');
      toast.warning('Проблема с токеном доступа. Войдите заново.');
      return false;
    }

    setIsLoading(true);
    try {
      await sheetsService.saveAllOrders(accessToken!, newOrders);
      logDev('✅ Orders saved successfully to Google Sheets!');

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
      return true; // Success
    } catch (err) {
      errorDev('❌ Error saving orders:', err);
      const errorMessage = getErrorMessage(err);

      if (isTokenExpiredError(err)) {
        // Очищаем невалидный токен
        localStorage.removeItem('google_access_token');
        toast.error('Сессия истекла. Заказ сохранен локально. Пожалуйста, войдите заново для сохранения в Google Sheets.');
      } else {
        toast.error(`Ошибка при сохранении заказов: ${errorMessage} `);
      }
      return false; // Error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWorkflowOrders = async (newWorkflowOrders: WorkflowOrder[]) => {
    setWorkflowOrders(newWorkflowOrders);
    if (!accessToken) {
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return false;
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllWorkflowOrders(accessToken, newWorkflowOrders);
      return true;
    } catch (err) {
      errorDev(err);
      toast.error(`Ошибка при сохранении Workflow: ${getErrorMessage(err)} `);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTransactions = async (newTransactions: Transaction[]) => {
    const prevIds = new Set(transactions.map(t => t.id));
    const addedTransactions = newTransactions.filter(t => !prevIds.has(t.id));

    setTransactions(newTransactions);
    if (!accessToken) {
      warnDev('Access token not available, transaction saved locally only');
      toast.warning('Вы не авторизованы. Данные сохранены только локально.');
      return false; // Saved locally but not in Sheets
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllTransactions(accessToken, newTransactions);

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
      return true; // Success
    } catch (err) {
      errorDev(err);
      const errorMessage = getErrorMessage(err);
      if (isTokenExpiredError(err)) {
        toast.error('Сессия истекла. Пожалуйста, войдите заново.');
      } else {
        toast.error(`Ошибка при сохранении транзакций: ${errorMessage} `);
      }
      return false; // Error
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddJournalEvent = async (event: JournalEvent) => {
    setJournalEvents(prev => [event, ...prev]);
    if (!accessToken) return;
    try {
      await sheetsService.addJournalEvent(accessToken, event);
    } catch (err) {
      errorDev("Failed to save journal event", err);
    }
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
        />);
      case 'journal':
        return renderLazyComponent(<JournalEventsView events={journalEvents} />);
      case 'sales':
        return renderLazyComponent(<Sales
          products={products}
          setProducts={setProducts}
          orders={orders}
          setOrders={setOrders}
          settings={settings}
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
          transactions={transactions}
          setTransactions={setTransactions}
          onSaveTransactions={handleSaveTransactions}
          currentUser={user}
        />);
      case 'staff':
        return renderLazyComponent(<Staff employees={employees} onSave={handleSaveEmployees} />);
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
        return renderLazyComponent(<PriceList products={products} onSaveProducts={handleSaveProducts} />);
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
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
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
          } fixed lg:relative h-full bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col z-40 lg:z-20`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-700 h-16">
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-white">Metal ERP</span>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
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
            />
          )}
          <SidebarItem
            icon={<Package size={20} />}
            label="Склад"
            active={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
            isOpen={isSidebarOpen}
            onMobileClose={() => setIsSidebarOpen(false)}
          />
          {checkPermission('import') && (
            <SidebarItem
              icon={<Container size={20} />}
              label="Закуп"
              active={activeTab === 'import'}
              onClick={() => setActiveTab('import')}
              isOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
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
            />
          )}
          <SidebarItem
            icon={<FileText size={20} />}
            label="Прайс"
            active={activeTab === 'priceList'}
            onClick={() => setActiveTab('priceList')}
            isOpen={isSidebarOpen}
            onMobileClose={() => setIsSidebarOpen(false)}
          />
          <div className="my-4 border-t border-slate-700 mx-4"></div>
          <SidebarItem
            icon={<Settings size={20} />}
            label="Настройки"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            isOpen={isSidebarOpen}
            onMobileClose={() => setIsSidebarOpen(false)}
          />
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          {isSidebarOpen && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user.displayName || 'Пользователь'}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} gap-3 p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors`}
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
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 lg:px-6 z-10">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors mr-2"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg lg:text-xl font-bold text-white truncate">
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
                  ? 'bg-slate-700 text-slate-400 cursor-wait'
                  : !accessToken
                    ? 'bg-slate-600 text-slate-300 cursor-not-allowed opacity-60'
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
        <div className="flex-1 overflow-hidden bg-slate-900 relative">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isOpen: boolean;
  onMobileClose?: () => void;
}

const SidebarItem = ({ icon, label, active, onClick, isOpen, onMobileClose }: SidebarItemProps) => {
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
        ? 'text-white bg-gradient-to-r from-indigo-600/20 to-transparent border-r-2 border-indigo-500'
        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      title={!isOpen ? label : ''}
    >
      <div className={`${active ? 'text-indigo-400' : ''} `}>{icon}</div>
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
  <AuthProvider>
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </AuthProvider>
);

export default App;
