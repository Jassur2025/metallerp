import React, { useState, useEffect } from 'react';
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
  BookOpen
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Procurement } from './components/Procurement';


import { Balance } from './components/Balance';
import { CRM } from './components/CRM';
import { Login } from './components/Login';
import { Reports } from './components/Reports';
import { Staff } from './components/Staff';
import { JournalEventsView } from './components/JournalEventsView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Product, Order, AppSettings, Expense, FixedAsset, Client, Employee, Transaction, Purchase, JournalEvent } from './types';
import { sheetsService } from './services/sheetsService';
import { Settings as SettingsComponent } from './components/Settings';
import { FixedAssets } from './components/FixedAssets';
import { SUPER_ADMIN_EMAILS, IS_DEV_MODE } from './constants';

// Default Settings
const defaultSettings: AppSettings = {
  vatRate: 12,
  defaultExchangeRate: 12800,
  modules: {
    dashboard: true,
    inventory: true,
    import: true,
    sales: true,
    reports: true,
    balance: true,
    fixedAssets: true,
    crm: true,
    staff: true,
    journal: true
  }
};

const AppContent: React.FC = () => {
  const { user, logout, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('metal_erp_settings');
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch (e) {
      console.error("Failed to parse settings", e);
      return defaultSettings;
    }
  });

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
    try {
      await sheetsService.initialize(accessToken);
      const [loadedProducts, loadedOrders, loadedExpenses, loadedAssets, loadedClients, loadedEmployees, loadedTransactions, loadedPurchases, loadedJournalEvents] = await Promise.all([
        sheetsService.getProducts(accessToken),
        sheetsService.getOrders(accessToken),
        sheetsService.getExpenses(accessToken),
        sheetsService.getFixedAssets(accessToken),
        sheetsService.getClients(accessToken),
        sheetsService.getEmployees(accessToken),
        sheetsService.getTransactions(accessToken),
        sheetsService.getPurchases(accessToken),
        sheetsService.getJournalEvents(accessToken)
      ]);
      
      // Recalculate client debts based on transactions to ensure accuracy
      const clientsWithRecalculatedDebts = recalculateClientDebts(loadedClients, loadedTransactions);
      
      setProducts(loadedProducts);
      setOrders(loadedOrders);
      setExpenses(loadedExpenses);
      setFixedAssets(loadedAssets);
      setClients(clientsWithRecalculatedDebts);
      setEmployees(loadedEmployees);
      setTransactions(loadedTransactions);
      setPurchases(loadedPurchases);
      setJournalEvents(loadedJournalEvents);
      
      // If debts were recalculated and differ from saved values, save updated clients
      const debtsChanged = clientsWithRecalculatedDebts.some((client, index) => 
        Math.abs((client.totalDebt || 0) - (loadedClients[index]?.totalDebt || 0)) > 0.01
      );
      if (debtsChanged) {
        console.log('🔄 Долги клиентов пересчитаны на основе транзакций, сохраняем обновленные данные...');
        await sheetsService.saveAllClients(accessToken, clientsWithRecalculatedDebts);
      }
    } catch (err: any) {
      console.error(err);
      setError('Не удалось загрузить данные. Проверьте ID таблицы в настройках.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await Promise.all([
        sheetsService.saveAllProducts(accessToken, products),
        sheetsService.saveAllOrders(accessToken, orders),
        sheetsService.saveAllExpenses(accessToken, expenses),
        sheetsService.saveAllFixedAssets(accessToken, fixedAssets),
        sheetsService.saveAllClients(accessToken, clients),
        sheetsService.saveAllEmployees(accessToken, employees),
        sheetsService.saveAllTransactions(accessToken, transactions),
        sheetsService.saveAllPurchases(accessToken, purchases)
      ]);
      alert('Все данные успешно сохранены в Google Sheets!');
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении данных!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (newExpense: Expense) => {
    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);
    // Save to Google Sheets
    if (accessToken) {
      try {
        await sheetsService.saveAllExpenses(accessToken, updatedExpenses);
      } catch (err) {
        console.error('Ошибка при сохранении расхода:', err);
        alert('Расход добавлен локально, но не удалось сохранить в Google Sheets');
      }
    }
  };

  const handleSaveEmployees = async (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await sheetsService.saveAllEmployees(accessToken, newEmployees);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении сотрудников!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePurchases = async (newPurchases: Purchase[]) => {
    setPurchases(newPurchases);
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await sheetsService.saveAllPurchases(accessToken, newPurchases);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении закупок!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClients = async (newClients: Client[]) => {
    console.log('💾 Saving clients to Google Sheets:', newClients.map(c => ({ name: c.name, totalDebt: c.totalDebt })));
    setClients(newClients);
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await sheetsService.saveAllClients(accessToken, newClients);
      console.log('✅ Clients saved successfully!');
    } catch (err) {
      console.error('❌ Error saving clients:', err);
      alert('Ошибка при сохранении клиентов!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExpenses = async (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await sheetsService.saveAllExpenses(accessToken, newExpenses);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении расходов!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFixedAssets = async (newAssets: FixedAsset[]) => {
    setFixedAssets(newAssets);
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await sheetsService.saveAllFixedAssets(accessToken, newAssets);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении основных средств!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    if (!accessToken) return;
    setIsLoading(true);
    try {
      await sheetsService.saveAllProducts(accessToken, newProducts);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении товаров!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOrders = async (newOrders: Order[]) => {
    console.log('💾 Saving orders to Google Sheets:', newOrders.length, 'orders');
    console.log('📋 Orders details:', newOrders.map(o => ({ 
      id: o.id, 
      customer: o.customerName, 
      total: o.totalAmount, 
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus 
    })));
    setOrders(newOrders);
    if (!accessToken) {
      console.warn('⚠️ Access token not available, order saved locally only');
      return false; // Saved locally but not in Sheets
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllOrders(accessToken, newOrders);
      console.log('✅ Orders saved successfully to Google Sheets!');
      return true; // Success
    } catch (err) {
      console.error('❌ Error saving orders:', err);
      alert('Ошибка при сохранении заказов! Проверьте консоль для деталей.');
      return false; // Error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTransactions = async (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
    if (!accessToken) {
      console.warn('Access token not available, transaction saved locally only');
      return false; // Saved locally but not in Sheets
    }
    setIsLoading(true);
    try {
      await sheetsService.saveAllTransactions(accessToken, newTransactions);
      return true; // Success
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении транзакций!');
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
      console.error("Failed to save journal event", err);
    }
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

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard products={products} orders={orders} clients={clients} transactions={transactions} settings={settings} />;
      case 'inventory':
        return <Inventory products={products} setProducts={setProducts} onSaveProducts={handleSaveProducts} />;
      case 'import':
        return <Procurement
          products={products}
          setProducts={setProducts}
          settings={settings}
          purchases={purchases}
          onSavePurchases={handleSavePurchases}
          transactions={transactions}
          setTransactions={setTransactions}
          onSaveProducts={handleSaveProducts}
          onSaveTransactions={handleSaveTransactions}
        />;
      case 'journal':
        return <JournalEventsView events={journalEvents} />;
      case 'sales':
        return <Sales
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
          onSaveOrders={handleSaveOrders}
          onSaveTransactions={handleSaveTransactions}
          onSaveProducts={handleSaveProducts}
          onSaveExpenses={handleSaveExpenses}
          onAddJournalEvent={handleAddJournalEvent}
        />;
      case 'reports':
        return <Reports orders={orders} expenses={expenses} products={products} onAddExpense={handleAddExpense} />;
      case 'fixedAssets':
        return <FixedAssets assets={fixedAssets} setAssets={setFixedAssets} onSaveAssets={handleSaveFixedAssets} />;
      case 'crm':
        return <CRM
          clients={clients}
          onSave={handleSaveClients}
          orders={orders}
          transactions={transactions}
          setTransactions={setTransactions}
          onSaveTransactions={handleSaveTransactions}
        />;
      case 'staff':
        return <Staff employees={employees} onSave={handleSaveEmployees} />;
      case 'balance':
        return <Balance
          orders={orders}
          products={products}
          expenses={expenses}
          fixedAssets={fixedAssets}
          settings={settings}
          transactions={transactions}
        />;
      case 'settings':
        return <SettingsComponent settings={settings} setSettings={setSettings} />;
      default:
        return <Dashboard products={products} orders={orders} settings={settings} />;
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
        className={`${
          isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 w-20'
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
          {checkPermission('inventory') && (
            <SidebarItem
              icon={<Package size={20} />}
              label="Склад"
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              isOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
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
              icon={<BookOpen size={20} />}
              label="Журнал"
              active={activeTab === 'journal'}
              onClick={() => setActiveTab('journal')}
              isOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
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
                disabled={isLoading}
                className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-2 rounded-lg font-medium transition-all text-sm lg:text-base ${isLoading
                  ? 'bg-slate-700 text-slate-400 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  }`}
                title="Сохранить в Google Sheets"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isLoading ? 'Сохранение...' : 'Сохранить в Google Sheets'}</span>
                <span className="sm:hidden">{isLoading ? '...' : '💾'}</span>
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

const SidebarItem = ({ icon, label, active, onClick, isOpen }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${isOpen ? 'justify-start px-4' : 'justify-center'} gap-3 py-3 transition-all relative group ${active
      ? 'text-white bg-gradient-to-r from-indigo-600/20 to-transparent border-r-2 border-indigo-500'
      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      }`}
    title={!isOpen ? label : ''}
  >
    <div className={`${active ? 'text-indigo-400' : ''}`}>{icon}</div>
    {isOpen && <span className="font-medium">{label}</span>}
    {!isOpen && (
      <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700 shadow-xl">
        {label}
      </div>
    )}
  </button>
);

const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
