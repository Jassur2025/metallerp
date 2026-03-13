import React, { useMemo, useState } from 'react';
import { Purchase, Transaction } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { useSuppliers } from '../hooks/useSuppliers';
import { Search, Truck, AlertTriangle, TrendingDown, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Supplier } from '../types';

interface AccountsPayableProps {
  purchases: Purchase[];
  transactions: Transaction[];
  settings: { defaultExchangeRate: number };
}

interface SupplierDebtRow {
  supplierId: string;
  supplierName: string;
  supplier?: Supplier;
  totalDebt: number;
  totalPurchases: number;
  unpaidPurchasesCount: number;
  oldestDebtDate: string | null;
  daysSinceOldest: number;
}

export const AccountsPayable: React.FC<AccountsPayableProps> = ({ purchases, transactions, settings }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const { suppliers } = useSuppliers({ realtime: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'debt' | 'name' | 'days'>('debt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const exchangeRate = settings.defaultExchangeRate || 12800;

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate debts for all suppliers
  const debtRows = useMemo((): SupplierDebtRow[] => {
    // Group purchases by supplier
    const supplierMap = new Map<string, {
      name: string;
      supplier?: Supplier;
      totalDebt: number;
      totalPurchases: number;
      unpaidCount: number;
      oldestDate: string | null;
      purchaseIds: Set<string>;
    }>();

    purchases.forEach(purchase => {
      const key = purchase.supplierId || purchase.supplierName || 'unknown';
      const existing = supplierMap.get(key);

      const isDebt = purchase.paymentMethod === 'debt' ||
        purchase.paymentStatus === 'unpaid' ||
        purchase.paymentStatus === 'partial';

      // Convert purchase amount to USD
      const purchaseAmountUSD = purchase.totalLandedAmount || 
        (purchase.totalInvoiceAmountUZS ? purchase.totalInvoiceAmountUZS / (purchase.exchangeRate || exchangeRate) : 0);
      const paidUSD = purchase.amountPaidUSD || 
        (purchase.amountPaid ? purchase.amountPaid / (purchase.exchangeRate || exchangeRate) : 0);

      if (existing) {
        existing.totalPurchases += purchaseAmountUSD;
        if (isDebt) {
          existing.totalDebt += purchaseAmountUSD;
          existing.unpaidCount++;
          existing.purchaseIds.add(purchase.id);
          if (!existing.oldestDate || purchase.date < existing.oldestDate) {
            existing.oldestDate = purchase.date;
          }
        }
      } else {
        const supplier = suppliers.find(s => s.id === purchase.supplierId);
        supplierMap.set(key, {
          name: supplier?.name || purchase.supplierName || 'Неизвестный',
          supplier,
          totalDebt: isDebt ? purchaseAmountUSD : 0,
          totalPurchases: purchaseAmountUSD,
          unpaidCount: isDebt ? 1 : 0,
          oldestDate: isDebt ? purchase.date : null,
          purchaseIds: isDebt ? new Set([purchase.id]) : new Set(),
        });
      }
    });

    // Subtract supplier payments from transactions
    const rows: SupplierDebtRow[] = [];
    supplierMap.forEach((data, key) => {
      let totalRepaid = 0;

      transactions.forEach(tx => {
        if (tx.type !== 'supplier_payment') return;
        // Match by supplierId or by relatedId matching a purchase ID
        const matchesBySupplier = tx.supplierId === key || tx.relatedId === key;
        const matchesByPurchase = tx.relatedId ? data.purchaseIds.has(tx.relatedId) : false;

        if (!matchesBySupplier && !matchesByPurchase) return;

        let amountInUSD = tx.amount || 0;
        if (tx.currency === 'UZS' && tx.exchangeRate) {
          amountInUSD = (tx.amount || 0) / tx.exchangeRate;
        }
        totalRepaid += amountInUSD;
      });

      const debt = Math.max(0, data.totalDebt - totalRepaid);
      const daysSinceOldest = data.oldestDate
        ? Math.floor((Date.now() - new Date(data.oldestDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (debt > 0.01) {
        rows.push({
          supplierId: key,
          supplierName: data.name,
          supplier: data.supplier,
          totalDebt: debt,
          totalPurchases: data.totalPurchases,
          unpaidPurchasesCount: data.unpaidCount,
          oldestDebtDate: data.oldestDate,
          daysSinceOldest,
        });
      }
    });

    return rows;
  }, [purchases, transactions, suppliers, exchangeRate]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let rows = debtRows.filter(r => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return r.supplierName.toLowerCase().includes(s) ||
        (r.supplier?.companyName || '').toLowerCase().includes(s) ||
        (r.supplier?.phone || '').includes(s);
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'debt') cmp = a.totalDebt - b.totalDebt;
      else if (sortField === 'name') cmp = a.supplierName.localeCompare(b.supplierName);
      else if (sortField === 'days') cmp = a.daysSinceOldest - b.daysSinceOldest;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return rows;
  }, [debtRows, searchTerm, sortField, sortDir]);

  const totalPayable = useMemo(() => debtRows.reduce((s, r) => s + r.totalDebt, 0), [debtRows]);
  const overdueCount = useMemo(() => debtRows.filter(r => r.daysSinceOldest > 30).length, [debtRows]);

  const toggleSort = (field: 'debt' | 'name' | 'days') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Get unpaid purchases for an expanded supplier
  const getSupplierUnpaidPurchases = (supplierId: string) => {
    return purchases.filter(p => {
      const key = p.supplierId || p.supplierName || 'unknown';
      if (key !== supplierId) return false;
      return p.paymentMethod === 'debt' || p.paymentStatus === 'unpaid' || p.paymentStatus === 'partial';
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
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Truck className="text-blue-500" size={20} />
            </div>
            <span className={`text-sm ${t.textMuted}`}>Кредиторов</span>
          </div>
          <p className={`text-2xl font-bold ${t.text}`}>{debtRows.length}</p>
        </div>

        <div className={`${t.bgCard} border ${t.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <TrendingDown className="text-red-500" size={20} />
            </div>
            <span className={`text-sm ${t.textMuted}`}>Общая кредиторка</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalPayable)}</p>
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
          placeholder="Поиск по имени поставщика, компании..."
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
            Поставщик <ArrowUpDown size={12} />
          </button>
          <span className="text-right">Закупки</span>
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
            {searchTerm ? 'Ничего не найдено' : 'Нет кредиторской задолженности'}
          </div>
        ) : filteredRows.map((row, i) => {
          const isExpanded = expandedSupplier === row.supplierId;
          return (
            <div key={row.supplierId}>
              <div
                onClick={() => setExpandedSupplier(isExpanded ? null : row.supplierId)}
                className={`grid grid-cols-[1fr_140px_130px_100px_100px] gap-3 items-center px-5 py-3.5 cursor-pointer transition-colors
                  ${i % 2 === 0 ? '' : (theme === 'light' ? 'bg-slate-50/50' : 'bg-slate-800/30')}
                  ${theme === 'light' ? 'hover:bg-blue-50/60' : 'hover:bg-slate-700/40'}`}
              >
                {/* Supplier */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600">
                    {row.supplierName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${t.text} truncate`}>{row.supplierName}</div>
                    {row.supplier?.phone && (
                      <div className={`text-[10px] ${t.textMuted} truncate`}>{row.supplier.phone}</div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={14} className={t.textMuted} /> : <ChevronDown size={14} className={t.textMuted} />}
                </div>

                {/* Total Purchases */}
                <span className="text-sm font-mono text-blue-500 font-medium text-right">
                  {formatCurrency(row.totalPurchases)}
                </span>

                {/* Debt */}
                <span className="text-sm font-mono font-bold text-right text-red-500">
                  {formatCurrency(row.totalDebt)}
                </span>

                {/* Unpaid Count */}
                <span className={`text-sm text-center ${t.textMuted}`}>
                  {row.unpaidPurchasesCount}
                </span>

                {/* Days */}
                <span className={`text-sm font-mono font-medium text-right ${getAgingColor(row.daysSinceOldest)}`}>
                  {row.daysSinceOldest}д
                </span>
              </div>

              {/* Expanded: unpaid purchases */}
              {isExpanded && (
                <div className={`px-6 py-3 border-t ${t.border} ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-slate-50/80'}`}>
                  <p className={`text-xs font-semibold ${t.textMuted} mb-2 uppercase`}>Неоплаченные закупки</p>
                  <div className="space-y-2">
                    {getSupplierUnpaidPurchases(row.supplierId).map(purchase => {
                      const daysAgo = Math.floor((Date.now() - new Date(purchase.date).getTime()) / (1000 * 60 * 60 * 24));
                      const amountUSD = purchase.totalLandedAmount || 
                        (purchase.totalInvoiceAmountUZS ? purchase.totalInvoiceAmountUZS / (purchase.exchangeRate || exchangeRate) : 0);
                      const paidUSD = purchase.amountPaidUSD || 0;
                      const remaining = amountUSD - paidUSD;
                      return (
                        <div key={purchase.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${getAgingBg(daysAgo)}`}>
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-mono ${t.textMuted}`}>{purchase.id.slice(0, 8)}</span>
                            <span className={`text-xs ${t.textMuted}`}>{new Date(purchase.date).toLocaleDateString('ru-RU')}</span>
                            <span className={`text-xs ${t.text}`}>
                              {purchase.items.map(i => i.productName).join(', ').slice(0, 50)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-mono ${t.textMuted}`}>
                              Всего: {formatCurrency(amountUSD)}
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
