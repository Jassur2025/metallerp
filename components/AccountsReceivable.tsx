import React, { useMemo, useState } from 'react';
import { Client } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { useClients } from '../hooks/useClients';
import { useOrders } from '../hooks/useOrders';
import { useTransactions } from '../hooks/useTransactions';
import { useCRMDebt, orderMatchesClient } from '../hooks/useCRMDebt';
import { Search, Users, AlertTriangle, TrendingDown, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface AccountsReceivableProps {}

interface ClientDebtRow {
  client: Client;
  totalDebt: number;
  totalSales: number;
  unpaidOrdersCount: number;
  oldestDebtDate: string | null;
  daysSinceOldest: number;
}

export const AccountsReceivable: React.FC<AccountsReceivableProps> = () => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const { clients } = useClients();
  const { orders } = useOrders();
  const { transactions } = useTransactions();
  
  // Use the exact same debt calculation as CRM
  const { calculateClientDebt } = useCRMDebt({
    orders,
    transactions,
    selectedClientForRepayment: null,
    selectedClientForHistory: null,
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'debt' | 'name' | 'days'>('debt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate debts for all clients using CRM's exact logic
  const debtRows = useMemo((): ClientDebtRow[] => {
    return clients.map(client => {
      const debt = calculateClientDebt(client);
      
      let totalSales = 0;
      let unpaidOrdersCount = 0;
      let oldestDebtDate: string | null = null;

      orders.forEach(order => {
        if (!orderMatchesClient(order, client)) return;
        totalSales += order.totalAmount || 0;

        const wasDebtOrder = order.paymentMethod === 'debt' ||
          order.paymentStatus === 'unpaid' ||
          order.paymentStatus === 'partial';

        if (wasDebtOrder) {
          unpaidOrdersCount++;
          if (!oldestDebtDate || order.date < oldestDebtDate) {
            oldestDebtDate = order.date;
          }
        }
      });

      const daysSinceOldest = oldestDebtDate
        ? Math.floor((Date.now() - new Date(oldestDebtDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return { client, totalDebt: debt, totalSales, unpaidOrdersCount, oldestDebtDate, daysSinceOldest };
    }).filter(r => r.totalDebt > 0.01);
  }, [clients, orders, transactions, calculateClientDebt]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let rows = debtRows.filter(r => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return r.client.name.toLowerCase().includes(s) ||
        (r.client.companyName || '').toLowerCase().includes(s) ||
        (r.client.phone || '').includes(s);
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'debt') cmp = a.totalDebt - b.totalDebt;
      else if (sortField === 'name') cmp = a.client.name.localeCompare(b.client.name);
      else if (sortField === 'days') cmp = a.daysSinceOldest - b.daysSinceOldest;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return rows;
  }, [debtRows, searchTerm, sortField, sortDir]);

  const totalReceivable = useMemo(() => debtRows.reduce((s, r) => s + r.totalDebt, 0), [debtRows]);
  const overdueCount = useMemo(() => debtRows.filter(r => r.daysSinceOldest > 30).length, [debtRows]);

  const toggleSort = (field: 'debt' | 'name' | 'days') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Get unpaid orders for an expanded client
  const getClientUnpaidOrders = (client: Client) => {
    return orders.filter(o => {
      if (!orderMatchesClient(o, client)) return false;
      return o.paymentMethod === 'debt' || o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial';
    }).sort((a, b) => a.date.localeCompare(b.date));
  };

  const getAgingColor = (days: number) => {
    if (days > 90) return 'text-red-600';
    if (days > 60) return 'text-orange-500';
    if (days > 30) return 'text-amber-500';
    return theme === 'dark' ? 'text-slate-300' : 'text-slate-700';
  };

  const getAgingBg = (days: number) => {
    if (days > 90) return 'bg-red-500/10 border-red-500/20';
    if (days > 60) return 'bg-orange-500/10 border-orange-500/20';
    if (days > 30) return 'bg-amber-500/10 border-amber-500/20';
    return theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full custom-scrollbar">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${t.bgCard} border ${t.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Users className="text-amber-500" size={20} />
            </div>
            <span className={`text-sm ${t.textMuted}`}>Дебиторов</span>
          </div>
          <p className={`text-2xl font-bold ${t.text}`}>{debtRows.length}</p>
        </div>

        <div className={`${t.bgCard} border ${t.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <TrendingDown className="text-red-500" size={20} />
            </div>
            <span className={`text-sm ${t.textMuted}`}>Общая дебиторка</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalReceivable)}</p>
        </div>

        <div className={`${t.bgCard} border ${t.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertTriangle className="text-orange-500" size={20} />
            </div>
            <span className={`text-sm ${t.textMuted}`}>Просрочено &gt;30 дней</span>
          </div>
          <p className="text-2xl font-bold text-orange-500">{overdueCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
        <input
          type="text"
          placeholder="Поиск по имени, компании, телефону..."
          className={`w-full ${t.bgCard} border ${t.border} rounded-xl pl-10 pr-4 py-3 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className={`${t.bgCard} border ${t.border} rounded-xl overflow-hidden`}>
        {/* Header */}
        <div className={`grid grid-cols-[1fr_140px_130px_100px_100px] gap-3 px-5 py-3 ${theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-slate-800/60 border-b border-slate-700'} text-[11px] font-semibold uppercase ${t.textMuted}`}>
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left">
            Клиент <ArrowUpDown size={12} />
          </button>
          <span className="text-right">Продажи</span>
          <button onClick={() => toggleSort('debt')} className="flex items-center gap-1 justify-end">
            Долг <ArrowUpDown size={12} />
          </button>
          <span className="text-center">Заказов</span>
          <button onClick={() => toggleSort('days')} className="flex items-center gap-1 justify-end">
            Дней <ArrowUpDown size={12} />
          </button>
        </div>

        {/* Rows */}
        {filteredRows.length === 0 ? (
          <div className={`text-center py-12 ${t.textMuted}`}>
            {searchTerm ? 'Ничего не найдено' : 'Нет дебиторской задолженности'} 
          </div>
        ) : filteredRows.map((row, i) => {
          const isExpanded = expandedClient === row.client.id;
          const isLegal = row.client.type === 'legal';
          return (
            <div key={row.client.id}>
              <div
                onClick={() => setExpandedClient(isExpanded ? null : row.client.id)}
                className={`grid grid-cols-[1fr_140px_130px_100px_100px] gap-3 items-center px-5 py-3.5 cursor-pointer transition-colors
                  ${i % 2 === 0 ? '' : (theme === 'light' ? 'bg-slate-50/50' : 'bg-slate-800/30')}
                  ${theme === 'light' ? 'hover:bg-blue-50/60' : 'hover:bg-slate-700/40'}`}
              >
                {/* Client */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${isLegal ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
                    {isLegal ? '🏢' : row.client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${t.text} truncate`}>
                      {isLegal && row.client.companyName ? row.client.companyName : row.client.name}
                    </div>
                    {row.client.phone && (
                      <div className={`text-[10px] ${t.textMuted} truncate`}>{row.client.phone}</div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={14} className={t.textMuted} /> : <ChevronDown size={14} className={t.textMuted} />}
                </div>

                {/* Total Sales */}
                <span className="text-sm font-mono text-emerald-500 font-medium text-right">
                  {formatCurrency(row.totalSales)}
                </span>

                {/* Debt */}
                <span className={`text-sm font-mono font-bold text-right text-red-500`}>
                  {formatCurrency(row.totalDebt)}
                </span>

                {/* Unpaid Orders Count */}
                <span className={`text-sm text-center ${t.textMuted}`}>
                  {row.unpaidOrdersCount}
                </span>

                {/* Days since oldest */}
                <span className={`text-sm font-mono font-medium text-right ${getAgingColor(row.daysSinceOldest)}`}>
                  {row.daysSinceOldest}д
                </span>
              </div>

              {/* Expanded: unpaid orders */}
              {isExpanded && (
                <div className={`px-6 py-3 border-t ${t.border} ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-slate-50/80'}`}>
                  <p className={`text-xs font-semibold ${t.textMuted} mb-2 uppercase`}>Неоплаченные заказы</p>
                  <div className="space-y-2">
                    {getClientUnpaidOrders(row.client).map(order => {
                      const daysAgo = Math.floor((Date.now() - new Date(order.date).getTime()) / (1000 * 60 * 60 * 24));
                      const remaining = (order.totalAmount || 0) - (order.amountPaid || 0);
                      return (
                        <div key={order.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${getAgingBg(daysAgo)}`}>
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-mono ${t.textMuted}`}>
                              {order.reportNo ? `#${order.reportNo}` : order.id.slice(0, 8)}
                            </span>
                            <span className={`text-xs ${t.textMuted}`}>{new Date(order.date).toLocaleDateString('ru-RU')}</span>
                            <span className={`text-xs ${t.text}`}>
                              {order.items.map(i => i.productName).join(', ').slice(0, 50)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-mono ${t.textMuted}`}>
                              Всего: {formatCurrency(order.totalAmount)}
                            </span>
                            <span className="text-xs font-mono text-red-500 font-bold">
                              Долг: {formatCurrency(Math.max(0, remaining))}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${getAgingBg(daysAgo)} ${getAgingColor(daysAgo)} font-medium`}>
                              {daysAgo}д
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
