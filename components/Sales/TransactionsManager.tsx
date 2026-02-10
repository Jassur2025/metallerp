import React, { useState, useMemo } from 'react';
import { Transaction, Expense } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Search, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CreditCard,
  Building2,
  Wallet,
  AlertTriangle
} from 'lucide-react';

interface TransactionsManagerProps {
  transactions: Transaction[];
  onUpdateTransactions: (transactions: Transaction[]) => void;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  expenses?: Expense[];
  onUpdateExpenses?: (expenses: Expense[]) => void;
  onSaveExpenses?: (expenses: Expense[]) => Promise<boolean | void>;
  exchangeRate: number;
}

interface DisplayItem {
  id: string;
  date: string;
  type: Transaction['type'] | 'expense';
  method: Transaction['method'];
  amount: number;
  currency: 'USD' | 'UZS';
  exchangeRate?: number;
  description: string;
  relatedId?: string;
  category?: string;
  _source: 'transaction' | 'expense';
  _version?: number;
  updatedAt?: string;
  paymentMethod?: string;
}

export const TransactionsManager: React.FC<TransactionsManagerProps> = ({
  transactions,
  onUpdateTransactions,
  onSaveTransactions,
  expenses = [],
  onUpdateExpenses,
  onSaveExpenses,
  exchangeRate
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<DisplayItem>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const allItems: DisplayItem[] = useMemo(() => {
    const transItems: DisplayItem[] = transactions.map(tx => ({
      id: tx.id, date: tx.date, type: tx.type, method: tx.method,
      amount: tx.amount, currency: tx.currency, exchangeRate: tx.exchangeRate,
      description: tx.description, relatedId: tx.relatedId,
      _source: 'transaction' as const, _version: tx._version, updatedAt: tx.updatedAt
    }));
    const expItems: DisplayItem[] = expenses.map(e => ({
      id: e.id, date: e.date, type: 'expense' as const, method: e.paymentMethod,
      amount: e.amount, currency: e.currency, exchangeRate: e.exchangeRate,
      description: e.description, category: e.category,
      _source: 'expense' as const, _version: e._version, updatedAt: e.updatedAt
    }));
    return [...transItems, ...expItems];
  }, [transactions, expenses]);

  const filteredTransactions = useMemo(() => {
    return allItems
      .filter(item => {
        // Filter by type
        if (filterType !== 'all') {
          if (item._source === 'expense') {
             if (filterType !== 'expense') return false;
          } else {
             if (item.type !== filterType) return false;
          }
        }
        
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const typeLabel = item._source === 'expense' ? 'расход' : item.type;
          return (
            item.description?.toLowerCase().includes(search) ||
            typeLabel.toLowerCase().includes(search) ||
            item.method?.toLowerCase().includes(search)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allItems, filterType, searchTerm]);

  const handleDelete = async (id: string, source: 'transaction' | 'expense') => {
    if (source === 'transaction') {
      const updated = transactions.filter(t => t.id !== id);
      onUpdateTransactions(updated);
      if (onSaveTransactions) await onSaveTransactions(updated);
    } else {
      const updated = expenses.filter(e => e.id !== id);
      if (onUpdateExpenses) onUpdateExpenses(updated);
      if (onSaveExpenses) await onSaveExpenses(updated);
    }
    setDeleteConfirmId(null);
  };

  const handleEdit = (item: DisplayItem) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData) return;
    
    if (editData._source === 'transaction') {
      const updated = transactions.map(t => 
        t.id === editingId ? { ...t, ...editData } as Transaction : t
      );
      onUpdateTransactions(updated);
      if (onSaveTransactions) await onSaveTransactions(updated);
    } else {
      // For expense, we need to map back 'method' to 'paymentMethod' if changed
      const updated = expenses.map(e => {
        if (e.id === editingId) {
          const updates: Partial<Expense> = {};
          if (editData.method) updates.paymentMethod = editData.method as Expense['paymentMethod'];
          if (editData.amount !== undefined) updates.amount = editData.amount;
          if (editData.currency) updates.currency = editData.currency;
          if (editData.description) updates.description = editData.description;
          if (editData.date) updates.date = editData.date;
          return { ...e, ...updates };
        }
        return e;
      });
      if (onUpdateExpenses) onUpdateExpenses(updated);
      if (onSaveExpenses) await onSaveExpenses(updated);
    }

    setEditingId(null);
    setEditData({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'client_payment': return 'Оплата клиента';
      case 'supplier_payment': return 'Оплата поставщику';
      case 'client_return': return 'Возврат клиенту';
      case 'client_refund': return 'Возврат от клиента';
      case 'debt_obligation': return 'Долг';
      case 'expense': return 'Расход';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'client_payment': return 'bg-emerald-500/20 text-emerald-500';
      case 'supplier_payment': return 'bg-red-500/20 text-red-500';
      case 'client_return': return 'bg-orange-500/20 text-orange-500';
      case 'client_refund': return 'bg-blue-500/20 text-blue-500';
      case 'debt_obligation': return 'bg-purple-500/20 text-purple-500';
      case 'expense': return 'bg-red-500/20 text-red-500';
      default: return `bg-slate-500/20 ${t.textMuted}`;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Wallet size={14} />;
      case 'bank': return <Building2 size={14} />;
      case 'card': return <CreditCard size={14} />;
      default: return <DollarSign size={14} />;
    }
  };

  const formatAmount = (item: DisplayItem) => {
    if (item.currency === 'USD') {
      return `$${item.amount.toLocaleString()}`;
    }
    return `${item.amount.toLocaleString()} сум`;
  };

  const isIncome = (type: string) => {
    return type === 'client_payment' || type === 'client_refund';
  };

  return (
    <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden`}>
      {/* Header */}
      <div className={`p-4 border-b ${t.border} ${t.bgPanel}`}>
        <h3 className={`text-lg font-bold ${t.text} mb-3`}>Управление транзакциями</h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 ${t.bgCard} border ${t.border} rounded-lg ${t.text} text-sm focus:ring-2 focus:ring-primary-500 outline-none`}
            />
          </div>
          
          {/* Filter */}
          <div className="relative">
            <Filter size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`pl-9 pr-8 py-2 ${t.bgCard} border ${t.border} rounded-lg ${t.text} text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer`}
            >
              <option value="all">Все типы</option>
              <option value="client_payment">Оплаты клиентов</option>
              <option value="supplier_payment">Оплаты поставщикам</option>
              <option value="client_return">Возвраты</option>
              <option value="expense">Расходы</option>
              <option value="debt_obligation">Долги</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={`p-3 border-b ${t.border} ${t.bgPanelAlt} grid grid-cols-2 sm:grid-cols-4 gap-3`}>
        <div className="text-center">
          <p className={`text-xs ${t.textMuted}`}>Всего</p>
          <p className={`text-lg font-bold ${t.text}`}>{allItems.length}</p>
        </div>
        <div className="text-center">
          <p className={`text-xs ${t.textMuted}`}>Приход (USD)</p>
          <p className="text-lg font-bold text-emerald-500">
            ${allItems
              .filter(tx => isIncome(tx.type) && tx.currency === 'USD')
              .reduce((sum, tx) => sum + tx.amount, 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className={`text-xs ${t.textMuted}`}>Расход (USD)</p>
          <p className="text-lg font-bold text-red-500">
            ${allItems
              .filter(tx => !isIncome(tx.type) && tx.currency === 'USD')
              .reduce((sum, tx) => sum + tx.amount, 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className={`text-xs ${t.textMuted}`}>Найдено</p>
          <p className="text-lg font-bold text-blue-500">{filteredTransactions.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className={`${t.bgPanel} text-xs uppercase ${t.textMuted} sticky top-0`}>
            <tr>
              <th className="px-4 py-3 text-left">Дата</th>
              <th className="px-4 py-3 text-left">Тип</th>
              <th className="px-4 py-3 text-left">Метод</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3 text-left">Описание</th>
              <th className="px-4 py-3 text-center">Действия</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.divide}`}>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className={`px-4 py-8 text-center ${t.textMuted}`}>
                  Транзакции не найдены
                </td>
              </tr>
            ) : (
              filteredTransactions.map(tx => (
                <tr key={tx.id} className={`${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700/30'} transition-colors`}>
                  {editingId === tx.id ? (
                    // Edit Mode
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={editData.date?.split('T')[0] || ''}
                          onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                          className={`w-full px-2 py-1 ${t.bgCard} border ${t.border} rounded ${t.text} text-xs`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editData.type || ''}
                          disabled={editData._source === 'expense'}
                          onChange={(e) => setEditData({ ...editData, type: e.target.value as DisplayItem['type'] })}
                          className={`w-full px-2 py-1 ${t.bgCard} border ${t.border} rounded ${t.text} text-xs ${editData._source === 'expense' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="client_payment">Оплата клиента</option>
                          <option value="supplier_payment">Оплата поставщику</option>
                          <option value="client_return">Возврат клиенту</option>
                          <option value="expense">Расход</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editData.method || ''}
                          onChange={(e) => setEditData({ ...editData, method: e.target.value as DisplayItem['method'] })}
                          className={`w-full px-2 py-1 ${t.bgCard} border ${t.border} rounded ${t.text} text-xs`}
                        >
                          <option value="cash">Наличные</option>
                          <option value="bank">Банк</option>
                          <option value="card">Карта</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={editData.amount || 0}
                            onChange={(e) => setEditData({ ...editData, amount: Number(e.target.value) })}
                            className={`w-20 px-2 py-1 ${t.bgCard} border ${t.border} rounded ${t.text} text-xs`}
                          />
                          <select
                            value={editData.currency || 'USD'}
                            onChange={(e) => setEditData({ ...editData, currency: e.target.value as 'USD' | 'UZS' })}
                            className={`px-2 py-1 ${t.bgCard} border ${t.border} rounded ${t.text} text-xs`}
                          >
                            <option value="USD">USD</option>
                            <option value="UZS">UZS</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editData.description || ''}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          className={`w-full px-2 py-1 ${t.bgCard} border ${t.border} rounded ${t.text} text-xs`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded hover:bg-emerald-500/30 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className={`p-1.5 bg-slate-500/20 ${t.textMuted} rounded hover:bg-slate-500/30 transition-colors`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <td className={`px-4 py-3 ${t.textSecondary} text-xs`}>
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTypeColor(tx.type)}`}>
                          {getTypeLabel(tx.type)}
                        </span>
                        {tx._source === 'expense' && tx.category && (
                          <div className="text-[10px] opacity-75 mt-1">{tx.category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 ${t.textMuted}`}>
                          {getMethodIcon(tx.method)}
                          <span className="text-xs capitalize">{tx.method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`flex items-center justify-end gap-1 font-mono ${isIncome(tx.type) ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isIncome(tx.type) ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {formatAmount(tx)}
                        </div>
                      </td>
                      <td className={`px-4 py-3 ${t.textMuted} text-xs max-w-[200px] truncate`} title={tx.description}>
                        {tx.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {deleteConfirmId === tx.id ? (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleDelete(tx.id, tx._source)}
                              className="p-1.5 bg-red-500 text-white rounded hover:bg-red-400 transition-colors text-xs"
                            >
                              Да
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 bg-slate-600 text-white rounded hover:bg-slate-500 transition-colors text-xs"
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleEdit(tx)}
                              className="p-1.5 bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30 transition-colors"
                              title="Редактировать"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(tx.id)}
                              className="p-1.5 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Warning */}
      <div className="p-3 border-t border-amber-500/20 bg-amber-500/10">
        <div className={`flex items-start gap-2 text-xs ${theme === 'light' ? 'text-slate-600' : 'text-amber-500'}`}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <p>
            <strong>Внимание:</strong> Удаление или изменение транзакций повлияет на баланс кассы. 
            Будьте осторожны при редактировании.
          </p>
        </div>
      </div>
    </div>
  );
};
