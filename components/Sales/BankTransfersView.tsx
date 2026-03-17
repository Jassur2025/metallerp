import React, { useState, useMemo } from 'react';
import { Transaction, Order, Client } from '../../types';
import { IdGenerator } from '../../utils/idGenerator';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { Building2, Plus, ArrowRight, Search, Check, X, Calendar, DollarSign, Banknote } from 'lucide-react';

interface BankTransfersViewProps {
  transactions: Transaction[];
  orders: Order[];
  clients: Client[];
  exchangeRate: number;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

export const BankTransfersView: React.FC<BankTransfersViewProps> = React.memo(({
  transactions, orders, clients, exchangeRate,
  onSaveTransactions, onToast
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [allocateId, setAllocateId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // New transfer form state
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Bank transfer incoming payments (client_payment with method='bank')
  const bankTransfers = useMemo(() => {
    return transactions
      .filter(tx => tx.method === 'bank' && tx.type === 'client_payment')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // Filter
  const filteredTransfers = useMemo(() => {
    if (!searchTerm) return bankTransfers;
    const q = searchTerm.toLowerCase();
    return bankTransfers.filter(tx =>
      tx.description?.toLowerCase().includes(q) ||
      tx.relatedId?.toLowerCase().includes(q) ||
      tx.clientId?.toLowerCase().includes(q) ||
      tx.orderId?.toLowerCase().includes(q)
    );
  }, [bankTransfers, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    const totalUZS = bankTransfers.reduce((sum, tx) => {
      if (tx.currency === 'UZS') return sum + tx.amount;
      return sum + tx.amount * (tx.exchangeRate || exchangeRate);
    }, 0);
    const totalUSD = bankTransfers.reduce((sum, tx) => {
      if (tx.currency === 'USD') return sum + tx.amount;
      return sum + tx.amount / (tx.exchangeRate || exchangeRate);
    }, 0);
    const allocated = bankTransfers.filter(tx => tx.orderId).length;
    const unallocated = bankTransfers.filter(tx => !tx.orderId).length;
    return { totalUZS, totalUSD, allocated, unallocated, total: bankTransfers.length };
  }, [bankTransfers, exchangeRate]);

  // Unpaid/partial orders for allocation
  const allocatableOrders = useMemo(() => {
    return orders.filter(o =>
      o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial' || o.paymentMethod === 'debt'
    );
  }, [orders]);

  const handleAddTransfer = async () => {
    const amount = parseFloat(newAmount);
    if (!amount || amount <= 0) { onToast('error', 'Укажите сумму'); return; }
    if (!newDescription.trim() && !newClientName.trim()) { onToast('error', 'Укажите описание или клиента'); return; }

    const client = clients.find(c => c.name.toLowerCase() === newClientName.trim().toLowerCase());

    const tx: Transaction = {
      id: IdGenerator.transaction(),
      date: new Date(newDate).toISOString(),
      type: 'client_payment',
      amount,
      currency: 'UZS',
      exchangeRate,
      method: 'bank',
      description: newDescription.trim() || `Перечисление от ${newClientName.trim()}`,
      clientId: client?.id,
      relatedId: client?.id,
    };

    const updated = [tx, ...transactions];
    await onSaveTransactions?.([tx]);
    onToast('success', 'Перечисление добавлено');

    // Reset
    setNewAmount('');
    setNewDescription('');
    setNewClientName('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(false);
  };

  const handleAllocate = async (txId: string) => {
    if (!selectedOrderId) { onToast('error', 'Выберите заказ'); return; }

    const updated = transactions.find(tx => tx.id === txId);
    if (updated) {
      await onSaveTransactions?.([{ ...updated, orderId: selectedOrderId }]);
    }

    onToast('success', 'Перечисление привязано к заказу');
    setAllocateId(null);
    setSelectedOrderId('');
  };

  return (
    <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${t.text} font-bold flex items-center gap-2`}>
          <Building2 className="text-amber-400" size={20} />
          Тушган пуллар — Перечисление
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
            showAddForm
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
          }`}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Отмена' : 'Добавить'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className={`p-2.5 rounded-lg border ${theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <div className={`text-[10px] ${t.textMuted} uppercase`}>Всего</div>
          <div className="text-amber-400 font-mono font-bold text-sm">{totals.total}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
          <div className={`text-[10px] ${t.textMuted} uppercase`}>Привязано</div>
          <div className="text-emerald-400 font-mono font-bold text-sm">{totals.allocated}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className={`text-[10px] ${t.textMuted} uppercase`}>Не привязано</div>
          <div className="text-red-400 font-mono font-bold text-sm">{totals.unallocated}</div>
        </div>
        <div className={`p-2.5 rounded-lg border ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/20'}`}>
          <div className={`text-[10px] ${t.textMuted} uppercase`}>Итого (сум)</div>
          <div className="text-blue-400 font-mono font-bold text-sm">{totals.totalUZS.toLocaleString()}</div>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className={`mb-4 p-4 rounded-xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-500/5 border-amber-500/20'}`}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={`text-[10px] ${t.textMuted} uppercase mb-1 block`}>Клиент</label>
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} text-sm outline-none ${t.focusRing}`}
                placeholder="Имя клиента"
                list="bank-clients-list"
              />
              <datalist id="bank-clients-list">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className={`text-[10px] ${t.textMuted} uppercase mb-1 block`}>Сумма (UZS)</label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} text-sm outline-none ${t.focusRing} font-mono`}
                placeholder="0"
              />
            </div>
            <div>
              <label className={`text-[10px] ${t.textMuted} uppercase mb-1 block`}>Дата</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} text-sm outline-none ${t.focusRing}`}
              />
            </div>
            <div>
              <label className={`text-[10px] ${t.textMuted} uppercase mb-1 block`}>Описание</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} text-sm outline-none ${t.focusRing}`}
                placeholder="Комментарий"
              />
            </div>
          </div>
          <button
            onClick={handleAddTransfer}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Добавить перечисление
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={14} />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg pl-8 pr-3 py-1.5 ${t.text} text-xs outline-none ${t.focusRing}`}
          placeholder="Поиск по перечислениям..."
        />
      </div>

      {/* Transactions list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className={`grid grid-cols-[1fr_100px_100px_80px_80px] gap-2 text-[10px] ${t.textMuted} font-bold uppercase border-b ${t.border} pb-1.5`}>
          <span>Описание / Клиент</span>
          <span className="text-right">Сумма (UZS)</span>
          <span className="text-right">≈ USD</span>
          <span>Заказ</span>
          <span>Действие</span>
        </div>

        {filteredTransfers.map(tx => {
          const rate = tx.exchangeRate || exchangeRate;
          const amountUZS = tx.currency === 'UZS' ? tx.amount : tx.amount * rate;
          const amountUSD = tx.currency === 'USD' ? tx.amount : tx.amount / rate;
          const client = tx.clientId ? clients.find(c => c.id === tx.clientId) : null;
          const linkedOrder = tx.orderId ? orders.find(o => o.id === tx.orderId) : null;

          return (
            <div
              key={tx.id}
              className={`grid grid-cols-[1fr_100px_100px_80px_80px] gap-2 py-2 border-b text-xs items-center ${
                tx.orderId
                  ? (theme === 'light' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20')
                  : (theme === 'light' ? 'border-slate-200' : 'border-slate-700/50')
              }`}
            >
              <div>
                <div className={`${t.text} font-medium truncate`}>{tx.description}</div>
                <div className={`text-[10px] ${t.textMuted}`}>
                  {new Date(tx.date).toLocaleDateString('ru-RU')}
                  {client && <span className="ml-1">• {client.name}</span>}
                </div>
              </div>
              <div className={`text-right font-mono font-bold ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`}>
                {amountUZS.toLocaleString()}
              </div>
              <div className={`text-right font-mono ${t.textMuted}`}>
                ${amountUSD.toFixed(2)}
              </div>
              <div>
                {linkedOrder ? (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    <Check size={10} className="inline" /> {linkedOrder.customerName?.slice(0, 8)}
                  </span>
                ) : (
                  <span className={`text-[10px] ${t.textMuted}`}>—</span>
                )}
              </div>
              <div>
                {!tx.orderId ? (
                  allocateId === tx.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedOrderId}
                        onChange={(e) => setSelectedOrderId(e.target.value)}
                        className={`${t.bgInput} border ${t.borderInput} rounded text-[10px] px-1 py-0.5 ${t.text} outline-none w-[50px]`}
                      >
                        <option value="">—</option>
                        {allocatableOrders.map(o => (
                          <option key={o.id} value={o.id}>{o.customerName?.slice(0, 10)} ${o.totalAmount?.toFixed(0)}</option>
                        ))}
                      </select>
                      <button onClick={() => handleAllocate(tx.id)} className="text-emerald-400 hover:text-emerald-300">
                        <Check size={12} />
                      </button>
                      <button onClick={() => { setAllocateId(null); setSelectedOrderId(''); }} className="text-red-400 hover:text-red-300">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAllocateId(tx.id)}
                      className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                        theme === 'light'
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                          : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30'
                      }`}
                    >
                      <ArrowRight size={10} className="inline" /> Привязать
                    </button>
                  )
                ) : (
                  <span className="text-[10px] text-emerald-400">✓</span>
                )}
              </div>
            </div>
          );
        })}

        {filteredTransfers.length === 0 && (
          <div className={`text-center py-6 ${t.textMuted} text-sm`}>
            Нет перечислений
          </div>
        )}
      </div>
    </div>
  );
});

BankTransfersView.displayName = 'BankTransfersView';
