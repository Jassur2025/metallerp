
import React, { useState } from 'react';
import { Order, Expense } from '../types';
import { CashFlow } from './CashFlow';
import { PnL } from './PnL';
import { SalesAnalytics } from './SalesAnalytics';
import { ArrowRightLeft, TrendingUp, FileText, PieChart } from 'lucide-react';

interface ReportsProps {
  orders: Order[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
}

type ReportType = 'pnl' | 'cashflow' | 'sales';

export const Reports: React.FC<ReportsProps> = ({ orders, expenses, onAddExpense }) => {
  const [activeTab, setActiveTab] = useState<ReportType>('pnl');

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Reports Header / Tab Switcher */}
      <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-primary-500" /> Финансовые Отчеты
          </h2>
          <p className="text-slate-400 text-sm mt-1">Аналитика, доходы и расходы</p>
        </div>

        <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pnl' 
                ? 'bg-primary-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <TrendingUp size={16} /> P&L (Прибыль)
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'cashflow' 
                ? 'bg-primary-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <ArrowRightLeft size={16} /> Cash Flow
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sales' 
                ? 'bg-primary-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <PieChart size={16} /> Продажи
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto bg-slate-900 custom-scrollbar">
        {activeTab === 'pnl' && <PnL orders={orders} expenses={expenses} />}
        {activeTab === 'cashflow' && <CashFlow orders={orders} expenses={expenses} onAddExpense={onAddExpense} />}
        {activeTab === 'sales' && <SalesAnalytics orders={orders} />}
      </div>
    </div>
  );
};
