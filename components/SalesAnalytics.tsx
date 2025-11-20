
import React, { useMemo, useState } from 'react';
import { Order } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Users, Briefcase, TrendingUp, Crown, Wallet, Package, X, ChevronRight } from 'lucide-react';

interface SalesAnalyticsProps {
  orders: Order[];
}

interface ProductStat {
    name: string;
    quantity: number;
    total: number;
    unit: string;
}

interface StatItem {
    name: string;
    totalAmount: number;
    ordersCount: number;
    purchasedProducts: Record<string, ProductStat>; // Aggregated products for this entity
    [key: string]: any;
}

export const SalesAnalytics: React.FC<SalesAnalyticsProps> = ({ orders }) => {
  const [selectedClient, setSelectedClient] = useState<StatItem | null>(null);
  
  // Aggregate Data
  const stats = useMemo(() => {
      const clients: Record<string, StatItem> = {};
      const sellers: Record<string, StatItem> = {};

      let totalRevenue = 0;
      let validOrdersCount = 0;

      if (orders && Array.isArray(orders)) {
          orders.forEach(order => {
              // Safely handle potential non-number values
              const amount = Number(order.totalAmount) || 0;
              
              totalRevenue += amount;
              validOrdersCount++;

              // --- Process Client ---
              const clientName = order.customerName ? order.customerName.trim() : 'Неизвестный';
              
              if (!clients[clientName]) {
                  clients[clientName] = { 
                      name: clientName, 
                      totalAmount: 0, 
                      ordersCount: 0,
                      purchasedProducts: {}
                  };
              }
              clients[clientName].totalAmount += amount;
              clients[clientName].ordersCount += 1;

              // Aggregate Products for Client
              if (order.items && Array.isArray(order.items)) {
                  order.items.forEach(item => {
                      const pName = item.productName;
                      if (!clients[clientName].purchasedProducts[pName]) {
                          clients[clientName].purchasedProducts[pName] = {
                              name: pName,
                              quantity: 0,
                              total: 0,
                              unit: item.unit
                          };
                      }
                      clients[clientName].purchasedProducts[pName].quantity += Number(item.quantity) || 0;
                      clients[clientName].purchasedProducts[pName].total += Number(item.total) || 0;
                  });
              }

              // --- Process Seller ---
              const sellerName = order.sellerName ? order.sellerName.trim() : 'Не указан';
              if (!sellers[sellerName]) {
                  sellers[sellerName] = { 
                      name: sellerName, 
                      totalAmount: 0, 
                      ordersCount: 0,
                      purchasedProducts: {} // We could track what sellers sell best too, but mostly needed for clients
                  };
              }
              sellers[sellerName].totalAmount += amount;
              sellers[sellerName].ordersCount += 1;
          });
      }

      const sortedClients = Object.values(clients).sort((a, b) => b.totalAmount - a.totalAmount);
      const sortedSellers = Object.values(sellers).sort((a, b) => b.totalAmount - a.totalAmount);
      
      const averageCheck = validOrdersCount > 0 ? totalRevenue / validOrdersCount : 0;

      return { 
          clients: sortedClients, 
          sellers: sortedSellers,
          averageCheck,
          totalRevenue
      };
  }, [orders]);

  const formatCurrency = (val: number) => {
      if (typeof val !== 'number' || isNaN(val)) return '$0.00';
      try {
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } catch (e) {
        return '$0.00';
      }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Top 5 Clients
  const top5Clients = stats.clients.slice(0, 5);

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-20">
       <div className="flex justify-between items-center">
         <div>
           <h2 className="text-2xl font-bold text-white tracking-tight">Аналитика Продаж</h2>
           <p className="text-slate-400 mt-1">Статистика по клиентам и сотрудникам</p>
         </div>
       </div>

       {/* Global Summary Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <TrendingUp size={32} />
              </div>
              <div>
                  <p className="text-slate-400 text-sm">Общая Выручка</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
              </div>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                  <Users size={32} />
              </div>
              <div>
                  <p className="text-slate-400 text-sm">Активных клиентов</p>
                  <p className="text-2xl font-bold text-white">{stats.clients.length}</p>
              </div>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                  <Wallet size={32} />
              </div>
              <div>
                  <p className="text-slate-400 text-sm">Средний чек</p>
                  <p className="text-2xl font-bold text-white">
                      {formatCurrency(stats.averageCheck)}
                  </p>
              </div>
          </div>
       </div>

       {/* Clients Section */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Chart */}
           <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
               <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                   <Users size={20} className="text-blue-500" /> Топ-10 Клиентов (Выручка)
               </h3>
               <div className="h-[320px] w-full">
                   {stats.clients.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={stats.clients.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 30 }}>
                               <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                               <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={100} />
                               <Tooltip 
                                   cursor={{fill: 'transparent'}}
                                   contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                   formatter={(value: number) => formatCurrency(value)}
                               />
                               <Bar dataKey="totalAmount" radius={[0, 4, 4, 0]} barSize={24}>
                                    {stats.clients.slice(0, 10).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                               </Bar>
                           </BarChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="flex items-center justify-center h-full text-slate-500">
                           Нет данных для отображения
                       </div>
                   )}
               </div>
           </div>

           {/* Client Statistics Block (Right Column) */}
           <div className="bg-slate-800 rounded-2xl border border-slate-700 p-0 shadow-lg flex flex-col overflow-hidden h-[450px]">
               <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                   <h3 className="text-xl font-bold text-white flex items-center gap-2">
                       <Crown className="text-amber-400" size={22} /> Лидеры продаж
                   </h3>
                   <p className="text-xs text-slate-400 mt-1">Нажмите на клиента для детализации</p>
               </div>

               <div className="p-6 bg-slate-900/30 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                   {/* KPI Mini-Grid within the card */}
                   <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-700/40 p-3 rounded-lg border border-slate-600/50">
                            <p className="text-xs text-slate-400">Уникальных</p>
                            <p className="text-lg font-bold text-white">{stats.clients.length}</p>
                        </div>
                        <div className="bg-slate-700/40 p-3 rounded-lg border border-slate-600/50">
                            <p className="text-xs text-slate-400">Сред. чек</p>
                            <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats.averageCheck)}</p>
                        </div>
                   </div>

                   {/* Top Clients List */}
                   <div className="space-y-3">
                       {top5Clients.length > 0 ? top5Clients.map((client, index) => (
                           <div 
                                key={client.name + index} 
                                onClick={() => setSelectedClient(client)}
                                className="flex items-center justify-between group cursor-pointer p-2 rounded-lg hover:bg-slate-700/50 transition-all"
                            >
                               <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md shrink-0
                                       ${index === 0 ? 'bg-yellow-500 text-yellow-900' : 
                                         index === 1 ? 'bg-slate-400 text-slate-900' : 
                                         index === 2 ? 'bg-amber-700 text-amber-100' : 
                                         'bg-slate-700 text-slate-400'}`}
                                   >
                                       {index + 1}
                                   </div>
                                   <div className="min-w-0">
                                       <p className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors truncate max-w-[120px]">{client.name}</p>
                                       <p className="text-xs text-slate-500">{client.ordersCount} заказов</p>
                                   </div>
                               </div>
                               <div className="flex items-center gap-2 text-right shrink-0">
                                   <p className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(client.totalAmount)}</p>
                                   <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300" />
                               </div>
                           </div>
                       )) : (
                           <div className="text-center py-4 text-slate-500 text-sm">
                               Нет данных о продажах
                           </div>
                       )}
                   </div>
               </div>
           </div>
       </div>

       {/* Sellers Section */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-700">
           
           <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
               <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                   <Briefcase size={20} className="text-amber-500" /> Доля продавцов
               </h3>
               <div className="h-[250px] w-full">
                   {stats.sellers.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                               <Pie
                                   data={stats.sellers}
                                   cx="50%"
                                   cy="50%"
                                   innerRadius={50}
                                   outerRadius={70}
                                   paddingAngle={5}
                                   dataKey="totalAmount"
                               >
                                   {stats.sellers.map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                   ))}
                               </Pie>
                               <Tooltip 
                                   contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                                   formatter={(value: number) => formatCurrency(value)}
                               />
                               <Legend verticalAlign="bottom" height={36}/>
                           </PieChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="flex items-center justify-center h-full text-slate-500">
                           Нет данных
                       </div>
                   )}
               </div>
           </div>

           <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
               <h3 className="text-xl font-bold text-white mb-6">Рейтинг Продавцов</h3>
               <div className="overflow-x-auto">
                   <table className="w-full text-left">
                       <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                           <tr>
                               <th className="px-6 py-4">Продавец</th>
                               <th className="px-6 py-4 text-center">Кол-во заказов</th>
                               <th className="px-6 py-4 text-right">Общая выручка (USD)</th>
                               <th className="px-6 py-4 text-right">Вклад</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-700">
                           {stats.sellers.length > 0 ? stats.sellers.map((s, i) => {
                               const percent = stats.totalRevenue > 0 ? (s.totalAmount / stats.totalRevenue) * 100 : 0;
                               return (
                                   <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                                       <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md shrink-0`} style={{backgroundColor: COLORS[i % COLORS.length]}}>
                                               {s.name.charAt(0).toUpperCase()}
                                           </div>
                                           {s.name}
                                       </td>
                                       <td className="px-6 py-4 text-center text-slate-400">{s.ordersCount}</td>
                                       <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                                           {formatCurrency(s.totalAmount)}
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                           <div className="flex items-center justify-end gap-2">
                                               <span className="text-xs text-slate-500">{percent.toFixed(1)}%</span>
                                               <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                   <div className="h-full bg-emerald-500" style={{width: `${percent}%`}}></div>
                                               </div>
                                           </div>
                                       </td>
                                   </tr>
                               );
                           }) : (
                               <tr>
                                   <td colSpan={4} className="text-center py-8 text-slate-500">Нет данных о сотрудниках</td>
                               </tr>
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       </div>

       {/* CLIENT DETAILS MODAL */}
       {selectedClient && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
               <div className="bg-slate-800 rounded-2xl w-full max-w-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                   <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-500/10 rounded-full text-blue-400">
                               <Users size={24} />
                           </div>
                           <div>
                               <h3 className="text-xl font-bold text-white">{selectedClient.name}</h3>
                               <p className="text-sm text-slate-400">История покупок</p>
                           </div>
                       </div>
                       <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                           <X size={24} />
                       </button>
                   </div>
                   
                   <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase">Всего заказов</p>
                                <p className="text-2xl font-bold text-white mt-1">{selectedClient.ordersCount}</p>
                            </div>
                            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase">Куплено товаров</p>
                                <p className="text-2xl font-bold text-blue-400 mt-1">
                                    {Object.keys(selectedClient.purchasedProducts).length}
                                </p>
                            </div>
                            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase">Сумма покупок</p>
                                <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(selectedClient.totalAmount)}</p>
                            </div>
                        </div>

                        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Package size={18} className="text-slate-400"/> Приобретенная номенклатура
                        </h4>
                        
                        <div className="border border-slate-700 rounded-xl overflow-hidden">
                           <table className="w-full text-left">
                               <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                                   <tr>
                                       <th className="px-4 py-3">Товар</th>
                                       <th className="px-4 py-3 text-right">Кол-во</th>
                                       <th className="px-4 py-3 text-right">Сумма (USD)</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-700">
                                   {Object.values(selectedClient.purchasedProducts)
                                       .sort((a, b) => b.total - a.total)
                                       .map((product, idx) => (
                                       <tr key={idx} className="hover:bg-slate-700/30">
                                           <td className="px-4 py-3 font-medium text-slate-200">{product.name}</td>
                                           <td className="px-4 py-3 text-right font-mono text-slate-400">
                                               {product.quantity} <span className="text-xs">{product.unit}</span>
                                           </td>
                                           <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                                               {formatCurrency(product.total)}
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                        </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
