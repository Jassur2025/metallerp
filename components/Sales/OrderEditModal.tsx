import React, { useState, useMemo } from 'react';
import { X, Save, DollarSign, Wallet, CreditCard, Building2, AlertCircle, Zap, Calendar, Edit3, Package, User, UserCheck, Hash } from 'lucide-react';
import { Order } from '../../types';
import { PaymentMethod } from './types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface OrderEditModalProps {
  editingOrderId: string;
  editOrderData: {
    totalAmount: string;
    amountPaid: string;
    paymentMethod: string;
    paymentCurrency: string;
  };
  setEditOrderData: React.Dispatch<React.SetStateAction<{
    totalAmount: string;
    amountPaid: string;
    paymentMethod: string;
    paymentCurrency: string;
  }>>;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  onSaveOrders?: (orders: Order[]) => Promise<boolean | void>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = React.memo(({
  editingOrderId, editOrderData, setEditOrderData, orders, setOrders,
  onSaveOrders, onClose, onSuccess
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';

  const order = useMemo(() => orders.find(o => o.id === editingOrderId), [orders, editingOrderId]);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState(order?.customerName || '');
  const [sellerName, setSellerName] = useState(order?.sellerName || '');
  const [dueDate, setDueDate] = useState(order?.paymentDueDate || '');

  // Derived payment status
  const totalAmount = parseFloat(editOrderData.totalAmount) || 0;
  const amountPaid = parseFloat(editOrderData.amountPaid) || 0;
  const derivedStatus: 'paid' | 'unpaid' | 'partial' =
    amountPaid >= totalAmount - 0.01 ? 'paid' :
    amountPaid > 0.01 ? 'partial' : 'unpaid';

  const remainingUSD = Math.max(0, totalAmount - amountPaid);
  const totalAmountUZS = order ? Math.round(totalAmount * order.exchangeRate) : 0;

  const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'cash', label: 'Наличные', icon: <Wallet size={14} />, color: isDark ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-600' },
    { value: 'card', label: 'Карта', icon: <CreditCard size={14} />, color: isDark ? 'bg-purple-500/15 border-purple-500/40 text-purple-400' : 'bg-purple-50 border-purple-300 text-purple-600' },
    { value: 'bank', label: 'Р/С', icon: <Building2 size={14} />, color: isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-600' },
    { value: 'debt', label: 'Долг', icon: <AlertCircle size={14} />, color: isDark ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-red-50 border-red-300 text-red-600' },
    { value: 'mixed', label: 'Смешанная', icon: <Zap size={14} />, color: isDark ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-300 text-blue-600' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = orders.map(o =>
        o.id === editingOrderId
          ? {
              ...o,
              customerName: customerName.trim() || o.customerName,
              sellerName: sellerName.trim() || o.sellerName,
              totalAmount,
              totalAmountUZS: Math.round(totalAmount * o.exchangeRate),
              amountPaid,
              paymentMethod: editOrderData.paymentMethod as PaymentMethod,
              paymentCurrency: editOrderData.paymentCurrency as 'USD' | 'UZS',
              paymentStatus: derivedStatus,
              paymentDueDate: derivedStatus !== 'paid' && dueDate ? dueDate : o.paymentDueDate,
            }
          : o
      );
      await onSaveOrders?.(updated);
      setOrders(updated);
      onSuccess('Заказ обновлён');
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`px-5 py-4 ${isDark ? 'bg-slate-800/80 border-b border-slate-700/60' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-200'} flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-100'}`}>
              <Edit3 size={20} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${t.text} leading-tight`}>Редактирование</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash size={11} className={t.textMuted} />
                <span className={`text-xs font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {order.reportNo || order.id.slice(-6)}
                </span>
                <span className={`text-[10px] ${t.textMuted}`}>
                  {new Date(order.date).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto custom-scrollbar p-5 space-y-4">
          {/* Items preview (read-only) */}
          <div>
            <div className={`flex items-center gap-1.5 mb-2`}>
              <Package size={13} className={t.textMuted} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Товары ({order.items.length})</span>
            </div>
            <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'} border rounded-xl overflow-hidden`}>
              {order.items.slice(0, 5).map((item, idx) => (
                <div key={idx} className={`px-3 py-2 flex justify-between items-center ${idx > 0 ? (isDark ? 'border-t border-slate-700/40' : 'border-t border-slate-200') : ''}`}>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${t.text} truncate block`}>{item.productName}</span>
                    <span className={`text-[10px] ${t.textMuted} font-mono`}>{item.quantity} {item.unit} × ${item.priceAtSale.toFixed(2)}</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>${item.total.toFixed(2)}</span>
                </div>
              ))}
              {order.items.length > 5 && (
                <div className={`px-3 py-1.5 text-[10px] ${t.textMuted} text-center`}>
                  +{order.items.length - 5} ещё
                </div>
              )}
            </div>
          </div>

          {/* Client & Seller */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><User size={10} /> Клиент</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : `${t.bgInput} border-slate-200 text-slate-900`} border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ${isDark ? 'focus:ring-blue-500/30' : 'focus:ring-blue-400/30'}`}
              />
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><UserCheck size={10} /> Продавец</label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : `${t.bgInput} border-slate-200 text-slate-900`} border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ${isDark ? 'focus:ring-blue-500/30' : 'focus:ring-blue-400/30'}`}
              />
            </div>
          </div>

          {/* Financial fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><DollarSign size={10} /> Общая сумма (USD)</label>
              <input
                type="number"
                value={editOrderData.totalAmount}
                onChange={(e) => setEditOrderData(prev => ({ ...prev, totalAmount: e.target.value }))}
                className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : `${t.bgInput} border-slate-200 text-slate-900`} border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 ${isDark ? 'focus:ring-emerald-500/30' : 'focus:ring-emerald-400/30'}`}
              />
              <span className={`text-[10px] ${t.textMuted} font-mono`}>≈ {totalAmountUZS.toLocaleString()} сўм</span>
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><Wallet size={10} /> Оплачено (USD)</label>
              <input
                type="number"
                value={editOrderData.amountPaid}
                onChange={(e) => setEditOrderData(prev => ({ ...prev, amountPaid: e.target.value }))}
                className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : `${t.bgInput} border-slate-200 text-slate-900`} border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 ${isDark ? 'focus:ring-emerald-500/30' : 'focus:ring-emerald-400/30'}`}
              />
            </div>
          </div>

          {/* Auto-derived status indicator */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
            derivedStatus === 'paid'
              ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
              : derivedStatus === 'partial'
                ? (isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600')
                : (isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600')
          }`}>
            <span className="text-xs font-bold">
              Статус: {derivedStatus === 'paid' ? 'Оплачено' : derivedStatus === 'partial' ? 'Частично' : 'Не оплачено'}
            </span>
            {remainingUSD > 0.01 && (
              <span className="text-xs font-mono font-bold">Остаток: ${remainingUSD.toFixed(2)}</span>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Метод оплаты</label>
            <div className="flex gap-1.5 flex-wrap">
              {paymentMethods.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => setEditOrderData(prev => ({ ...prev, paymentMethod: pm.value }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    editOrderData.paymentMethod === pm.value
                      ? pm.color
                      : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600' : 'bg-slate-100 border-slate-200 text-slate-400 hover:border-slate-300')
                  }`}
                >
                  {pm.icon} {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Currency */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Валюта оплаты</label>
            <div className="flex gap-1.5">
              {['USD', 'UZS'].map(cur => (
                <button
                  key={cur}
                  onClick={() => setEditOrderData(prev => ({ ...prev, paymentCurrency: cur }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    editOrderData.paymentCurrency === cur
                      ? (isDark ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-300 text-blue-600')
                      : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400')
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>

          {/* Due date for debt */}
          {derivedStatus !== 'paid' && (
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><Calendar size={10} /> Срок оплаты</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : `${t.bgInput} border-slate-200 text-slate-900`} border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ${isDark ? 'focus:ring-red-500/30' : 'focus:ring-red-400/30'}`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 ${isDark ? 'bg-slate-800/60 border-t border-slate-700/60' : 'bg-slate-50 border-t border-slate-200'} flex gap-3`}>
          <button
            onClick={onClose}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 disabled:bg-slate-700 disabled:text-slate-500'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 disabled:bg-slate-300 disabled:text-slate-500'
            } disabled:cursor-not-allowed`}
          >
            <Save size={16} />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
});

OrderEditModal.displayName = 'OrderEditModal';
