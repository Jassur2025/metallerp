
import React from 'react';
import { Product, Order, Expense } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShieldCheck, Wallet, Building2, Scale, Landmark } from 'lucide-react';

interface BalanceProps {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
}

export const Balance: React.FC<BalanceProps> = ({ products, orders, expenses }) => {
  // --- ASSETS (АКТИВЫ) ---
  
  // 1. Inventory Value (USD) - Stock on hand
  const inventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.pricePerUnit), 0);
  
  // 2. Cash on Hand (from Sales minus Expenses) (USD)
  const totalSalesCash = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const cashOnHand = Math.max(0, totalSalesCash - totalExpenses);

  const totalAssets = inventoryValue + cashOnHand;

  // --- PASSIVES (ПАССИВЫ) ---
  
  // 1. VAT Liability (Owed to Government)
  // Sum of vatAmount from all orders
  const vatLiability = orders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);

  // 2. Equity / Capital (Initially invested Inventory)
  // We assume all current inventory value is equity for this simplified model
  const equity = inventoryValue; 

  // 3. Retained Earnings (Net Profit)
  // Total Sales - Total Expenses - VAT Owed
  // Note: This is a simplified retained earnings calculation.
  // Real formula: (Revenue - COGS - Expenses - Tax). 
  // Here we approximate COGS logic by keeping Equity constant as Inventory Value.
  // So Earnings = (Cash generated - VAT Liability).
  const retainedEarnings = cashOnHand - vatLiability; 
  
  const totalPassives = equity + retainedEarnings + vatLiability;

  // Chart Data
  const assetsData = [
    { name: 'Товарный запас', value: inventoryValue, color: '#3b82f6' },
    { name: 'Денежные средства', value: cashOnHand, color: '#10b981' },
  ];

  const passivesData = [
    { name: 'Товарный капитал', value: equity, color: '#8b5cf6' },
    { name: 'Чистая выручка', value: retainedEarnings > 0 ? retainedEarnings : 0, color: '#f59e0b' },
    { name: 'Обязательства по НДС', value: vatLiability, color: '#ef4444' },
  ];

  const formatCurrency = (val: number) => 
    `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Управленческий Баланс</h2>
          <p className="text-slate-400 mt-1">Активы и Пассивы компании (USD)</p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-3">
            <Scale className="text-primary-500" size={24} />
            <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-bold">Валюта баланса</p>
                <p className="text-xl font-mono font-bold text-white">{formatCurrency(totalAssets)}</p>
            </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assets Card */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border-t-4 border-t-emerald-500 border-x border-b border-slate-700 shadow-lg">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wallet className="text-emerald-500" /> АКТИВ
                    </h3>
                    <p className="text-slate-400 text-sm">Куда вложены средства</p>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-mono">
                    {formatCurrency(totalAssets)}
                </span>
            </div>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-10 bg-blue-500 rounded-full"></div>
                        <div>
                            <p className="text-white font-medium">Товарные запасы</p>
                            <p className="text-xs text-slate-500">Склад по себестоимости</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg text-blue-400">{formatCurrency(inventoryValue)}</p>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-10 bg-emerald-500 rounded-full"></div>
                        <div>
                            <p className="text-white font-medium">Денежные средства</p>
                            <p className="text-xs text-slate-500">Касса (Продажи - Расходы)</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg text-emerald-400">{formatCurrency(cashOnHand)}</p>
                </div>
            </div>
        </div>

        {/* Passives Card */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border-t-4 border-t-indigo-500 border-x border-b border-slate-700 shadow-lg">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Building2 className="text-indigo-500" /> ПАССИВ
                    </h3>
                    <p className="text-slate-400 text-sm">Источники средств</p>
                </div>
                <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-sm font-mono">
                    {formatCurrency(totalPassives)}
                </span>
            </div>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-10 bg-indigo-500 rounded-full"></div>
                        <div>
                            <p className="text-white font-medium">Собственный капитал</p>
                            <p className="text-xs text-slate-500">Инвестиции в товар</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg text-indigo-400">{formatCurrency(equity)}</p>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-10 bg-amber-500 rounded-full"></div>
                        <div>
                            <p className="text-white font-medium">Чистая прибыль</p>
                            <p className="text-xs text-slate-500">Накопленная (после НДС)</p>
                        </div>
                    </div>
                    <p className={`font-mono text-lg ${retainedEarnings >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        {formatCurrency(retainedEarnings)}
                    </p>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-10 bg-red-500 rounded-full"></div>
                        <div>
                            <p className="text-white font-medium">Обязательства по НДС</p>
                            <p className="text-xs text-slate-500">Подлежит уплате в бюджет</p>
                        </div>
                    </div>
                    <p className="font-mono text-lg text-red-400">{formatCurrency(vatLiability)}</p>
                </div>
            </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h4 className="text-lg font-bold text-white mb-4 text-center">Структура Пассивов</h4>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={passivesData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {passivesData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                            formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col justify-center items-center text-center space-y-6">
              <div className="p-4 bg-emerald-500/10 rounded-full">
                 <Landmark size={48} className="text-emerald-500" />
              </div>
              <div>
                  <h4 className="text-xl font-bold text-white">Финансовая сводка</h4>
                  <p className="text-slate-400 max-w-md mx-auto mt-2">
                      Текущий денежный поток позволяет покрыть налоговые обязательства. Зарезервировано <span className="text-white font-bold">{formatCurrency(vatLiability)}</span> на НДС.
                  </p>
              </div>
              <div className="w-full bg-slate-700/50 rounded-lg p-4 grid grid-cols-2 gap-4 divide-x divide-slate-600">
                  <div>
                      <p className="text-xs text-slate-500">Чистая Прибыль</p>
                      <p className={`font-bold ${retainedEarnings >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {formatCurrency(retainedEarnings)}
                      </p>
                  </div>
                  <div>
                      <p className="text-xs text-slate-500">Расходы</p>
                      <p className="text-red-400 font-bold">{formatCurrency(totalExpenses)}</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
