import React, { useState } from 'react';
import { ShoppingCart, Trash2, User, Plus, CheckCircle, FileText, Printer, Percent, Tag, Calendar } from 'lucide-react';
import { OrderItem, Client, Employee, Order, AppSettings } from '../../types';
import { DEFAULT_EXCHANGE_RATE } from '../../constants';
import { PaymentMethod, Currency, FlyingItem } from './types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface CartPanelProps {
  cart: OrderItem[];
  removeFromCart: (id: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  sellerName: string;
  setSellerName: (val: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (val: PaymentMethod) => void;
  paymentCurrency: Currency;
  setPaymentCurrency: (val: Currency) => void;
  clients: Client[];
  employees: Employee[];
  settings: AppSettings;
  subtotalUSD: number;
  vatAmountUSD: number;
  totalAmountUSD: number;
  totalAmountUZS: number;
  toUZS: (usd: number) => number;
  onCompleteOrder: () => void;
  onOpenClientModal: () => void;
  onNavigateToStaff: () => void;
  lastOrder: Order | null;
  onShowReceipt: (order: Order) => void;
  onPrintReceipt: (order: Order) => void;
  onPrintInvoice: (order: Order) => void;
  onPrintWaybill: (order: Order) => void;
  flyingItems: FlyingItem[];
  // Discount Props
  discountPercent?: number;
  onDiscountChange?: (val: number) => void;
  manualTotal?: number | null;
  onTotalChange?: (val: number) => void;
  originalTotalUSD?: number;
  // Debt Due Date
  debtDueDate?: string;
  onDebtDueDateChange?: (val: string) => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  removeFromCart,
  updateQuantity,
  customerName,
  setCustomerName,
  sellerName,
  setSellerName,
  paymentMethod,
  setPaymentMethod,
  paymentCurrency,
  setPaymentCurrency,
  clients,
  employees,
  settings,
  subtotalUSD,
  vatAmountUSD,
  totalAmountUSD,
  totalAmountUZS,
  toUZS,
  onCompleteOrder,
  onOpenClientModal,
  onNavigateToStaff,
  lastOrder,
  onShowReceipt,
  onPrintReceipt,
  onPrintInvoice,
  onPrintWaybill,
  flyingItems,
  discountPercent = 0,
  onDiscountChange,
  manualTotal,
  onTotalChange,
  originalTotalUSD = 0,
  debtDueDate = '',
  onDebtDueDateChange
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [customRoundedValue, setCustomRoundedValue] = useState<string>('');

  // Calculate discount amount
  const discountAmountUSD = originalTotalUSD > 0 ? originalTotalUSD - totalAmountUSD : 0;
  const discountAmountUZS = toUZS(discountAmountUSD);

  // Quick discount percentages
  const quickDiscounts = [1, 2, 3, 5, 10];

  // Round to nearest value options
  const getRoundOptions = () => {
    const currentUZS = toUZS(originalTotalUSD);
    const options: number[] = [];
    
    // Round down options
    const roundTo = [1000, 5000, 10000, 50000, 100000];
    roundTo.forEach(r => {
      const rounded = Math.floor(currentUZS / r) * r;
      if (rounded > 0 && rounded < currentUZS && !options.includes(rounded)) {
        options.push(rounded);
      }
    });
    
    return options.sort((a, b) => b - a).slice(0, 4);
  };

  const handleRoundTo = (roundedUZS: number) => {
    if (onTotalChange) {
      const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;
      const newTotalUSD = roundedUZS / rate;
      onTotalChange(newTotalUSD);
    }
  };

  const handleCustomRound = () => {
    const value = parseFloat(customRoundedValue);
    if (!isNaN(value) && value > 0 && onTotalChange) {
      const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;
      onTotalChange(value / rate);
      setCustomRoundedValue('');
    }
  };

  return (
    <div className={`hidden lg:flex ${t.bgCard} border ${t.border} rounded-2xl flex-col ${t.shadow} overflow-hidden h-full`}>
      <div id="cart-target" className={`p-6 border-b ${t.border} ${t.bgPanelAlt} relative transition-colors duration-300 flex justify-between items-center`}>
        <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2 z-10`}>
          <ShoppingCart className={`${t.accent} transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} /> Корзина
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center ${t.textMuted} gap-2 opacity-50`}>
            <ShoppingCart size={48} />
            <p>Корзина пуста</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.productId} className={`${t.bgPanelAlt} border ${t.border} rounded-xl p-3 flex flex-col gap-2 animate-fade-in`}>
              <div className="flex justify-between">
                <span className={`font-medium ${t.textSecondary} text-sm truncate max-w-[180px]`}>{item.productName}</span>
                <button onClick={() => removeFromCart(item.productId)} className={`${t.textMuted} hover:text-red-500`}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex justify-between items-end">
                <div className={`flex items-center gap-2 ${t.bgInput} rounded-lg p-1`}>
                  <input
                    type="number"
                    className={`w-16 bg-transparent text-center text-sm ${t.text} outline-none`}
                    value={item.quantity}
                    onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                  />
                  <span className={`text-xs ${t.textMuted} pr-2`}>{item.unit}</span>
                </div>
                <div className="text-right">
                  <span className={`font-mono font-bold ${t.textSecondary} block`}>
                    {toUZS(item.total).toLocaleString()} сўм
                  </span>
                  <span className={`text-xs ${t.textMuted}`}>${item.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`p-3 ${t.bgPanelAlt} border-t ${t.border} space-y-2`}>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={`text-[10px] font-medium ${t.textMuted} uppercase flex items-center gap-1`}><User size={10} /> Клиент</label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Клиент..."
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-2 py-1.5 ${t.text} text-xs ${t.focusRing} outline-none`}
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  list="clients-list"
                />
                <datalist id="clients-list">
                  {clients.map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <button
                onClick={onOpenClientModal}
                className={`${t.bgButton} border ${t.borderInput} rounded-lg px-2 ${t.textMuted} hover:${t.text} transition-colors`}
                title="Новый клиент"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] font-medium ${t.textMuted} uppercase flex items-center gap-1`}><User size={10} /> Продавец</label>
            <div className="flex gap-1">
              <select
                className={`flex-1 ${t.bgInput} border ${t.borderInput} rounded-lg px-2 py-1.5 ${t.text} text-xs ${t.focusRing} outline-none appearance-none`}
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
              >
                <option value="">Продавец...</option>
                {employees
                  .filter(e => ['sales', 'manager', 'admin'].includes(e.role) && e.status === 'active')
                  .map(e => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))
                }
              </select>
              <button
                onClick={onNavigateToStaff}
                className={`${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-white'} border rounded-lg px-2 transition-colors`}
                title="Добавить сотрудника"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-1">
          <label className={`text-[10px] font-medium ${t.textMuted} uppercase`}>Способ оплаты</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700')}`}
            >
              Наличные
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${paymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700')}`}
            >
              Карта (UZS)
            </button>
            <button
              onClick={() => setPaymentMethod('bank')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${paymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700')}`}
            >
              Перечисление (UZS)
            </button>
            <button
              onClick={() => setPaymentMethod('debt')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700')}`}
            >
              Долг (USD)
            </button>
            <button
              onClick={() => setPaymentMethod('mixed')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all col-span-2 ${paymentMethod === 'mixed' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700')}`}
            >
              Смешанная оплата (Частично)
            </button>
          </div>

          {/* Currency Selector for Cash */}
          {paymentMethod === 'cash' && (
            <div className="flex gap-1.5 mt-1 animate-fade-in">
              <button
                onClick={() => setPaymentCurrency('UZS')}
                className={`flex-1 py-1 rounded text-[10px] font-bold border ${paymentCurrency === 'UZS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-600 text-slate-400')}`}
              >
                В Сумах (UZS)
              </button>
              <button
                onClick={() => setPaymentCurrency('USD')}
                className={`flex-1 py-1 rounded text-[10px] font-bold border ${paymentCurrency === 'USD' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-600 text-slate-400')}`}
              >
                В Долларах (USD)
              </button>
            </div>
          )}

          {/* Due Date for Debt / Mixed Payment */}
          {(paymentMethod === 'debt' || paymentMethod === 'mixed') && (
            <div className="mt-2 animate-fade-in">
              <label className={`flex items-center gap-1 text-xs ${t.textMuted} mb-1`}>
                <Calendar size={12} />
                Срок оплаты долга
              </label>
              <input
                type="date"
                value={debtDueDate}
                onChange={(e) => onDebtDueDateChange?.(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 text-sm ${t.text} focus:ring-2 focus:ring-red-500 outline-none`}
                placeholder="Выберите дату"
              />
            </div>
          )}
        </div>

        {/* Discount Section */}
        {cart.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => setShowDiscountPanel(!showDiscountPanel)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg border transition-all ${
                discountPercent > 0 
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400' 
                  : (theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700')
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <Tag size={14} />
                {discountPercent > 0 
                  ? `Скидка: ${discountPercent.toFixed(1)}% (-${discountAmountUZS.toLocaleString()} сўм)`
                  : 'Добавить скидку'
                }
              </span>
              <Percent size={14} />
            </button>

            {showDiscountPanel && (
              <div className={`${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-slate-700'} rounded-xl p-3 space-y-3 border animate-fade-in`}>
                {/* Quick Discount Buttons */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-medium ${t.textMuted} uppercase`}>Быстрая скидка %</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {quickDiscounts.map(d => (
                      <button
                        key={d}
                        onClick={() => onDiscountChange?.(discountPercent === d ? 0 : d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          Math.abs(discountPercent - d) < 0.1
                            ? 'bg-orange-500 text-white' 
                            : (theme === 'light' ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')
                        }`}
                      >
                        {d}%
                      </button>
                    ))}
                    <button
                      onClick={() => onDiscountChange?.(0)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${theme === 'light' ? 'bg-slate-200 text-red-500 hover:bg-red-100' : 'bg-slate-700 text-red-400 hover:bg-red-500/20'} transition-all`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Round To Options */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-medium ${t.textMuted} uppercase`}>Округлить до (UZS)</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {getRoundOptions().map(val => (
                      <button
                        key={val}
                        onClick={() => handleRoundTo(val)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold ${theme === 'light' ? 'bg-slate-200 text-slate-600 hover:bg-blue-100 hover:text-blue-600' : 'bg-slate-700 text-slate-300 hover:bg-blue-500/20 hover:text-blue-400'} transition-all`}
                      >
                        {val.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Value Input */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-medium ${t.textMuted} uppercase`}>Своя сумма (UZS)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Введите сумму..."
                      className={`flex-1 ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-1.5 ${t.text} text-sm ${t.focusRing} outline-none`}
                      value={customRoundedValue}
                      onChange={(e) => setCustomRoundedValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomRound()}
                    />
                    <button
                      onClick={handleCustomRound}
                      disabled={!customRoundedValue}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-all`}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={`flex flex-col gap-1 pt-2 border-t ${t.border} text-xs`}>
          <div className="flex justify-between items-center">
            <span className={t.textMuted}>Подытог (без НДС):</span>
            <span className={`font-mono ${t.textSecondary}`}>${subtotalUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-amber-400">
            <span className="">НДС ({settings.vatRate}%):</span>
            <span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between items-center text-orange-400">
              <span className="">Скидка ({discountPercent.toFixed(1)}%):</span>
              <span className="font-mono">-${discountAmountUSD.toFixed(2)}</span>
            </div>
          )}
          {discountPercent > 0 && (
            <div className={`flex justify-between items-center ${t.textMuted} text-[10px]`}>
              <span className="">Было:</span>
              <span className="font-mono line-through">${originalTotalUSD.toFixed(2)} / {toUZS(originalTotalUSD).toLocaleString()} сўм</span>
            </div>
          )}
          <div className={`flex justify-between items-center pt-1 border-t ${t.border}`}>
            <span className={`${t.text} font-bold`}>ИТОГО (USD):</span>
            <span className={`font-mono ${t.text} font-bold`}>${totalAmountUSD.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between items-center pt-0.5`}>
            <span className={`${t.text} font-bold`}>К оплате (UZS):</span>
            <span className={`text-xl font-bold font-mono ${discountPercent > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{totalAmountUZS.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={onCompleteOrder}
          disabled={cart.length === 0 || !customerName}
          className={`w-full ${theme === 'light' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20`}
        >
          <CheckCircle size={18} />
          {paymentMethod === 'debt' ? 'Оформить в долг' : 'Оформить и оплатить'}
        </button>

        {/* Receipt Buttons */}
        {lastOrder && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onShowReceipt(lastOrder)}
              className={`flex-1 ${theme === 'light' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-500'} text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20`}
            >
              <FileText size={16} />
              Просмотр чека
            </button>
            <button
              onClick={() => onPrintInvoice(lastOrder)}
              className={`flex-1 ${theme === 'light' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20`}
            >
              <FileText size={16} />
              Счет
            </button>
            <button
              onClick={() => onPrintWaybill(lastOrder)}
              className={`flex-1 ${theme === 'light' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-purple-600 hover:bg-purple-500'} text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/20`}
            >
              <FileText size={16} />
              Накладная
            </button>
          </div>
        )}
      </div>
    </div>
  );
};







