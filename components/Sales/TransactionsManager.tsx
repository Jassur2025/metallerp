import React, { useState, useMemo } from 'react';
import { Transaction } from '../../types';
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
  exchangeRate: number;
}

export const TransactionsManager: React.FC<TransactionsManagerProps> = ({
  transactions,
  onUpdateTransactions,
  onSaveTransactions,
  exchangeRate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Transaction>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            t.description?.toLowerCase().includes(search) ||
            t.type.toLowerCase().includes(search) ||
            t.method?.toLowerCase().includes(search)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, searchTerm]);

  const handleDelete = async (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    onUpdateTransactions(updated);
    if (onSaveTransactions) {
      await onSaveTransactions(updated);
    }
    setDeleteConfirmId(null);
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditData({ ...t });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData) return;
    
    const updated = transactions.map(t => 
      t.id === editingId ? { ...t, ...editData } as Transaction : t
    );
    onUpdateTransactions(updated);
    if (onSaveTransactions) {
      await onSaveTransactions(updated);
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
      case 'client_payment': return 'bg-emerald-500/20 text-emerald-400';
      case 'supplier_payment': return 'bg-red-500/20 text-red-400';
      case 'client_return': return 'bg-orange-500/20 text-orange-400';
      case 'client_refund': return 'bg-blue-500/20 text-blue-400';
      case 'debt_obligation': return 'bg-purple-500/20 text-purple-400';
      case 'expense': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
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

  const formatAmount = (t: Transaction) => {
    if (t.currency === 'USD') {
      return `$${t.amount.toLocaleString()}`;
    }
    return `${t.amount.toLocaleString()} сум`;
  };

  const isIncome = (type: string) => {
    return type === 'client_payment' || type === 'client_refund';
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-900/50">
        <h3 className="text-lg font-bold text-white mb-3">Управление транзакциями</h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          
          {/* Filter */}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
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
      <div className="p-3 border-b border-slate-700 bg-slate-800/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xs text-slate-400">Всего</p>
          <p className="text-lg font-bold text-white">{transactions.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400">Приход (USD)</p>
          <p className="text-lg font-bold text-emerald-400">
            ${transactions
              .filter(t => isIncome(t.type) && t.currency === 'USD')
              .reduce((sum, t) => sum + t.amount, 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400">Расход (USD)</p>
          <p className="text-lg font-bold text-red-400">
            ${transactions
              .filter(t => !isIncome(t.type) && t.currency === 'USD')
              .reduce((sum, t) => sum + t.amount, 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400">Найдено</p>
          <p className="text-lg font-bold text-blue-400">{filteredTransactions.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-400 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left">Дата</th>
              <th className="px-4 py-3 text-left">Тип</th>
              <th className="px-4 py-3 text-left">Метод</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3 text-left">Описание</th>
              <th className="px-4 py-3 text-center">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Транзакции не найдены
                </td>
              </tr>
            ) : (
              filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                  {editingId === t.id ? (
                    // Edit Mode
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={editData.date?.split('T')[0] || ''}
                          onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editData.type || ''}
                          onChange={(e) => setEditData({ ...editData, type: e.target.value as Transaction['type'] })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
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
                          onChange={(e) => setEditData({ ...editData, method: e.target.value as Transaction['method'] })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
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
                            className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                          />
                          <select
                            value={editData.currency || 'USD'}
                            onChange={(e) => setEditData({ ...editData, currency: e.target.value as 'USD' | 'UZS' })}
                            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
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
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1.5 bg-slate-500/20 text-slate-400 rounded hover:bg-slate-500/30 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTypeColor(t.type)}`}>
                          {getTypeLabel(t.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-slate-400">
                          {getMethodIcon(t.method)}
                          <span className="text-xs capitalize">{t.method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`flex items-center justify-end gap-1 font-mono ${isIncome(t.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isIncome(t.type) ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {formatAmount(t)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate" title={t.description}>
                        {t.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {deleteConfirmId === t.id ? (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleDelete(t.id)}
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
                              onClick={() => handleEdit(t)}
                              className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                              title="Редактировать"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(t.id)}
                              className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
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
      <div className="p-3 border-t border-slate-700 bg-amber-500/10">
        <div className="flex items-start gap-2 text-xs text-amber-400">
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
