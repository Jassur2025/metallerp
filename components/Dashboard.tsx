import React, { useState, useEffect, useMemo } from 'react';
import { Product, Order, Client, Transaction, AppSettings } from '../types';
import { geminiService } from '../services/geminiService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid 
} from 'recharts';
import { 
  Activity, TrendingUp, Package, AlertTriangle, Sparkles, RefreshCw, BrainCircuit, 
  DollarSign, Users, ShoppingCart, Calendar, ArrowUp, ArrowDown, TrendingDown,
  Award, Target, BarChart3, Clock
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  orders: Order[];
  clients?: Client[];
  transactions?: Transaction[];
  settings?: AppSettings;
}

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

export const Dashboard: React.FC<DashboardProps> = ({ products, orders, clients = [], transactions = [], settings }) => {
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  // Filter orders by time range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const filterDate = (dateStr: string) => {
      const orderDate = new Date(dateStr);
      switch (timeRange) {
        case 'today':
          return orderDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return orderDate >= weekAgo;
        case 'month':
          return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
        case 'year':
          return orderDate.getFullYear() === now.getFullYear();
        case 'all':
        default:
          return true;
      }
    };
    return orders.filter(o => filterDate(o.date));
  }, [orders, timeRange]);

  // Calculate Stats
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalRevenueUZS = filteredOrders.reduce((sum, o) => sum + o.totalAmountUZS, 0);
  const totalOrders = filteredOrders.length;
  const lowStockCount = products.filter(p => p.quantity <= p.minStockLevel).length;
  const inventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.pricePerUnit), 0);
  
  // Average order value
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Total clients
  const totalClients = clients.length;
  const activeClients = useMemo(() => {
    const clientSet = new Set(filteredOrders.map(o => o.customerName));
    return clientSet.size;
  }, [filteredOrders]);

  // Debt amount
  const totalDebt = clients.reduce((sum, c) => sum + (c.totalDebt || 0), 0);

  // Sales by day (last 30 days or selected period)
  const salesByDay = useMemo(() => {
    const days: Record<string, { date: string; revenue: number; orders: number }> = {};
    const daysToShow = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToShow);
    
    filteredOrders.forEach(order => {
      const date = new Date(order.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      if (!days[date]) {
        days[date] = { date, revenue: 0, orders: 0 };
      }
      days[date].revenue += order.totalAmount;
      days[date].orders += 1;
    });

    // Fill missing days
    const result = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      result.push(days[dateStr] || { date: dateStr, revenue: 0, orders: 0 });
    }
    return result;
  }, [filteredOrders, timeRange]);

  // Top products by sales
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; revenue: number; quantity: number }> = {};
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.productName]) {
          productSales[item.productName] = { name: item.productName, revenue: 0, quantity: 0 };
        }
        productSales[item.productName].revenue += item.total;
        productSales[item.productName].quantity += item.quantity;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

  // Top clients by revenue
  const topClients = useMemo(() => {
    const clientSales: Record<string, { name: string; revenue: number; orders: number }> = {};
    
    filteredOrders.forEach(order => {
      const clientName = order.customerName || 'Неизвестный';
      if (!clientSales[clientName]) {
        clientSales[clientName] = { name: clientName, revenue: 0, orders: 0 };
      }
      clientSales[clientName].revenue += order.totalAmount;
      clientSales[clientName].orders += 1;
    });

    return Object.values(clientSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

  // Sales by seller
  const salesBySeller = useMemo(() => {
    const sellerSales: Record<string, { name: string; revenue: number; orders: number }> = {};
    
    filteredOrders.forEach(order => {
      const sellerName = order.sellerName || 'Не указан';
      if (!sellerSales[sellerName]) {
        sellerSales[sellerName] = { name: sellerName, revenue: 0, orders: 0 };
      }
      sellerSales[sellerName].revenue += order.totalAmount;
      sellerSales[sellerName].orders += 1;
    });

    return Object.values(sellerSales)
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Payment method distribution
  const paymentMethods = useMemo(() => {
    const methods: Record<string, number> = {};
    filteredOrders.forEach(order => {
      const method = order.paymentMethod === 'cash' ? 'Наличные' :
                    order.paymentMethod === 'bank' ? 'Перечисление' :
                    order.paymentMethod === 'card' ? 'Карта' : 'Долг';
      methods[method] = (methods[method] || 0) + order.totalAmount;
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // Previous period comparison
  const previousPeriodStats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (timeRange) {
      case 'today':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(now);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 14);
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return { revenue: 0, orders: 0 };
    }

    const prevOrders = orders.filter(o => {
      const orderDate = new Date(o.date);
      return orderDate >= startDate && orderDate <= endDate;
    });

    return {
      revenue: prevOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      orders: prevOrders.length
    };
  }, [orders, timeRange]);

  const revenueChange = previousPeriodStats.revenue > 0 
    ? ((totalRevenue - previousPeriodStats.revenue) / previousPeriodStats.revenue) * 100 
    : 0;
  const ordersChange = previousPeriodStats.orders > 0
    ? ((totalOrders - previousPeriodStats.orders) / previousPeriodStats.orders) * 100
    : 0;

  // Forecast (simple linear projection)
  const forecast = useMemo(() => {
    if (salesByDay.length < 7) return null;
    const recentDays = salesByDay.slice(-7);
    const avgDaily = recentDays.reduce((sum, d) => sum + d.revenue, 0) / recentDays.length;
    const daysInPeriod = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    return avgDaily * daysInPeriod;
  }, [salesByDay, timeRange]);

  // Improved colors for payment methods
  const PAYMENT_COLORS: Record<string, string> = {
    'Наличные': '#10b981',      // Emerald green
    'Перечисление': '#3b82f6',  // Blue
    'Карта': '#8b5cf6',         // Purple
    'Долг': '#f59e0b'           // Amber/Orange
  };
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const fetchInsight = async () => {
    setLoadingInsight(true);
    try {
      const result = await geminiService.analyzeBusiness(products, filteredOrders);
      setInsight(result);
    } catch (error) {
      errorDev("Failed to fetch insight:", error);
      setInsight("Не удалось получить аналитику. Проверьте API ключ.");
    } finally {
      setLoadingInsight(false);
    }
  };

  useEffect(() => {
    if (!insight && filteredOrders.length > 0) {
      fetchInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-auto h-full pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Обзор (Финансы USD)</h2>
          <p className="text-slate-400 mt-1">Аналитика и показатели бизнеса</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1 border border-slate-700">
          {(['today', 'week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeRange === range
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {range === 'today' ? 'Сегодня' : 
               range === 'week' ? 'Неделя' : 
               range === 'month' ? 'Месяц' : 
               range === 'year' ? 'Год' : 'Все'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-900/20 to-slate-800 p-6 rounded-2xl border border-emerald-500/20 shadow-xl hover:shadow-2xl hover:border-emerald-500/40 transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={64} className="text-emerald-500" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign size={20} className="text-emerald-400" />
            </div>
            {revenueChange !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                revenueChange > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {revenueChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(revenueChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-slate-400 font-medium text-sm mb-1">Выручка (USD)</p>
          <h3 className="text-3xl font-bold text-white mt-2 font-mono">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          {forecast && (
            <p className="text-xs text-emerald-400/70 mt-2 flex items-center gap-1">
              <TrendingUp size={12} />
              Прогноз: ${forecast.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-900/20 to-slate-800 p-6 rounded-2xl border border-blue-500/20 shadow-xl hover:shadow-2xl hover:border-blue-500/40 transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShoppingCart size={64} className="text-blue-500" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ShoppingCart size={20} className="text-blue-400" />
            </div>
            {ordersChange !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                ordersChange > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {ordersChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(ordersChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-slate-400 font-medium text-sm mb-1">Всего заказов</p>
          <h3 className="text-3xl font-bold text-white mt-2 font-mono">{totalOrders}</h3>
          <p className="text-xs text-blue-400/70 mt-2">Средний чек: ${avgOrderValue.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/20 to-slate-800 p-6 rounded-2xl border border-purple-500/20 shadow-xl hover:shadow-2xl hover:border-purple-500/40 transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={64} className="text-purple-500" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users size={20} className="text-purple-400" />
            </div>
          </div>
          <p className="text-slate-400 font-medium text-sm mb-1">Активных клиентов</p>
          <h3 className="text-3xl font-bold text-white mt-2 font-mono">{activeClients}</h3>
          <p className="text-xs text-purple-400/70 mt-2">Всего: {totalClients} | Долг: ${totalDebt.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-900/20 to-slate-800 p-6 rounded-2xl border border-orange-500/20 shadow-xl hover:shadow-2xl hover:border-orange-500/40 transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle size={64} className="text-orange-500" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle size={20} className="text-orange-400" />
            </div>
          </div>
          <p className="text-slate-400 font-medium text-sm mb-1">Мало на складе</p>
          <h3 className={`text-3xl font-bold mt-2 font-mono ${lowStockCount > 0 ? 'text-orange-400' : 'text-white'}`}>{lowStockCount}</h3>
          <p className="text-xs text-orange-400/70 mt-2">Стоимость склада: ${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" /> Динамика продаж
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Выручка']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <BarChart3 size={20} className="text-purple-400" />
              </div>
              Методы оплаты
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    if (percent < 0.05) return ''; // Hide labels for very small slices
                    return `${name}\n${(percent * 100).toFixed(0)}%`;
                  }}
                  outerRadius={90}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {paymentMethods.map((entry) => (
                    <Cell 
                      key={`cell-${entry.name}`} 
                      fill={PAYMENT_COLORS[entry.name] || COLORS[0]}
                      stroke="#1e293b"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    borderColor: '#475569', 
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ 
                    color: '#60a5fa', 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    padding: '4px 0'
                  }}
                  labelStyle={{ 
                    color: '#f1f5f9', 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    marginBottom: '6px'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Сумма']}
                  labelFormatter={(label) => label}
                />
                <Legend
                  verticalAlign="bottom"
                  height={60}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                  formatter={(value) => {
                    const entry = paymentMethods.find(p => p.name === value);
                    const percent = entry ? (entry.value / paymentMethods.reduce((sum, p) => sum + p.value, 0) * 100) : 0;
                    return `${value} (${percent.toFixed(1)}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Custom Legend Below */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {paymentMethods.map((method) => {
              const total = paymentMethods.reduce((sum, p) => sum + p.value, 0);
              const percent = total > 0 ? (method.value / total * 100) : 0;
              return (
                <div key={method.name} className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                  <div 
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: PAYMENT_COLORS[method.name] || COLORS[0] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{method.name}</p>
                    <p className="text-xs text-slate-400">${method.value.toFixed(2)}</p>
                  </div>
                  <p className="text-slate-300 font-bold text-sm">{percent.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Award size={20} className="text-amber-400" />
              </div>
              Топ товаров
            </h3>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div 
                  key={product.name} 
                  className="group flex items-center justify-between p-4 bg-gradient-to-r from-slate-900/50 to-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all hover:shadow-lg"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0 ${
                      index === 0 ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400 border border-amber-500/20' :
                      index === 1 ? 'bg-gradient-to-br from-slate-500/20 to-slate-600/10 text-slate-300 border border-slate-500/20' :
                      index === 2 ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-400 border border-orange-500/20' :
                      'bg-gradient-to-br from-slate-700/20 to-slate-800/10 text-slate-400 border border-slate-700/20'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{product.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{product.quantity.toFixed(1)} шт продано</p>
                    </div>
                  </div>
                  <div className="ml-3 text-right flex-shrink-0">
                    <p className="text-emerald-400 font-mono font-bold text-base">${product.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-50" />
                <p className="text-slate-500">Нет данных</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Users size={20} className="text-indigo-400" />
              </div>
              Топ клиентов
            </h3>
          </div>
          <div className="space-y-3">
            {topClients.length > 0 ? (
              topClients.map((client, index) => (
                <div 
                  key={client.name} 
                  className="group flex items-center justify-between p-4 bg-gradient-to-r from-slate-900/50 to-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all hover:shadow-lg"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0 ${
                      index === 0 ? 'bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 text-indigo-400 border border-indigo-500/20' :
                      index === 1 ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-purple-400 border border-purple-500/20' :
                      index === 2 ? 'bg-gradient-to-br from-pink-500/20 to-pink-600/10 text-pink-400 border border-pink-500/20' :
                      'bg-gradient-to-br from-slate-700/20 to-slate-800/10 text-slate-400 border border-slate-700/20'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{client.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{client.orders} {client.orders === 1 ? 'заказ' : 'заказов'}</p>
                    </div>
                  </div>
                  <div className="ml-3 text-right flex-shrink-0">
                    <p className="text-emerald-400 font-mono font-bold text-base">${client.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-50" />
                <p className="text-slate-500">Нет данных</p>
              </div>
            )}
          </div>
        </div>

        {/* Sales by Seller */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Target size={20} className="text-emerald-400" />
              </div>
              Продавцы
            </h3>
          </div>
          <div className="space-y-3">
            {salesBySeller.length > 0 ? (
              salesBySeller.map((seller, index) => {
                const avgSellerOrder = seller.orders > 0 ? seller.revenue / seller.orders : 0;
                const maxRevenue = salesBySeller[0]?.revenue || 1;
                const percentage = (seller.revenue / maxRevenue) * 100;
                return (
                  <div 
                    key={seller.name} 
                    className="group p-4 bg-gradient-to-r from-slate-900/50 to-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 flex items-center justify-center border border-emerald-500/20">
                          <span className="text-emerald-400 font-bold text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{seller.name}</p>
                          <p className="text-xs text-slate-400">{seller.orders} {seller.orders === 1 ? 'заказ' : 'заказов'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-mono font-bold text-base">${seller.revenue.toFixed(2)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">${avgSellerOrder.toFixed(2)}/заказ</p>
                      </div>
                    </div>
                    <div className="relative w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/20"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Target className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-50" />
                <p className="text-slate-500">Нет данных</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
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

        <div className="space-y-4 min-h-[150px]">
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
  );
};
