import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Container,
  Landmark,
  Wallet,
  Users,
  FileText,
  UserCircle2,
  Shield,
  BookOpen,
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
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConfirmProvider } from './components/ConfirmDialog';
import { SidebarItem } from './components/SidebarItem';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Product, Order, AppSettings, Expense, FixedAsset, Client, Employee, Transaction, Purchase, JournalEvent, WorkflowOrder } from './types';
import { SUPER_ADMIN_EMAILS, defaultSettings } from './constants';
import { calculateBaseTotals } from './utils/finance';

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
import { useBalance } from './hooks/useBalance';
import { useAppHandlers } from './hooks/useAppHandlers';
import { useDebtRecalculation } from './hooks/useDebtRecalculation';

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();
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
  const [error] = useState<string | null>(null);

  // Data State
  // Use Firebase Hook for Products
  const {
    products,
    addProduct,
    updateProduct
  } = useProducts();

  // Use Firebase Hook for Orders
  const {
    orders,
    setOrders,
    addOrder,
    updateOrder,
    deleteOrder
  } = useOrders();

  // Use Firebase Hook for Transactions (MUST be before useExpenses — it depends on these)
  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useTransactions();

  // Use Firebase Hook for Expenses (shares transactions subscription — no duplicate onSnapshot)
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense
  } = useExpenses({ transactions, addTransaction, updateTransaction, deleteTransaction });

  // Use Firebase Hook for Fixed Assets
  const {
    fixedAssets,
    addAsset,
    updateAsset
  } = useFixedAssets();

  // Use Firebase Hook for Clients
  const {
    clients,
    addClient,
    updateClient
  } = useClients();

  // Use Firebase Hook for Employees
  const {
    employees,
    addEmployee,
    updateEmployee
  } = useEmployees();

  // Use Firebase Hook for Purchases
  const {
    purchases,
    addPurchase,
    updatePurchase,
  } = usePurchases();

  // Use Firebase Hook for Journal
  const {
    journalEvents,
    addEvent: addJournalEvent
  } = useJournal();

  // Use Firebase Hook for Workflow Orders
  const {
    workflowOrders,
    addWorkflowOrder,
    updateWorkflowOrder
  } = useWorkflowOrders();

  const { settings, saveSettings: saveSettingsToFirestore } = useSettings(defaultSettings);

  // Use Balance hook — computes balance from all data & caches in Firestore
  const { balance } = useBalance({
    products, orders, expenses, fixedAssets, settings, transactions, clients, purchases,
  });

  // Extracted handlers hook
  const {
    handleSaveProducts, handleSaveTransactions, handleAddExpense,
    handleSaveExpenses, handleSaveEmployees, handleSavePurchases,
    handleSaveClients, handleSaveFixedAssets, handleSaveOrders,
    handleSaveWorkflowOrders, handleAddJournalEvent, handleSaveSettings,
  } = useAppHandlers({
    products, orders, transactions, purchases, clients, employees,
    fixedAssets, workflowOrders,
    addProduct, updateProduct, addOrder, updateOrder, deleteOrder,
    addExpense, addTransaction, addPurchase, updatePurchase,
    updateTransaction,
    addClient, updateClient, addEmployee, updateEmployee,
    addAsset, updateAsset, addWorkflowOrder, updateWorkflowOrder,
    addJournalEvent, saveSettingsToFirestore,
    settings, toast,
  });

  // Debt recalculation hook
  useDebtRecalculation({ clients, orders, transactions, updateClient });

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('metal_erp_sidebar_open', String(isSidebarOpen));
    } catch {
      // ignore
    }
  }, [isSidebarOpen]);

  // Вычисление балансов кассы
  const balances = useMemo(() => {
    return calculateBaseTotals(orders, transactions, expenses, settings.defaultExchangeRate);
  }, [orders, transactions, expenses, settings.defaultExchangeRate]);

  // Combine journal events with auto-corrections for the Journal view
  const allJournalEvents = useMemo(() => {
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

  // Current Employee Permissions (memoized)
  const currentEmployee = useMemo(
    () => employees.find(e => e.email.toLowerCase() === user?.email?.toLowerCase()),
    [employees, user?.email]
  );

  const checkPermission = useCallback((module: string) => {
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
  }, [user?.email, currentEmployee]);

  // Memoized navigation callbacks
  const handleNavigateToStaff = useCallback(() => setActiveTab('staff'), []);
  const handleNavigateToProcurement = useCallback(() => setActiveTab('import'), []);
  const handleMobileClose = useCallback(() => setIsSidebarOpen(false), []);
  const handleTabChange = useCallback((tab: string) => setActiveTab(tab), []);
  const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

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
        return renderLazyComponent(<Inventory products={products} onSaveProducts={handleSaveProducts} settings={settings} currentEmployee={currentEmployee} />);
      case 'import':
        return renderLazyComponent(<Procurement
          products={products}
          settings={settings}
          purchases={purchases}
          onSavePurchases={handleSavePurchases}
          transactions={transactions}
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
          orders={orders}
          setOrders={setOrders}
          settings={settings}
          setSettings={saveSettingsToFirestore}
          expenses={expenses}
          employees={employees}
          onNavigateToStaff={handleNavigateToStaff}
          clients={clients}
          onSaveClients={handleSaveClients}
          transactions={transactions}
          workflowOrders={workflowOrders}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          currentUserEmail={user?.email}
          onNavigateToProcurement={handleNavigateToProcurement}
          onSaveOrders={handleSaveOrders}
          onSaveTransactions={handleSaveTransactions}
          onSaveProducts={handleSaveProducts}
          onSaveExpenses={handleSaveExpenses}
          onAddExpense={handleAddExpense}
          onAddJournalEvent={handleAddJournalEvent}
          onDeleteTransaction={deleteTransaction}
          onDeleteExpense={deleteExpense}
        />);
      case 'workflow':
        return renderLazyComponent(<Workflow
          products={products}
          workflowOrders={workflowOrders}
          orders={orders}
          setOrders={setOrders}
          clients={clients}
          onSaveClients={handleSaveClients}
          transactions={transactions}
          employees={employees}
          settings={settings}
          currentUserEmail={user?.email}
          onSaveOrders={handleSaveOrders}
          onSaveProducts={handleSaveProducts}
          onSaveTransactions={handleSaveTransactions}
          onSaveWorkflowOrders={handleSaveWorkflowOrders}
          onAddJournalEvent={handleAddJournalEvent}
          onNavigateToProcurement={handleNavigateToProcurement}
        />);
      case 'reports':
        return renderLazyComponent(<Reports orders={orders} expenses={expenses} products={products} purchases={purchases} settings={settings} transactions={transactions} fixedAssets={fixedAssets} onAddExpense={handleAddExpense} onUpdateExpense={updateExpense} onDeleteExpense={deleteExpense} />);
      case 'fixedAssets':
        return renderLazyComponent(<FixedAssets
          assets={fixedAssets}
          onSaveAssets={handleSaveFixedAssets}
          transactions={transactions}
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
          onSaveTransactions={handleSaveTransactions}
          currentUser={user}
          settings={settings}
        />);
      case 'staff':
        return renderLazyComponent(<Staff employees={employees} onSave={handleSaveEmployees} />);
      case 'payroll':
        return renderLazyComponent(<Payroll employees={employees} orders={orders} expenses={expenses} settings={settings} />);
      case 'balance':
        return renderLazyComponent(<Balance balance={balance} />);
      case 'settings':
        return renderLazyComponent(<SettingsComponent settings={settings} onSave={handleSaveSettings} currentUserEmail={user?.email || undefined} />);
      case 'priceList':
        return renderLazyComponent(<PriceList products={products} onSaveProducts={handleSaveProducts} settings={settings} />);
      default:
        return renderLazyComponent(<Dashboard products={products} orders={orders} settings={settings} />);
    }
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
            onClick={handleMobileClose}
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
              onClick={handleToggleSidebar}
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
              onClick={() => handleTabChange('dashboard')}
                isOpen={isSidebarOpen}
              onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('inventory') && (
              <SidebarItem
                icon={<Package size={20} />}
                label="Склад"
                active={activeTab === 'inventory'}
              onClick={() => handleTabChange('inventory')}
                isOpen={isSidebarOpen}
              onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('import') && (
              <SidebarItem
                icon={<Container size={20} />}
                label="Закуп"
                active={activeTab === 'import'}
              onClick={() => handleTabChange('import')}
                isOpen={isSidebarOpen}
              onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('sales') && (
              <SidebarItem
                icon={<Wallet size={20} />}
                label="Касса"
                active={activeTab === 'sales'}
              onClick={() => handleTabChange('sales')}
                isOpen={isSidebarOpen}
              onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('workflow') && (
              <SidebarItem
                icon={<BookOpen size={20} />}
                label="Workflow"
                active={activeTab === 'workflow'}
                onClick={() => handleTabChange('workflow')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('reports') && (
              <SidebarItem
                icon={<FileText size={20} />}
                label="Отчеты"
                active={activeTab === 'reports'}
                onClick={() => handleTabChange('reports')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('crm') && (
              <SidebarItem
                icon={<Users size={20} />}
                label="Клиенты"
                active={activeTab === 'crm'}
                onClick={() => handleTabChange('crm')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('staff') && (
              <SidebarItem
                icon={<UserCircle2 size={20} />}
                label="Сотрудники"
                active={activeTab === 'staff'}
                onClick={() => handleTabChange('staff')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('payroll') && (
              <SidebarItem
                icon={<DollarSign size={20} />}
                label="Зарплата"
                active={activeTab === 'payroll'}
                onClick={() => handleTabChange('payroll')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('fixedAssets') && (
              <SidebarItem
                icon={<Landmark size={20} />}
                label="Осн. Средства"
                active={activeTab === 'fixedAssets'}
                onClick={() => handleTabChange('fixedAssets')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('balance') && (
              <SidebarItem
                icon={<BarChart3 size={20} />}
                label="Баланс"
                active={activeTab === 'balance'}
                onClick={() => handleTabChange('balance')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('journal') && (
              <SidebarItem
                icon={<Book size={20} />}
                label="Журнал"
                active={activeTab === 'journal'}
                onClick={() => handleTabChange('journal')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            {checkPermission('priceList') && (
              <SidebarItem
                icon={<FileText size={20} />}
                label="Прайс"
                active={activeTab === 'priceList'}
                onClick={() => handleTabChange('priceList')}
                isOpen={isSidebarOpen}
                onMobileClose={handleMobileClose}
                theme={settings.theme}
              />
            )}
            <div className="my-4 border-t border-slate-700 mx-4"></div>
            <SidebarItem
              icon={<Settings size={20} />}
              label="Настройки"
              active={activeTab === 'settings'}
              onClick={() => handleTabChange('settings')}
              isOpen={isSidebarOpen}
              onMobileClose={handleMobileClose}
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
              onClick={handleToggleSidebar}
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

const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <ConfirmProvider>
            <AppContent />
            <OfflineIndicator />
          </ConfirmProvider>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
