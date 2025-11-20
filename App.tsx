import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingCart, Menu, X, PieChart as PieChartIcon, Settings as SettingsIcon, Container, FileText, LogOut, Database } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { Balance } from './components/Balance';
import { Settings } from './components/Settings';
import { Reports } from './components/Reports';
import { Import } from './components/Import';
import { Login } from './components/Login';
import { storageService } from './services/storageService';
import { sheetsService, getSpreadsheetId, saveSpreadsheetId } from './services/sheetsService';
import { Product, Order, AppSettings, Expense, Purchase } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

type View = 'dashboard' | 'inventory' | 'sales' | 'balance' | 'reports' | 'import' | 'settings';

const MainApp: React.FC = () => {
  const { user, logout, accessToken } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<AppSettings>(storageService.getSettings());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Sheets Integration State
  const [spreadsheetId, setSpreadsheetId] = useState(getSpreadsheetId());
  const [isSyncing, setIsSyncing] = useState(false);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      // 1. Load local settings/expenses/purchases (keep local for now or migrate later)
      setExpenses(storageService.getExpenses());
      setPurchases(storageService.getPurchases());

      // 2. Load from Sheets if ID and Token exist
      if (accessToken && spreadsheetId) {
        setIsSyncing(true);
        try {
          await sheetsService.initialize(accessToken);
          const loadedProducts = await sheetsService.getProducts(accessToken);
          const loadedOrders = await sheetsService.getOrders(accessToken);

          if (loadedProducts.length > 0) setProducts(loadedProducts);
          else setProducts(storageService.getProducts()); // Fallback to local if sheet empty

          if (loadedOrders.length > 0) setOrders(loadedOrders);
          else setOrders(storageService.getOrders()); // Fallback
        } catch (error) {
          console.error("Sync Error:", error);
          // Fallback to local
          setProducts(storageService.getProducts());
          setOrders(storageService.getOrders());
        } finally {
          setIsSyncing(false);
        }
      } else {
        // Fallback to local if no sheet connected
        setProducts(storageService.getProducts());
        setOrders(storageService.getOrders());
      }
    };

    loadData();

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [accessToken, spreadsheetId]);

  // Sync Changes to Sheets
  useEffect(() => {
    if (accessToken && spreadsheetId && products.length > 0) {
      const timeout = setTimeout(() => {
        sheetsService.saveAllProducts(accessToken, products).catch(console.error);
      }, 2000); // Debounce 2s
      return () => clearTimeout(timeout);
    } else {
      storageService.saveProducts(products);
    }
  }, [products, accessToken, spreadsheetId]);

  useEffect(() => {
    if (accessToken && spreadsheetId && orders.length > 0) {
      const timeout = setTimeout(() => {
        sheetsService.saveAllOrders(accessToken, orders).catch(console.error);
      }, 2000);
      return () => clearTimeout(timeout);
    } else {
      storageService.saveOrders(orders);
    }
  }, [orders, accessToken, spreadsheetId]);

  useEffect(() => {
    storageService.saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    storageService.savePurchases(purchases);
  }, [purchases]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleSaveSpreadsheetId = (id: string) => {
    setSpreadsheetId(id);
    saveSpreadsheetId(id);
    // Trigger reload?
    window.location.reload();
  };

  const handleAddExpense = (newExpense: Expense) => {
    setExpenses([newExpense, ...expenses]);
  };

  const handleCompletePurchase = (purchase: Purchase) => {
    setPurchases([purchase, ...purchases]);
    const updatedProducts = products.map(p => {
      const incomingItem = purchase.items.find(item => item.productId === p.id);
      if (incomingItem) {
        const currentTotalValue = p.quantity * (p.costPrice || 0);
        const incomingTotalValue = incomingItem.quantity * incomingItem.landedCost;
        const newQuantity = p.quantity + incomingItem.quantity;
        const newCostPrice = newQuantity > 0
          ? (currentTotalValue + incomingTotalValue) / newQuantity
          : incomingItem.landedCost;
        return { ...p, quantity: newQuantity, costPrice: newCostPrice };
      }
      return p;
    });
    setProducts(updatedProducts);
  };

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    if (isMobile) setIsSidebarOpen(false);
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transform transition-transform duration-300 ease-in-out print:hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-primary-600 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">M</div>
            <h1 className="text-xl font-bold tracking-wide">MetalMaster</h1>
          </div>
          {isMobile && (
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-140px)] custom-scrollbar">
          <button
            onClick={() => handleNavClick('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'dashboard' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Дашборд</span>
          </button>

          <button
            onClick={() => handleNavClick('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'inventory' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <Package size={20} />
            <span className="font-medium">Склад</span>
          </button>

          <button
            onClick={() => handleNavClick('import')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'import' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <Container size={20} />
            <span className="font-medium">Закупка (Импорт)</span>
          </button>

          <button
            onClick={() => handleNavClick('sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'sales' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <ShoppingCart size={20} />
            <span className="font-medium">Продажи</span>
          </button>

          <button
            onClick={() => handleNavClick('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'reports' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <FileText size={20} />
            <span className="font-medium">Финанс. Отчеты</span>
          </button>

          <button
            onClick={() => handleNavClick('balance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'balance' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <PieChartIcon size={20} />
            <span className="font-medium">Баланс</span>
          </button>

          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'settings' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}
          >
            <SettingsIcon size={20} />
            <span className="font-medium">Настройки</span>
          </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-700 bg-slate-800">
          {/* Spreadsheet Status */}
          <div className="mb-4 px-2 py-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Database size={12} />
              <span>База данных:</span>
            </div>
            {spreadsheetId ? (
              <div className="flex items-center gap-2 text-green-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Google Sheets {isSyncing && '(Syncing...)'}
              </div>
            ) : (
              <div className="text-orange-400 text-xs">Локальная (Нет ID)</div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                <span className="font-bold">{user.email?.[0].toUpperCase()}</span>
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.displayName || 'Пользователь'}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors py-2 rounded-lg hover:bg-slate-700"
          >
            <LogOut size={14} />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700 z-40 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center text-xs font-bold">M</div>
            <span className="font-bold">MetalMaster</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-300">
            <Menu size={24} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto bg-slate-900 print:bg-white print:overflow-visible">
          {currentView === 'dashboard' && <Dashboard products={products} orders={orders} />}
          {currentView === 'inventory' && <Inventory products={products} setProducts={setProducts} />}
          {currentView === 'sales' && <Sales products={products} setProducts={setProducts} orders={orders} setOrders={setOrders} settings={settings} />}
          {currentView === 'reports' && <Reports orders={orders} expenses={expenses} onAddExpense={handleAddExpense} />}
          {currentView === 'balance' && <Balance products={products} orders={orders} expenses={expenses} />}
          {currentView === 'import' && <Import products={products} onCompletePurchase={handleCompletePurchase} />}
          {currentView === 'settings' && (
            <div className="p-6 space-y-6">
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Database className="text-primary-500" />
                  Подключение к Google Sheets
                </h2>
                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">ID Таблицы (Spreadsheet ID)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId(e.target.value)}
                        placeholder="Например: 1aBcDeFg..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                      />
                      <button
                        onClick={() => handleSaveSpreadsheetId(spreadsheetId)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Сохранить
                      </button>
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={async () => {
                          if (!accessToken) return alert("Сначала войдите в аккаунт!");
                          try {
                            const msg = await sheetsService.testConnection(accessToken);
                            alert(msg);
                          } catch (e: any) {
                            alert("Ошибка: " + e.message + "\n\nПопробуйте выйти и зайти снова, чтобы обновить права доступа.");
                          }
                        }}
                        className="text-xs text-primary-400 hover:text-primary-300 underline"
                      >
                        Проверить соединение
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Вставьте ID вашей Google Таблицы. Приложение будет автоматически сохранять туда товары и заказы.
                    </p>
                  </div>
                </div>
              </div>
              <Settings settings={settings} onSave={handleSaveSettings} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
