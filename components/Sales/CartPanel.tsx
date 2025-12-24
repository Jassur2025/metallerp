import React from 'react';
import { ShoppingCart, Trash2, User, Plus, CheckCircle, FileText, Printer } from 'lucide-react';
import { OrderItem, Client, Employee, Order, AppSettings } from '../../types';
import { PaymentMethod, Currency, FlyingItem } from './types';

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
  flyingItems
}) => {
  return (
    <div className="hidden lg:flex bg-slate-800 border border-slate-700 rounded-2xl flex-col shadow-2xl shadow-black/20 overflow-hidden h-full">
      <div id="cart-target" className="p-6 border-b border-slate-700 bg-slate-900/50 relative transition-colors duration-300 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 z-10">
          <ShoppingCart className={`text-primary-500 transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} /> Корзина
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
            <ShoppingCart size={48} />
            <p>Корзина пуста</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.productId} className="bg-slate-700/30 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 animate-fade-in">
              <div className="flex justify-between">
                <span className="font-medium text-slate-200 text-sm truncate max-w-[180px]">{item.productName}</span>
                <button onClick={() => removeFromCart(item.productId)} className="text-slate-500 hover:text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
                  <input
                    type="number"
                    className="w-16 bg-transparent text-center text-sm text-white outline-none"
                    value={item.quantity}
                    onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                  />
                  <span className="text-xs text-slate-500 pr-2">{item.unit}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-300 block">
                    {toUZS(item.total).toLocaleString()} сўм
                  </span>
                  <span className="text-xs text-slate-500">${item.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-6 bg-slate-900 border-t border-slate-700 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1"><User size={12} /> Клиент</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Поиск или выбор клиента..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none"
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
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors"
                title="Новый клиент"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1"><User size={12} /> Продавец</label>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none appearance-none"
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
              >
                <option value="">Выберите продавца</option>
                {employees
                  .filter(e => ['sales', 'manager', 'admin'].includes(e.role) && e.status === 'active')
                  .map(e => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))
                }
              </select>
              <button
                onClick={onNavigateToStaff}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors"
                title="Добавить сотрудника"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase">Способ оплаты</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
            >
              Наличные
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
            >
              Карта (UZS)
            </button>
            <button
              onClick={() => setPaymentMethod('bank')}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
            >
              Перечисление (UZS)
            </button>
            <button
              onClick={() => setPaymentMethod('debt')}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
            >
              Долг (USD)
            </button>
            <button
              onClick={() => setPaymentMethod('mixed')}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all col-span-2 ${paymentMethod === 'mixed' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
            >
              Смешанная оплата (Частично)
            </button>
          </div>

          {/* Currency Selector for Cash */}
          {paymentMethod === 'cash' && (
            <div className="flex gap-2 mt-2 animate-fade-in">
              <button
                onClick={() => setPaymentCurrency('UZS')}
                className={`flex-1 py-1 rounded text-xs border ${paymentCurrency === 'UZS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
              >
                В Сумах (UZS)
              </button>
              <button
                onClick={() => setPaymentCurrency('USD')}
                className={`flex-1 py-1 rounded text-xs border ${paymentCurrency === 'USD' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
              >
                В Долларах (USD)
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Подытог (без НДС):</span>
            <span className="font-mono text-slate-300">${subtotalUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-amber-400">
            <span className="">НДС ({settings.vatRate}%):</span>
            <span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <span className="text-slate-200 font-bold">ИТОГО (USD):</span>
            <span className="font-mono text-slate-200 font-bold">${totalAmountUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-slate-200 font-bold">К оплате (UZS):</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">{totalAmountUZS.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={onCompleteOrder}
          disabled={cart.length === 0 || !customerName}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
        >
          <CheckCircle size={20} />
          {paymentMethod === 'debt' ? 'Оформить в долг' : 'Оформить и оплатить'}
        </button>

        {/* Receipt Buttons */}
        {lastOrder && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onShowReceipt(lastOrder)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              <FileText size={16} />
              Просмотр чека
            </button>
            <button
              onClick={() => onPrintInvoice(lastOrder)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              <FileText size={16} />
              Счет
            </button>
            <button
              onClick={() => onPrintWaybill(lastOrder)}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/20"
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







