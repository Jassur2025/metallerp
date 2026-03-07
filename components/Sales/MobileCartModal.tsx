import React, { useState } from 'react';
import { ShoppingCart, Trash2, User, Plus, CheckCircle, X, Tag } from 'lucide-react';
import { OrderItem, Client, Employee, AppSettings } from '../../types';
import { Currency, FlyingItem } from './types';
import { ClientDropdown } from '../ClientDropdown';
import { IdGenerator } from '../../utils/idGenerator';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface MobileCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: OrderItem[];
  removeFromCart: (id: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  updatePrice: (productId: string, price: number) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  sellerName: string;
  setSellerName: (val: string) => void;
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
  // Discount Props (amount-based)
  discountAmount?: number;
  onDiscountAmountChange?: (val: number) => void;
  discountCurrency?: Currency;
  onDiscountCurrencyChange?: (val: Currency) => void;
  originalTotalUSD?: number;
  onSaveClient?: (clients: Client[]) => void;
  customerPhone?: string;
  setCustomerPhone?: (val: string) => void;
  exchangeRate: number;
}

export const MobileCartModal: React.FC<MobileCartModalProps> = ({
  isOpen,
  onClose,
  cart,
  removeFromCart,
  updateQuantity,
  updatePrice,
  customerName,
  setCustomerName,
  sellerName,
  setSellerName,
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
  flyingItems,
  discountAmount = 0,
  onDiscountAmountChange,
  discountCurrency = 'USD',
  onDiscountCurrencyChange,
  originalTotalUSD = 0,
  onSaveClient,
  customerPhone = '',
  setCustomerPhone = () => { },
  exchangeRate
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [inputCurrencies, setInputCurrencies] = useState<Record<string, 'USD' | 'UZS'>>({});

  const toggleCurrency = (productId: string) => {
    setInputCurrencies(prev => ({ ...prev, [productId]: prev[productId] === 'UZS' ? 'USD' : 'UZS' }));
  };

  const discountAmountUSD = discountCurrency === 'UZS' ? (exchangeRate > 0 ? discountAmount / exchangeRate : 0) : discountAmount;
  const discountAmountUZS = toUZS(discountAmountUSD);
  const discountPercent = originalTotalUSD > 0 ? (discountAmountUSD / originalTotalUSD) * 100 : 0;

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
                  <span className="font-medium text-slate-200 text-sm">
                    {item.productName}
                    {item.dimensions && item.dimensions !== '-' && <span className="text-xs text-slate-500 ml-1">({item.dimensions})</span>}
                  </span>
                  <button onClick={() => removeFromCart(item.productId)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-end mt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold transition-colors
                        ${theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                    >−</button>
                    <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
                      <input
                        type="number"
                        className="w-12 bg-transparent text-center font-mono text-sm text-white outline-none focus:ring-0"
                        value={item.quantity}
                        onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                      />
                      <span className="text-xs text-slate-500 pr-1">{item.unit}</span>
                    </div>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold transition-colors
                        ${theme === 'light' ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' : 'bg-primary-500/20 hover:bg-primary-500/40 text-primary-400'}`}
                    >+</button>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-slate-900 rounded-lg pl-1 pr-1 py-1 mb-1 border border-slate-700 w-[110px]">
                      <button
                        onClick={() => toggleCurrency(item.productId)}
                        className={`text-[10px] font-bold px-1 rounded transition-colors ${inputCurrencies[item.productId] === 'UZS'
                            ? 'text-emerald-500 hover:bg-emerald-500/20'
                            : 'text-blue-400 hover:bg-blue-500/20'
                          }`}
                        title="Сменить валюту ввода"
                      >
                        {inputCurrencies[item.productId] === 'UZS' ? 'UZS' : '$'}
                      </button>
                      <input
                        type="number"
                        className="w-full bg-transparent text-right font-mono text-xs text-white outline-none focus:ring-0"
                        value={inputCurrencies[item.productId] === 'UZS' ? Math.round(item.priceAtSale * exchangeRate) : item.priceAtSale}
                        onChange={e => {
                          const val = Number(e.target.value);
                          updatePrice(item.productId, inputCurrencies[item.productId] === 'UZS' ? (exchangeRate > 0 ? val / exchangeRate : 0) : val);
                        }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-300 block text-sm">
                      {toUZS(item.total).toLocaleString()} сўм
                    </span>
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
                <div className="flex-1 w-full min-w-0">
                  <ClientDropdown
                    clients={clients}
                    value={customerName}
                    onChange={setCustomerName}
                    onPhone={setCustomerPhone}
                    onAddClient={onSaveClient || (() => { })}
                    theme={theme}
                    t={t}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const name = customerName.trim();
                    if (!name || !onSaveClient) { return; }
                    const exists = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
                    if (exists) return; // Allaqachon bor
                    const newClient: Client = {
                      id: IdGenerator.client(),
                      name,
                      phone: customerPhone.trim() || '',
                      creditLimit: 0,
                      totalPurchases: 0,
                      totalDebt: 0,
                      notes: 'Добавлен с мобильного'
                    };
                    onSaveClient([...clients, newClient]);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors flex-shrink-0"
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

          {/* Discount Section - Mobile */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowDiscountPanel(!showDiscountPanel)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${discountAmount > 0
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                  : 'bg-slate-800 border-slate-600 text-slate-400'
                  }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Tag size={16} />
                  {discountAmount > 0
                    ? `Скидка: ${discountCurrency === 'UZS' ? `${discountAmount.toLocaleString()} сўм` : `$${discountAmount.toFixed(2)}`}`
                    : 'Скидка'
                  }
                </span>
                <Tag size={16} />
              </button>

              {showDiscountPanel && (
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-3 border border-slate-700 animate-fade-in">
                  {/* Currency Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDiscountCurrencyChange?.('USD')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${discountCurrency === 'USD' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                    >
                      USD ($)
                    </button>
                    <button
                      onClick={() => onDiscountCurrencyChange?.('UZS')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${discountCurrency === 'UZS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                    >
                      UZS (сўм)
                    </button>
                  </div>
                  {/* Amount Input */}
                  <input
                    type="number"
                    placeholder={discountCurrency === 'UZS' ? 'Сумма скидки (сўм)' : 'Сумма скидки ($)'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-orange-500/30"
                    value={discountAmount || ''}
                    onChange={(e) => onDiscountAmountChange?.(Number(e.target.value) || 0)}
                  />
                  {/* Quick amounts */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(discountCurrency === 'UZS'
                      ? [5000, 10000, 50000, 100000, 500000]
                      : [1, 2, 5, 10, 20]
                    ).map(val => (
                      <button
                        key={val}
                        onClick={() => onDiscountAmountChange?.(discountAmount === val ? 0 : val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${discountAmount === val
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {discountCurrency === 'UZS' ? val.toLocaleString() : `$${val}`}
                      </button>
                    ))}
                    {discountAmount > 0 && (
                      <button
                        onClick={() => onDiscountAmountChange?.(0)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Подытог:</span>
              <span className="font-mono text-slate-300">${subtotalUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-amber-400">
              <span>НДС ({settings.vatRate}%):</span>
              <span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-orange-400">
                <span>Скидка:</span>
                <span className="font-mono">-${discountAmountUSD.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-slate-200 font-bold">ИТОГО:</span>
              <span className="font-mono text-slate-200 font-bold">${totalAmountUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-200 font-bold">К оплате:</span>
              <span className={`text-2xl font-bold font-mono ${discountAmount > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>{totalAmountUZS.toLocaleString()} сўм</span>
            </div>
          </div>

          <button
            onClick={onCompleteOrder}
            disabled={cart.length === 0 || !customerName.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <CheckCircle size={20} />
            Оформить
          </button>
        </div>
      </div>
    </div>
  );
};







