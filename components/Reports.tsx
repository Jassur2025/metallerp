
import React, { useState } from 'react';
import { Order, Expense, Product, Purchase, AppSettings, Transaction, FixedAsset } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { VatReport } from './VatReport';
import { CashFlow } from './CashFlow';
import { PnL } from './PnL';
import { SalesAnalytics } from './SalesAnalytics';
import { SalesStatistics } from './SalesStatistics';
import { ArrowRightLeft, TrendingUp, FileText, PieChart, Table, Scale } from 'lucide-react';

interface ReportsProps {
  orders: Order[];
  expenses: Expense[];
  products: Product[];
  purchases: Purchase[];
  settings: AppSettings;
  transactions: Transaction[];
  fixedAssets?: FixedAsset[];
  onAddExpense: (expense: Expense) => void;
  onUpdateExpense?: (id: string, updates: Partial<Expense>) => Promise<boolean>;
  onDeleteExpense?: (id: string) => Promise<boolean>;
}

type ReportType = 'pnl' | 'cashflow' | 'sales' | 'statistics' | 'vat';

export const Reports: React.FC<ReportsProps> = React.memo(({ orders, expenses, products, purchases, settings, transactions, fixedAssets = [], onAddExpense, onUpdateExpense, onDeleteExpense }) => {
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

        </div>
      </div>

      {/* Report Content */}
      <div className={`flex-1 overflow-auto ${t.bgMain} custom-scrollbar`}>
        {activeTab === 'pnl' && <PnL orders={orders} expenses={expenses} fixedAssets={fixedAssets} expenseCategories={settings.expenseCategories} defaultExchangeRate={settings.defaultExchangeRate} onUpdateExpense={onUpdateExpense} onDeleteExpense={onDeleteExpense} />}
        {activeTab === 'cashflow' && <CashFlow orders={orders} expenses={expenses} settings={settings} onAddExpense={onAddExpense} transactions={transactions} />}
        {activeTab === 'sales' && <SalesAnalytics orders={orders} settings={settings} />}
        {activeTab === 'statistics' && <SalesStatistics orders={orders} products={products} transactions={transactions} />}
        {activeTab === 'vat' && <VatReport purchases={purchases} orders={orders} expenses={expenses} settings={settings} />}
      </div>
    </div>
  );
});
