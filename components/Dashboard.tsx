import React, { useState, useEffect, useMemo } from 'react';
import { Product, Order, Client, Transaction, AppSettings } from '../types';
import { geminiService } from '../services/geminiService';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { validateUSD } from '../utils/finance';
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
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

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
  const num = (v: any): number => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^\d.-]/g, ''));
      return isFinite(p) ? p : 0;
    }
    return 0;
  };

  const totalRevenue = filteredOrders.reduce((sum, o) => {
    let amt = num(o.totalAmount);
    if (amt === 0 && o.items && o.items.length > 0) {
      amt = o.items.reduce((s, it) => s + num(it.total), 0);
    }
    return sum + validateUSD(amt, settings?.defaultExchangeRate || 12800);
  }, 0);

  const totalRevenueUZS = filteredOrders.reduce((sum, o) => sum + num(o.totalAmountUZS), 0);
  const totalOrders = filteredOrders.length;
  const lowStockCount = products.filter(p => num(p.quantity) <= num(p.minStockLevel)).length;
  const inventoryValue = products.reduce((sum, p) => sum + (num(p.quantity) * num(p.pricePerUnit)), 0);

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
      days[date].revenue += validateUSD(order.totalAmount, settings?.defaultExchangeRate || 12800);
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
          <h2 className={`text-3xl font-bold ${t.text} tracking-tight`}>Обзор (Финансы USD)</h2>
          <p className={`${t.textMuted} mt-1`}>Аналитика и показатели бизнеса</p>
        </div>

        {/* Time Range Selector */}
        <div className={`flex items-center gap-2 ${t.bgCard} rounded-xl p-1 border ${t.border}`}>
          {(['today', 'week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === range
                ? t.tabActive
                : t.tabInactive
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
        <div className={`${t.bgStatEmerald} p-6 rounded-2xl border shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group`}>
          <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
            <DollarSign size={64} className={t.iconEmerald} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 ${t.iconBgEmerald} rounded-lg`}>
              <DollarSign size={20} className={t.iconEmerald} />
            </div>
            {revenueChange !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${revenueChange > 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
                }`}>
                {revenueChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(revenueChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className={`${t.textMuted} font-medium text-sm mb-1`}>Выручка (USD)</p>
          <h3 className={`text-3xl font-bold ${t.text} mt-2 font-mono`}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          {forecast && (
            <p className={`text-xs ${t.iconEmerald} opacity-70 mt-2 flex items-center gap-1`}>
              <TrendingUp size={12} />
              Прогноз: ${forecast.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          )}
        </div>

        <div className={`${t.bgStatBlue} p-6 rounded-2xl border shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group`}>
          <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
            <ShoppingCart size={64} className={t.iconBlue} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 ${t.iconBgBlue} rounded-lg`}>
              <ShoppingCart size={20} className={t.iconBlue} />
            </div>
            {ordersChange !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ordersChange > 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
                }`}>
                {ordersChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(ordersChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className={`${t.textMuted} font-medium text-sm mb-1`}>Всего заказов</p>
          <h3 className={`text-3xl font-bold ${t.text} mt-2 font-mono`}>{totalOrders}</h3>
          <p className={`text-xs ${t.iconBlue} opacity-70 mt-2`}>Средний чек: ${avgOrderValue.toFixed(2)}</p>
        </div>

        <div className={`${t.bgStatPurple} p-6 rounded-2xl border shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group`}>
          <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
            <Users size={64} className={t.iconPurple} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 ${t.iconBgPurple} rounded-lg`}>
              <Users size={20} className={t.iconPurple} />
            </div>
          </div>
          <p className={`${t.textMuted} font-medium text-sm mb-1`}>Активных клиентов</p>
          <h3 className={`text-3xl font-bold ${t.text} mt-2 font-mono`}>{activeClients}</h3>
          <p className={`text-xs ${t.iconPurple} opacity-70 mt-2`}>Всего: {totalClients} | Долг: ${totalDebt.toFixed(2)}</p>
        </div>

        <div className={`${t.bgStatAmber} p-6 rounded-2xl border shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group`}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle size={64} className={t.iconAmber} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 ${t.iconBgAmber} rounded-lg`}>
              <AlertTriangle size={20} className={t.iconAmber} />
            </div>
          </div>
          <p className={`${t.textMuted} font-medium text-sm mb-1`}>Мало на складе</p>
          <h3 className={`text-3xl font-bold mt-2 font-mono ${lowStockCount > 0 ? t.iconAmber : t.text}`}>{lowStockCount}</h3>
          <p className={`text-xs ${t.iconAmber} opacity-70 mt-2`}>Стоимость склада: ${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className={`${t.bgCard} rounded-2xl border ${t.border} p-6 ${t.shadow}`}>
          <h3 className={`text-xl font-bold ${t.text} mb-6 flex items-center gap-2`}>
            <TrendingUp size={20} className={t.iconBlue} /> Динамика продаж
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#334155'} />
                <XAxis dataKey="date" stroke={theme === 'light' ? '#64748b' : '#64748b'} fontSize={12} tickLine={false} />
                <YAxis stroke={theme === 'light' ? '#64748b' : '#64748b'} fontSize={12} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e293b', borderColor: theme === 'light' ? '#e2e8f0' : '#334155', color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Выручка']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className={`${t.bgCard} rounded-2xl border ${t.border} p-6 ${t.shadow}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
              <div className={`p-2 ${t.iconBgPurple} rounded-lg`}>
                <BarChart3 size={20} className={t.iconPurple} />
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
                  label={({ name, percent }: any) => {
                    if (!percent || percent < 0.05) return '';
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
                      stroke={theme === 'light' ? '#fff' : '#1e293b'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'light' ? '#fff' : '#1e293b',
                    borderColor: theme === 'light' ? '#e2e8f0' : '#475569',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    color: theme === 'light' ? '#1e293b' : '#f1f5f9'
                  }}
                  itemStyle={{
                    color: '#60a5fa',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    padding: '4px 0'
                  }}
                  labelStyle={{
                    color: theme === 'light' ? '#1e293b' : '#f1f5f9',
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
                  wrapperStyle={{ fontSize: '12px', color: theme === 'light' ? '#64748b' : '#94a3b8' }}
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
                <div key={method.name} className={`flex items-center gap-2 p-2 ${t.bgPanelAlt} rounded-lg`}>
                  <div
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: PAYMENT_COLORS[method.name] || COLORS[0] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`${t.text} text-sm font-medium truncate`}>{method.name}</p>
                    <p className={`text-xs ${t.textMuted}`}>${method.value.toFixed(2)}</p>
                  </div>
                  <p className={`${t.textSecondary} font-bold text-sm`}>{percent.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className={`${t.bgCard} rounded-2xl border ${t.border} p-6 ${t.shadow}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
              <div className={`p-2 ${t.iconBgAmber} rounded-lg`}>
                <Award size={20} className={t.iconAmber} />
              </div>
              Топ товаров
            </h3>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className={`group flex items-center justify-between p-4 ${t.bgPanelAlt} rounded-xl border ${t.border} hover:${theme === 'light' ? 'border-slate-300' : 'border-slate-600'} transition-all hover:shadow-lg`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0 ${index === 0 ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-500 border border-amber-500/20' :
                      index === 1 ? 'bg-gradient-to-br from-slate-500/20 to-slate-600/10 text-slate-500 border border-slate-500/20' :
                        index === 2 ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-500 border border-orange-500/20' :
                          'bg-gradient-to-br from-slate-700/20 to-slate-800/10 text-slate-500 border border-slate-700/20'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`${t.text} font-semibold text-sm truncate`}>{product.name}</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>{product.quantity.toFixed(1)} шт продано</p>
                    </div>
                  </div>
                  <div className="ml-3 text-right flex-shrink-0">
                    <p className={`${t.success} font-mono font-bold text-base`}>${product.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Package className={`w-12 h-12 mx-auto mb-3 ${t.textMuted} opacity-50`} />
                <p className={t.textMuted}>Нет данных</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Clients */}
        <div className={`${t.bgCard} rounded-2xl border ${t.border} p-6 ${t.shadow}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
              <div className={`p-2 ${t.iconBgPurple} rounded-lg`}>
                <Users size={20} className={t.iconPurple} />
              </div>
              Топ клиентов
            </h3>
          </div>
          <div className="space-y-3">
            {topClients.length > 0 ? (
              topClients.map((client, index) => (
                <div
                  key={client.name}
                  className={`group flex items-center justify-between p-4 ${t.bgPanelAlt} rounded-xl border ${t.border} hover:${theme === 'light' ? 'border-slate-300' : 'border-slate-600'} transition-all hover:shadow-lg`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0 ${index === 0 ? 'bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 text-indigo-500 border border-indigo-500/20' :
                      index === 1 ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-purple-500 border border-purple-500/20' :
                        index === 2 ? 'bg-gradient-to-br from-pink-500/20 to-pink-600/10 text-pink-500 border border-pink-500/20' :
                          'bg-gradient-to-br from-slate-700/20 to-slate-800/10 text-slate-500 border border-slate-700/20'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`${t.text} font-semibold text-sm truncate`}>{client.name}</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>{client.orders} {client.orders === 1 ? 'заказ' : 'заказов'}</p>
                    </div>
                  </div>
                  <div className="ml-3 text-right flex-shrink-0">
                    <p className={`${t.success} font-mono font-bold text-base`}>${client.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Users className={`w-12 h-12 mx-auto mb-3 ${t.textMuted} opacity-50`} />
                <p className={t.textMuted}>Нет данных</p>
              </div>
            )}
          </div>
        </div>

        {/* Sales by Seller */}
        <div className={`${t.bgCard} rounded-2xl border ${t.border} p-6 ${t.shadow}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
              <div className={`p-2 ${t.iconBgEmerald} rounded-lg`}>
                <Target size={20} className={t.iconEmerald} />
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
                    className={`group p-4 ${t.bgPanelAlt} rounded-xl border ${t.border} hover:${theme === 'light' ? 'border-slate-300' : 'border-slate-600'} transition-all hover:shadow-lg`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${t.iconBgEmerald} flex items-center justify-center border border-emerald-500/20`}>
                          <span className={`${t.iconEmerald} font-bold text-sm`}>{index + 1}</span>
                        </div>
                        <div>
                          <p className={`${t.text} font-semibold text-sm`}>{seller.name}</p>
                          <p className={`text-xs ${t.textMuted}`}>{seller.orders} {seller.orders === 1 ? 'заказ' : 'заказов'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`${t.success} font-mono font-bold text-base`}>${seller.revenue.toFixed(2)}</p>
                        <p className={`text-xs ${t.textMuted} mt-0.5`}>${avgSellerOrder.toFixed(2)}/заказ</p>
                      </div>
                    </div>
                    <div className={`relative w-full ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-700/50'} rounded-full h-2 overflow-hidden`}>
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
                <Target className={`w-12 h-12 mx-auto mb-3 ${t.textMuted} opacity-50`} />
                <p className={t.textMuted}>Нет данных</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className={`${theme === 'light' ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-br from-slate-800 to-indigo-900/20 border-indigo-500/30'} rounded-2xl border p-6 ${t.shadow} relative overflow-hidden`}>
        <div className={`absolute -top-10 -right-10 w-32 h-32 ${theme === 'light' ? 'bg-blue-200/50' : 'bg-indigo-500/20'} rounded-full blur-3xl`}></div>

        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <Sparkles size={20} className={theme === 'light' ? 'text-blue-600' : 'text-indigo-400'} /> AI Аналитика
          </h3>
          <button
            onClick={fetchInsight}
            disabled={loadingInsight}
            className={`p-2 ${t.bgButton} rounded-full ${theme === 'light' ? 'text-blue-600' : 'text-indigo-300'} transition-colors`}
          >
            <RefreshCw size={16} className={loadingInsight ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-4 min-h-[150px]">
          {loadingInsight ? (
            <div className={`flex flex-col items-center justify-center h-full ${t.textMuted} gap-3 pt-10`}>
              <RefreshCw size={24} className={`animate-spin ${theme === 'light' ? 'text-blue-500' : 'text-indigo-500'}`} />
              <span className="text-sm">Анализ данных...</span>
            </div>
          ) : (
            <div className={`${t.textSecondary} text-sm leading-relaxed whitespace-pre-line ${theme === 'light' ? 'bg-white/70 border-blue-100' : 'bg-slate-900/40 border-indigo-500/10'} p-4 rounded-xl border`}>
              {insight || "Нажмите кнопку обновления для получения аналитики от Gemini AI."}
            </div>
          )}
        </div>

        <div className={`mt-6 pt-4 border-t ${theme === 'light' ? 'border-blue-200' : 'border-indigo-500/10'}`}>
          <p className={`text-xs ${theme === 'light' ? 'text-blue-500' : 'text-indigo-300/60'} flex items-center gap-1`}>
            <BrainCircuit size={12} /> Powered by Gemini 2.5 Flash
          </p>
        </div>
      </div>
    </div>
  );
};
