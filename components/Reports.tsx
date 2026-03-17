
import React, { useState } from 'react';
import { Order, Expense, Product, Purchase, AppSettings, Transaction, FixedAsset, Client } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { VatReport } from './VatReport';
import { CashFlow } from './CashFlow';
import { PnL } from './PnL';
import { SalesAnalytics } from './SalesAnalytics';
import { SalesStatistics } from './SalesStatistics';
import { TrialBalance } from './TrialBalance';
import { AccountsReceivable } from './AccountsReceivable';
import { AccountsPayable } from './AccountsPayable';
import { ArrowRightLeft, TrendingUp, FileText, PieChart, Table, Scale, BookOpen, Truck } from 'lucide-react';

interface ReportsProps {
  orders: Order[];
  expenses: Expense[];
  products: Product[];
  purchases: Purchase[];
  settings: AppSettings;
  transactions: Transaction[];
  fixedAssets?: FixedAsset[];
  clients?: Client[];
  onAddExpense: (expense: Expense) => void;
  onUpdateExpense?: (id: string, updates: Partial<Expense>) => Promise<boolean>;
  onDeleteExpense?: (id: string) => Promise<boolean>;
}

type ReportType = 'pnl' | 'cashflow' | 'sales' | 'statistics' | 'vat' | 'trialbalance' | 'receivable' | 'payable';

export const Reports: React.FC<ReportsProps> = React.memo(({ orders, expenses, products, purchases, settings, transactions, fixedAssets = [], clients = [], onAddExpense, onUpdateExpense, onDeleteExpense }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [activeTab, setActiveTab] = useState<ReportType>('pnl');

  return (
    <div className={`flex flex-col h-full ${t.bgMain} ${t.text}`}>
      {/* Reports Header / Tab Switcher */}
      <div className={`p-6 border-b ${t.border} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden`}>
        <div>
          <h2 className={`text-2xl font-bold ${t.text} flex items-center gap-2`}>
            <FileText className="text-primary-500" /> Финансовые Отчеты
          </h2>
          <p className={`${t.textMuted} text-sm mt-1`}>Аналитика, доходы и расходы</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pnl'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <TrendingUp size={16} /> P&L
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'cashflow'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <ArrowRightLeft size={16} /> Cash Flow
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'sales'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <PieChart size={16} /> Продажи
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'statistics'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <Table size={16} /> Статистика
          </button>
          <button
            onClick={() => setActiveTab('vat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'vat'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <Scale size={16} /> НДС
          </button>
          <button
            onClick={() => setActiveTab('trialbalance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'trialbalance'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <BookOpen size={16} /> Баланс
          </button>

          <div className={`w-px h-6 self-center ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'}`}></div>

          <button
            onClick={() => setActiveTab('receivable')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'receivable'
              ? 'bg-amber-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><circle cx="5" cy="16" r="1.5"/><path d="M16.5 13.5l4.5 4.5M19 13.5l-4 4.5"/></svg> Дебиторка
          </button>
          <button
            onClick={() => setActiveTab('payable')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'payable'
              ? 'bg-rose-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="8" y="4" width="28" height="38" rx="3"/><rect x="13" y="10" width="8" height="6" rx="1"/><circle cx="15" cy="24" r="2"/><circle cx="22" cy="24" r="2"/><circle cx="29" cy="24" r="2"/><circle cx="15" cy="30" r="2"/><circle cx="22" cy="30" r="2"/><circle cx="29" cy="30" r="2"/><circle cx="15" cy="36" r="2"/><circle cx="22" cy="36" r="2"/><path d="M8 42 L4 50" /><path d="M36 42 L40 50" /><path d="M4 50 L40 50" strokeDasharray="4 3"/><rect x="30" y="16" width="24" height="16" rx="3" transform="rotate(25 42 24)"/><path d="M46 22 Q48 20 50 22" /><path d="M44 25 Q48 21 52 25" /><path d="M54 38 L60 56 Q58 60 54 58 L46 44" /></svg> Кредиторка
          </button>

        </div>
      </div>

      {/* Report Content */}
      <div className={`flex-1 overflow-auto ${t.bgMain} custom-scrollbar`}>
        {activeTab === 'pnl' && <PnL orders={orders} expenses={expenses} fixedAssets={fixedAssets} expenseCategories={settings.expenseCategories} defaultExchangeRate={settings.defaultExchangeRate} onUpdateExpense={onUpdateExpense} onDeleteExpense={onDeleteExpense} />}
        {activeTab === 'cashflow' && <CashFlow orders={orders} expenses={expenses} settings={settings} onAddExpense={onAddExpense} transactions={transactions} />}
        {activeTab === 'sales' && <SalesAnalytics orders={orders} products={products} settings={settings} />}
        {activeTab === 'statistics' && <SalesStatistics orders={orders} products={products} transactions={transactions} />}
        {activeTab === 'vat' && <VatReport purchases={purchases} orders={orders} expenses={expenses} settings={settings} />}
        {activeTab === 'trialbalance' && <TrialBalance />}
        {activeTab === 'receivable' && <AccountsReceivable />}
        {activeTab === 'payable' && <AccountsPayable purchases={purchases} transactions={transactions} settings={settings} />}
      </div>
    </div>
  );
});
