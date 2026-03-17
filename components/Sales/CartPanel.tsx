import React, { useState } from 'react';
import { ShoppingCart, Trash2, User, Plus, CheckCircle, FileText, Tag, Eraser } from 'lucide-react';
import { OrderItem, Client, Employee, Order, AppSettings } from '../../types';
import { Currency, FlyingItem } from './types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { ClientDropdown } from '../ClientDropdown';
import { IdGenerator } from '../../utils/idGenerator';

interface CartPanelProps {
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
  lastOrder: Order | null;
  onShowReceipt: (order: Order) => void;
  onPrintReceipt: (order: Order) => void;
  onPrintInvoice: (order: Order) => void;
  onPrintWaybill: (order: Order) => void;
  flyingItems: FlyingItem[];
  // Discount Props (amount-based)
  discountAmount?: number;
  onDiscountAmountChange?: (val: number) => void;
  discountCurrency?: Currency;
  onDiscountCurrencyChange?: (val: Currency) => void;
  originalTotalUSD?: number;
  // Yangi qo'shilgan prop: yangi mijozni saqlash
  onSaveClient?: (clients: Client[]) => void;
  customerPhone?: string;
  setCustomerPhone?: (val: string) => void;
  exchangeRate: number;
}

export const CartPanel: React.FC<CartPanelProps> = ({
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
  lastOrder,
  onShowReceipt,
  onPrintReceipt,
  onPrintInvoice,
  onPrintWaybill,
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
  const [globalCurrency, setGlobalCurrency] = useState<'USD' | 'UZS'>('USD');

  // Calculate discount display
  const discountAmountUSD = discountCurrency === 'UZS' ? (exchangeRate > 0 ? discountAmount / exchangeRate : 0) : discountAmount;
  const discountAmountUZS = toUZS(discountAmountUSD);
  const discountPercent = originalTotalUSD > 0 ? (discountAmountUSD / originalTotalUSD) * 100 : 0;

  const isDark = theme !== 'light';

  return (
    <div className={`hidden lg:flex ${isDark ? 'bg-slate-900/95 border-slate-700/80' : `${t.bgCard} border-slate-300`} border rounded-2xl flex-col overflow-hidden h-full`}>
      {/* ЧЕК Header */}
      <div id="cart-target" className={`px-4 py-3 ${isDark ? 'bg-slate-800/80 border-b border-slate-700/60' : 'bg-slate-50 border-b border-slate-200'} flex justify-between items-center`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-blue-50'}`}>
            <ShoppingCart size={18} className={`${isDark ? 'text-amber-400' : 'text-blue-600'} transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} />
          </div>
          <div>
            <h3 className={`text-base font-bold ${t.text} leading-tight`}>ЧЕК</h3>
            {cart.length > 0 && <span className={`text-[10px] ${t.textMuted}`}>{cart.length} позиций</span>}
          </div>
        </div>
        {cart.length > 0 && (
          <button
            onClick={() => cart.forEach(item => removeFromCart(item.productId))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'}`}
          >
            <Eraser size={13} /> Очистить
          </button>
        )}
      </div>

      {/* Client & Seller — TOP SECTION */}
      <div className={`px-4 py-3 ${isDark ? 'border-b border-slate-700/40' : 'border-b border-slate-200'}`}>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><User size={10} /> Клиент</label>
            <div className="flex gap-1">
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
                title="Быстрое добавление"
                onClick={() => {
                  const name = customerName.trim();
                  if (!name || !onSaveClient) { return; }
                  const exists = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
                  if (exists) return;
                  const newClient: Client = {
                    id: IdGenerator.client(),
                    name,
                    phone: customerPhone.trim() || '',
                    creditLimit: 0,
                    totalPurchases: 0,
                    totalDebt: 0,
                    notes: 'Быстро добавлен во время продажи'
                  };
                  onSaveClient([...clients, newClient]);
                }}
                className={`${isDark ? 'bg-emerald-500/10 text-emerald-400 border-slate-700 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-slate-200 hover:bg-emerald-100'} border rounded-lg px-2 flex-shrink-0 transition-colors`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider flex items-center gap-1`}><User size={10} /> Продавец</label>
            <div className="flex gap-1">
              <select
                className={`flex-1 ${isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white'
                  : `${t.bgInput} border-slate-200 text-slate-900`
                } border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 ${isDark ? 'focus:ring-blue-500/30 focus:border-blue-500/50' : 'focus:ring-blue-400/30 focus:border-blue-400'} transition-all`}
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
              >
                <option value="">Выберите продавца...</option>
                {employees
                  .filter(e => ['sales', 'manager', 'admin'].includes(e.role) && e.status === 'active')
                  .map(e => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))
                }
              </select>
              <button
                onClick={onNavigateToStaff}
                className={`${isDark
                  ? 'bg-slate-800/60 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-500'
                } border rounded-lg px-2 transition-colors flex-shrink-0`}
                title="Добавить сотрудника"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Currency Toggle */}
      {cart.length > 0 && (
        <div className={`px-4 py-2 flex items-center justify-between ${isDark ? 'border-b border-slate-700/40' : 'border-b border-slate-200'}`}>
          <span className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Валюта</span>
          <div className={`flex p-0.5 rounded-lg ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'} border ${t.border}`}>
            <button
              onClick={() => setGlobalCurrency('USD')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${globalCurrency === 'USD'
                ? (isDark ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                : `${t.textMuted} hover:${t.text}`
              }`}
            >
              $ USD
            </button>
            <button
              onClick={() => setGlobalCurrency('UZS')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${globalCurrency === 'UZS'
                ? (isDark ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'bg-white text-emerald-600 shadow-sm')
                : `${t.textMuted} hover:${t.text}`
              }`}
            >
              сўм
            </button>
          </div>
        </div>
      )}

      {/* Cart Items - scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {cart.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center ${t.textMuted} gap-3 py-12`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`}>
              <ShoppingCart size={32} className="opacity-30" />
            </div>
            <p className="text-sm font-medium opacity-50">Корзина пуста</p>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-slate-700/30' : 'divide-slate-100'}`}>
            {cart.map((item, idx) => (
              <div key={item.productId} className={`px-3 py-2.5 transition-all animate-fade-in ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} group`}>
                {/* Single compact row */}
                <div className="flex items-center gap-2">
                  {/* Name (dimensions) unit — flexible width, single line */}
                  <div className="min-w-0 flex-1">
                    <span className={`font-semibold ${t.text} text-sm block truncate leading-tight`}>
                      {item.productName}{item.dimensions && item.dimensions !== '-' ? ` (${item.dimensions})` : ''} <span className={`font-normal ${t.textMuted}`}>{item.unit || 'шт'}</span>
                    </span>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-0 flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-l-lg text-sm font-bold transition-all
                        ${isDark ? 'bg-slate-700/80 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}
                    >−</button>
                    <input
                      type="number"
                      className={`w-10 h-8 bg-transparent text-center font-mono text-sm font-bold ${t.text} outline-none ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'} border-y ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                      value={item.quantity}
                      onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-r-lg text-sm font-bold transition-all
                        ${isDark ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                    >+</button>
                  </div>

                  {/* Price input — adaptive width */}
                  <div className={`flex items-center ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'} rounded-lg border h-8 flex-shrink-0 ${globalCurrency === 'UZS' ? 'w-[120px]' : 'w-[90px]'}`}>
                    <input
                      type="number"
                      className={`w-full bg-transparent text-right font-mono text-sm ${t.text} outline-none pl-2 pr-1`}
                      value={globalCurrency === 'UZS' ? Math.round(item.priceAtSale * exchangeRate) : item.priceAtSale}
                      onChange={e => {
                        const val = Number(e.target.value);
                        updatePrice(item.productId, globalCurrency === 'UZS' ? (exchangeRate > 0 ? val / exchangeRate : 0) : val);
                      }}
                    />
                    <span className={`text-[10px] font-bold pr-2 flex-shrink-0 ${globalCurrency === 'UZS' ? 'text-emerald-500' : (isDark ? 'text-blue-400' : 'text-blue-600')}`}>
                      {globalCurrency === 'UZS' ? 'сўм' : '$'}
                    </span>
                  </div>

                  {/* Line total + delete */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`font-mono font-bold text-sm text-right ${isDark ? 'text-emerald-400' : 'text-emerald-600'} w-[80px]`}>
                      {globalCurrency === 'UZS'
                        ? toUZS(item.total).toLocaleString()
                        : `$${item.total.toFixed(2)}`
                      }
                    </span>
                    <button onClick={() => removeFromCart(item.productId)}
                      className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ${isDark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Panel - Fixed */}
      <div className={`${isDark ? 'bg-slate-800/60 border-t border-slate-700/60' : 'bg-slate-50 border-t border-slate-200'} flex flex-col`}>

        {/* Discount Section (amount-based) */}
        {cart.length > 0 && (
          <div className="px-4 py-2">
            <button
              onClick={() => setShowDiscountPanel(!showDiscountPanel)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${discountAmount > 0
                ? (isDark ? 'bg-orange-500/15 border-orange-500/40 text-orange-400' : 'bg-orange-50 border-orange-300 text-orange-600')
                : (isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200')
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Tag size={13} />
                {discountAmount > 0
                  ? `Скидка: ${discountCurrency === 'UZS' ? `${discountAmount.toLocaleString()} сўм` : `$${discountAmount.toFixed(2)}`} (${discountPercent.toFixed(1)}%)`
                  : 'Добавить скидку'
                }
              </span>
              <Tag size={13} />
            </button>

            {showDiscountPanel && (
              <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'} rounded-xl p-3 space-y-3 border animate-fade-in mt-2`}>
                {/* Currency Toggle */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Валюта скидки</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onDiscountCurrencyChange?.('USD')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${discountCurrency === 'USD'
                        ? (isDark ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-blue-50 border-blue-400 text-blue-600')
                        : (isDark ? 'bg-slate-800 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600')}`}
                    >
                      USD ($)
                    </button>
                    <button
                      onClick={() => onDiscountCurrencyChange?.('UZS')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${discountCurrency === 'UZS'
                        ? (isDark ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-emerald-50 border-emerald-400 text-emerald-600')
                        : (isDark ? 'bg-slate-800 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600')}`}
                    >
                      UZS (сўм)
                    </button>
                  </div>
                </div>

                {/* Discount Amount Input */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>
                    Сумма скидки ({discountCurrency === 'UZS' ? 'сўм' : '$'})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={discountCurrency === 'UZS' ? 'Например: 50000' : 'Например: 5'}
                      className={`flex-1 ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : `${t.bgInput} border-slate-200`} border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 ${isDark ? 'focus:ring-orange-500/30' : 'focus:ring-orange-400/30'}`}
                      value={discountAmount || ''}
                      onChange={(e) => onDiscountAmountChange?.(Number(e.target.value) || 0)}
                    />
                    {discountAmount > 0 && (
                      <button
                        onClick={() => onDiscountAmountChange?.(0)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'bg-slate-700 text-red-400 hover:bg-red-500/20' : 'bg-slate-200 text-red-500 hover:bg-red-100'} transition-all`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick discount amounts */}
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Быстрая скидка</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(discountCurrency === 'UZS'
                      ? [5000, 10000, 50000, 100000, 500000]
                      : [1, 2, 5, 10, 20]
                    ).map(val => (
                      <button
                        key={val}
                        onClick={() => onDiscountAmountChange?.(discountAmount === val ? 0 : val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${discountAmount === val
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                          : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')
                        }`}
                      >
                        {discountCurrency === 'UZS' ? val.toLocaleString() : `$${val}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info line */}
                {discountAmount > 0 && (
                  <div className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'} pt-1`}>
                    ≈ {discountCurrency === 'UZS'
                      ? `$${discountAmountUSD.toFixed(2)}`
                      : `${discountAmountUZS.toLocaleString()} сўм`
                    } ({discountPercent.toFixed(1)}%)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Totals */}
        <div className={`px-4 py-3 ${isDark ? 'bg-slate-900/50 border-t border-slate-700/40' : 'bg-white border-t border-slate-200'} space-y-1.5`}>
          <div className="flex justify-between items-center text-xs">
            <span className={t.textMuted}>Подытог (без НДС):</span>
            <span className={`font-mono font-medium ${t.textSecondary}`}>${subtotalUSD.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between items-center text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            <span>НДС ({settings.vatRate}%):</span>
            <span className="font-mono font-medium">+${vatAmountUSD.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between items-center text-xs text-orange-400">
              <span>Скидка:</span>
              <span className="font-mono font-medium">−${discountAmountUSD.toFixed(2)} ({discountPercent.toFixed(1)}%)</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className={`flex justify-between items-center ${t.textMuted} text-[10px]`}>
              <span>Было:</span>
              <span className="font-mono line-through">${originalTotalUSD.toFixed(2)} / {toUZS(originalTotalUSD).toLocaleString()} сўм</span>
            </div>
          )}

          {/* Divider */}
          <div className={`border-t ${isDark ? 'border-slate-700/60' : 'border-slate-200'} my-1`} />

          {/* ИТОГО */}
          <div className={`flex justify-between items-center p-2 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-100/80'}`}>
            <span className={`font-bold text-sm ${t.text}`}>ИТОГО:</span>
            <div className="text-right">
              {globalCurrency === 'UZS' ? (
                <>
                  <span className={`font-mono font-extrabold text-xl ${discountAmount > 0 ? 'text-orange-400' : (isDark ? 'text-emerald-400' : 'text-emerald-600')} block`}>
                    {totalAmountUZS.toLocaleString()} <span className="text-xs font-bold opacity-70">сўм</span>
                  </span>
                  <span className={`font-mono font-semibold text-xs ${t.textMuted}`}>${totalAmountUSD.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <span className={`font-mono font-extrabold text-xl ${discountAmount > 0 ? 'text-orange-400' : (isDark ? 'text-emerald-400' : 'text-emerald-600')} block`}>
                    ${totalAmountUSD.toFixed(2)}
                  </span>
                  <span className={`font-mono font-semibold text-xs ${t.textMuted}`}>{totalAmountUZS.toLocaleString()} сўм</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="px-4 pb-3 pt-1">
          <button
            onClick={onCompleteOrder}
            disabled={cart.length === 0 || !customerName}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
              ${cart.length > 0 && customerName
                ? isDark
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25'
                  : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                : isDark
                  ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
          >
            <CheckCircle size={17} />
            {!customerName && cart.length > 0
              ? 'Укажите клиента'
              : cart.length === 0
                ? 'Корзина пуста'
                : globalCurrency === 'UZS'
                  ? `Оформить · ${totalAmountUZS.toLocaleString()} сўм`
                  : `Оформить · $${totalAmountUSD.toFixed(2)}`
            }
          </button>
        </div>

        {/* Receipt Buttons */}
        {lastOrder && (
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => onShowReceipt(lastOrder)}
              className={`flex-1 ${isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all`}
            >
              <FileText size={14} /> Чек
            </button>
            <button
              onClick={() => onPrintInvoice(lastOrder)}
              className={`flex-1 ${isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-500 hover:bg-indigo-600'} text-white py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all`}
            >
              <FileText size={14} /> Счёт
            </button>
            <button
              onClick={() => onPrintWaybill(lastOrder)}
              className={`flex-1 ${isDark ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-500 hover:bg-purple-600'} text-white py-2 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all`}
            >
              <FileText size={14} /> Накладная
            </button>
          </div>
        )}
      </div>
    </div>
  );
};






