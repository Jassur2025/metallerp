import React from 'react';
import { ShoppingCart, Trash2, User, Plus, CheckCircle, X } from 'lucide-react';
import { OrderItem, Client, Employee, AppSettings } from '../../types';
import { PaymentMethod, Currency, FlyingItem } from './types';

interface MobileCartModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  flyingItems: FlyingItem[];
}

export const MobileCartModal: React.FC<MobileCartModalProps> = ({
  isOpen,
  onClose,
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
  flyingItems
}) => {
  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div 
        className="bg-slate-800 w-full max-h-[90vh] rounded-t-2xl flex flex-col shadow-2xl border-t border-slate-700 animate-slide-up" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div id="cart-target-mobile" className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className={`text-primary-500 transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} />
            Корзина {cart.length > 0 && <span className="text-sm bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">({cart.length})</span>}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50 py-12">
              <ShoppingCart size={48} />
              <p>Корзина пуста</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="bg-slate-700/30 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 animate-fade-in">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-200 text-sm">{item.productName}</span>
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

        {/* Cart Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-700 space-y-4">
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
                    list="clients-list-mobile"
                  />
                  <datalist id="clients-list-mobile">
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
        </div>
      </div>
    </div>
  );
};

