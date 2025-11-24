
import React, { useState, useEffect } from 'react';
import { Product, Order } from '../types';
import { geminiService } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, TrendingUp, Package, AlertTriangle, Sparkles, RefreshCw, BrainCircuit } from 'lucide-react';

interface DashboardProps {
  products: Product[];
  orders: Order[];
}

export const Dashboard: React.FC<DashboardProps> = ({ products, orders }) => {
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Calculate Stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = orders.length;
  const lowStockCount = products.filter(p => p.quantity <= p.minStockLevel).length;
  const inventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.pricePerUnit), 0);

  // Prepare Chart Data (Sales by Day - Mock logic for demo)
  const chartData = orders.slice(0, 7).map((o, i) => ({
    name: `Заказ ${o.id.slice(-4)}`,
    amount: o.totalAmount
  })).reverse();

  const fetchInsight = async () => {
    setLoadingInsight(true);
    try {
      const result = await geminiService.analyzeBusiness(products, orders);
      setInsight(result);
    } catch (error) {
      console.error("Failed to fetch insight:", error);
      setInsight("Не удалось получить аналитику. Проверьте API ключ.");
    } finally {
      setLoadingInsight(false);
    }
  };

  useEffect(() => {
    // Load initial insight if empty
    if (!insight && orders.length > 0) {
      fetchInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Обзор (Финансы USD)</h2>
          <p className="text-slate-400 mt-1">Аналитика и показатели бизнеса</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-slate-500">Сегодня</p>
          <p className="text-xl font-mono text-slate-200">{new Date().toLocaleDateString('ru-RU')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={64} className="text-emerald-500" />
          </div>
          <p className="text-slate-400 font-medium text-sm">Выручка (USD)</p>
          <h3 className="text-3xl font-bold text-white mt-2 font-mono">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={64} className="text-blue-500" />
          </div>
          <p className="text-slate-400 font-medium text-sm">Всего заказов</p>
          <h3 className="text-3xl font-bold text-white mt-2 font-mono">{totalOrders}</h3>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package size={64} className="text-purple-500" />
          </div>
          <p className="text-slate-400 font-medium text-sm">Стоимость склада (USD)</p>
          <h3 className="text-3xl font-bold text-white mt-2 font-mono">${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle size={64} className="text-orange-500" />
          </div>
          <p className="text-slate-400 font-medium text-sm">Мало на складе</p>
          <h3 className={`text-3xl font-bold mt-2 font-mono ${lowStockCount > 0 ? 'text-orange-400' : 'text-white'}`}>{lowStockCount}</h3>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart Section */}
        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> Динамика продаж (USD)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                  itemStyle={{ color: '#38bdf8' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#3b82f6" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="bg-gradient-to-br from-slate-800 to-indigo-900/20 rounded-2xl border border-indigo-500/30 p-6 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-400" /> AI Аналитика
            </h3>
            <button
              onClick={fetchInsight}
              disabled={loadingInsight}
              className="p-2 bg-slate-700/50 rounded-full hover:bg-slate-700 text-indigo-300 transition-colors"
            >
              <RefreshCw size={16} className={loadingInsight ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-4 min-h-[200px]">
            {loadingInsight ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 pt-10">
                <RefreshCw size={24} className="animate-spin text-indigo-500" />
                <span className="text-sm">Анализ данных...</span>
              </div>
            ) : (
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-900/40 p-4 rounded-xl border border-indigo-500/10">
                {insight || "Нажмите кнопку обновления для получения аналитики от Gemini AI."}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-500/10">
            <p className="text-xs text-indigo-300/60 flex items-center gap-1">
              <BrainCircuit size={12} /> Powered by Gemini 2.5 Flash
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
