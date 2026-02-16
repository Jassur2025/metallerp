import React, { useMemo, useState } from 'react';
import { Order, Product, Transaction } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Table, Search, Download, Filter, Calendar, User, ShoppingCart, Package, ChevronDown, ChevronUp } from 'lucide-react';

interface SalesStatisticsProps {
  orders: Order[];
  products: Product[];
  transactions: Transaction[];
}

interface SalesRow {
  orderId: string;
  date: string;
  customerName: string;
  sellerName: string;
  dimensions: string; // Размер товара
  productName: string;
  quantity: number;
  unit: string;
  priceAtSale: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentCurrency: string;
  totalAmountUZS: number;
}

export const SalesStatistics: React.FC<SalesStatisticsProps> = ({ orders, products, transactions }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'product' | 'seller' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const safeNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // Transform orders into detailed rows
  const salesRows = useMemo(() => {
    const rows: SalesRow[] = [];

    orders.forEach(order => {
      if (!order.items || !Array.isArray(order.items)) return;

      order.items.forEach((item) => {
        // Найти размер товара по productId
        const product = products.find(p => p.id === item.productId);
        const dimensions = product?.dimensions || '-';

        rows.push({
          orderId: order.id,
          date: order.date,
          customerName: order.customerName || 'Неизвестный',
          sellerName: order.sellerName || 'Не указан',
          dimensions: dimensions,
          productName: item.productName,
          quantity: safeNumber(item.quantity),
          unit: item.unit,
          priceAtSale: safeNumber(item.priceAtSale),
          total: safeNumber(item.total),
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          paymentCurrency: order.paymentCurrency || (order.paymentMethod === 'cash' ? 'USD' : (order.paymentMethod === 'debt' ? 'USD' : 'UZS')),
          totalAmountUZS: safeNumber(order.totalAmountUZS)
        });
      });
    });

    return rows;
  }, [orders, products]);

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let filtered = salesRows.filter(row => {
      const matchesSearch =
        row.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.orderId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCustomer = !filterCustomer || row.customerName === filterCustomer;
      const matchesSeller = !filterSeller || row.sellerName === filterSeller;
      const matchesProduct = !filterProduct || row.productName === filterProduct;
      const matchesPaymentMethod = !filterPaymentMethod || row.paymentMethod === filterPaymentMethod;

      const matchesDateFrom = !dateFrom || new Date(row.date) >= new Date(dateFrom);
      const matchesDateTo = !dateTo || new Date(row.date) <= new Date(dateTo + 'T23:59:59');

      return matchesSearch && matchesCustomer && matchesSeller && matchesProduct &&
        matchesPaymentMethod && matchesDateFrom && matchesDateTo;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string, bVal: number | string;

      switch (sortBy) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'customer':
          aVal = a.customerName;
          bVal = b.customerName;
          break;
        case 'product':
          aVal = a.productName;
          bVal = b.productName;
          break;
        case 'seller':
          aVal = a.sellerName;
          bVal = b.sellerName;
          break;
        case 'total':
          aVal = a.total;
          bVal = b.total;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [salesRows, searchTerm, filterCustomer, filterSeller, filterProduct, filterPaymentMethod, dateFrom, dateTo, sortBy, sortOrder]);

  // Get unique values for filters
  const uniqueCustomers = useMemo(() => {
    const customers = new Set(salesRows.map(r => r.customerName));
    return Array.from(customers).sort();
  }, [salesRows]);

  const uniqueSellers = useMemo(() => {
    const sellers = new Set(salesRows.map(r => r.sellerName));
    return Array.from(sellers).sort();
  }, [salesRows]);

  const uniqueProducts = useMemo(() => {
    const products = new Set(salesRows.map(r => r.productName));
    return Array.from(products).sort();
  }, [salesRows]);

  // Statistics
  const totalSales = filteredRows.reduce((sum, r) => sum + r.total, 0);
  const totalQuantity = filteredRows.reduce((sum, r) => sum + r.quantity, 0);
  const uniqueOrders = new Set(filteredRows.map(r => r.orderId)).size;

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Format payment method
  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      'cash': 'Наличные',
      'bank': 'Перечисление',
      'card': 'Карта',
      'debt': 'Долг'
    };
    return methods[method] || method;
  };

  const formatCurrency = (row: SalesRow) => {
    if (row.paymentMethod === 'debt') return 'USD';
    return row.paymentCurrency || 'USD';
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['ID заказа', 'Дата', 'Клиент', 'Продавец', 'Размер', 'Товар', 'Количество', 'Ед.', 'Цена', 'Сумма', 'Валюта', 'Метод оплаты', 'Статус оплаты'];
    const csvRows = [
      headers.join(','),
      ...filteredRows.map(row => [
        row.orderId,
        formatDate(row.date),
        `"${row.customerName}"`,
        `"${row.sellerName}"`,
        `"${row.dimensions}"`,
        `"${row.productName}"`,
        safeNumber(row.quantity),
        row.unit,
        safeNumber(row.priceAtSale).toFixed(2),
        safeNumber(row.total).toFixed(2),
        formatCurrency(row),
        formatPaymentMethod(row.paymentMethod),
        row.paymentStatus === 'paid' ? 'Оплачено' : row.paymentStatus === 'unpaid' ? 'Не оплачено' : 'Частично'
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_statistics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const toggleExpand = (orderId: string) => {
    const next = new Set(expandedOrders);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setExpandedOrders(next);
  };

  const getOrderTransactions = (orderId: string) => {
    return transactions.filter(t =>
      t.type === 'client_payment' &&
      (t.description || '').includes(orderId)
    );
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in h-full overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${t.text} flex items-center gap-2`}>
            <Table className="text-blue-500" />
            Детальная статистика продаж
          </h2>
          <p className={`${t.textMuted} text-sm mt-1`}>Полная таблица всех продаж для сверок</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20"
        >
          <Download size={18} />
          Экспорт в CSV
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${t.bgCard} rounded-xl p-4 border ${t.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${t.textMuted} uppercase mb-1`}>Всего продаж</p>
              <p className={`text-2xl font-bold ${t.text}`}>{filteredRows.length}</p>
            </div>
            <ShoppingCart className="text-blue-500" size={32} />
          </div>
        </div>
        <div className={`${t.bgCard} rounded-xl p-4 border ${t.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${t.textMuted} uppercase mb-1`}>Сумма продаж</p>
              <p className="text-2xl font-bold text-emerald-500">${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <Package className="text-emerald-500" size={32} />
          </div>
        </div>
        <div className={`${t.bgCard} rounded-xl p-4 border ${t.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${t.textMuted} uppercase mb-1`}>Уникальных заказов</p>
              <p className="text-2xl font-bold text-purple-500">{uniqueOrders}</p>
            </div>
            <Calendar className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${t.bgCard} rounded-xl p-4 border ${t.border} space-y-4`}>
        <div className={`flex items-center gap-2 ${t.textMuted}`}>
          <Filter size={18} />
          <span className="font-medium">Фильтры</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 ${t.input} border ${t.border} rounded-lg ${t.text} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Customer Filter */}
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className={`${t.input} border ${t.border} rounded-lg ${t.text} text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">Все клиенты</option>
            {uniqueCustomers.map(customer => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>

          {/* Seller Filter */}
          <select
            value={filterSeller}
            onChange={(e) => setFilterSeller(e.target.value)}
            className={`${t.input} border ${t.border} rounded-lg ${t.text} text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">Все продавцы</option>
            {uniqueSellers.map(seller => (
              <option key={seller} value={seller}>{seller}</option>
            ))}
          </select>

          {/* Product Filter */}
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className={`${t.input} border ${t.border} rounded-lg ${t.text} text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">Все товары</option>
            {uniqueProducts.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
            className={`${t.input} border ${t.border} rounded-lg ${t.text} text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">Все методы оплаты</option>
            <option value="cash">Наличные</option>
            <option value="bank">Перечисление</option>
            <option value="card">Карта</option>
            <option value="debt">Долг</option>
          </select>

          {/* Date From */}
          <div className="relative">
            <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 ${t.input} border ${t.border} rounded-lg ${t.text} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="От"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 ${t.input} border ${t.border} rounded-lg ${t.text} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="До"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              <tr>
                <th
                  className={`px-4 py-3 text-left text-xs font-medium ${t.textMuted} uppercase cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'} transition-colors`}
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    Дата
                    {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th
                  className={`px-4 py-3 text-left text-xs font-medium ${t.textMuted} uppercase cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'} transition-colors`}
                  onClick={() => handleSort('customer')}
                >
                  <div className="flex items-center gap-2">
                    Клиент
                    {sortBy === 'customer' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th
                  className={`px-4 py-3 text-left text-xs font-medium ${t.textMuted} uppercase cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'} transition-colors`}
                  onClick={() => handleSort('seller')}
                >
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    Продавец
                    {sortBy === 'seller' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className={`px-4 py-3 text-center text-xs font-medium ${t.textMuted} uppercase`}>
                  Размер
                </th>
                <th
                  className={`px-4 py-3 text-left text-xs font-medium ${t.textMuted} uppercase cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'} transition-colors`}
                  onClick={() => handleSort('product')}
                >
                  <div className="flex items-center gap-2">
                    Товар
                    {sortBy === 'product' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textMuted} uppercase`}>Кол-во</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textMuted} uppercase`}>Цена</th>
                <th
                  className={`px-4 py-3 text-right text-xs font-medium ${t.textMuted} uppercase cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'} transition-colors`}
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Сумма
                    {sortBy === 'total' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className={`px-4 py-3 text-center text-xs font-medium ${t.textMuted} uppercase`}>Валюта</th>
                <th className={`px-4 py-3 text-center text-xs font-medium ${t.textMuted} uppercase`}>Оплата</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textMuted} uppercase`}>ID заказа</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divide}`}>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`px-4 py-12 text-center ${t.textMuted}`}>
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Нет данных для отображения</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const isMixed = row.paymentMethod === 'mixed';
                  const isExpanded = expandedOrders.has(row.orderId);
                  const orderTrx = isMixed && isExpanded ? getOrderTransactions(row.orderId) : [];

                  return (
                    <React.Fragment key={`${row.orderId}-${index}`}>
                      <tr className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                        <td className={`px-4 py-3 text-sm ${t.textMuted} font-mono`}>
                          {formatDate(row.date)}
                        </td>
                        <td className={`px-4 py-3 text-sm ${t.text} font-medium`}>
                          {row.customerName}
                        </td>
                        <td className={`px-4 py-3 text-sm ${t.textMuted}`}>
                          {row.sellerName}
                        </td>
                        <td className={`px-4 py-3 text-sm text-center ${t.textMuted} font-mono`}>
                          {row.dimensions}
                        </td>
                        <td className={`px-4 py-3 text-sm ${t.text}`}>
                          {row.productName}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${t.textMuted} font-mono`}>
                          {safeNumber(row.quantity)} <span className={`text-xs ${t.textMuted}`}>{row.unit}</span>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${t.textMuted} font-mono`}>
                          ${safeNumber(row.priceAtSale).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-bold text-emerald-500">
                          <div>${safeNumber(row.total).toFixed(2)}</div>
                          {row.paymentCurrency === 'UZS' && (
                            <div className={`text-[10px] ${t.textMuted} font-normal`}>
                              {safeNumber(row.totalAmountUZS).toLocaleString()} сум
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${formatCurrency(row) === 'USD'
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                            : 'border-blue-500/30 text-blue-500 bg-blue-500/5'
                            }`}>
                            {formatCurrency(row)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            disabled={!isMixed}
                            onClick={() => isMixed && toggleExpand(row.orderId)}
                            className={`flex items-center gap-1 mx-auto px-2 py-1 rounded-full text-xs font-medium border transition-all ${row.paymentMethod === 'debt'
                              ? 'bg-red-500/20 text-red-500 border-red-500/30'
                              : row.paymentMethod === 'mixed'
                                ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 hover:bg-amber-500/30 cursor-pointer'
                                : row.paymentMethod === 'cash'
                                  ? 'bg-green-500/20 text-green-500 border-green-500/30'
                                  : 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                              }`}
                          >
                            {formatPaymentMethod(row.paymentMethod)}
                            {isMixed && (
                              isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                            )}
                          </button>
                        </td>
                        <td className={`px-4 py-3 text-xs ${t.textMuted} font-mono`}>
                          {row.orderId}
                        </td>
                      </tr>
                      {/* Mixed details row */}
                      {isExpanded && isMixed && (
                        <tr className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <td colSpan={11} className="px-4 py-3">
                            <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} rounded-lg p-3 border ${t.border} ml-10 max-w-2xl`}>
                              <div className={`text-xs font-bold ${t.textMuted} mb-2 uppercase`}>Детализация оплаты (ID: {row.orderId})</div>
                              {orderTrx.length === 0 ? (
                                <div className="text-xs text-red-500">Транзакции оплаты не найдены</div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {orderTrx.map(trx => (
                                    <div key={trx.id} className={`${t.bgCard} p-2 rounded-lg border ${t.border}`}>
                                      <div className={`text-[10px] ${t.textMuted} uppercase`}>{formatPaymentMethod(trx.method)}</div>
                                      <div className={`text-sm font-mono font-bold ${trx.method === 'cash' && trx.currency === 'USD' ? 'text-emerald-500' : 'text-blue-500'}`}>
                                        {trx.currency === 'UZS' ? `${trx.amount.toLocaleString()} UZS` : `$${trx.amount.toFixed(2)}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} border-t-2 ${t.border}`}>
                <tr>
                  <td colSpan={7} className={`px-4 py-3 text-right text-sm font-medium ${t.textMuted}`}>
                    Итого:
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-lg text-emerald-500">
                    ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagination Info */}
      {filteredRows.length > 0 && (
        <div className={`text-center text-sm ${t.textMuted}`}>
          Показано {filteredRows.length} из {salesRows.length} записей
        </div>
      )}
    </div>
  );
};

