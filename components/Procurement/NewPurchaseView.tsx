import React from 'react';
import {
  AlertTriangle,
  Container,
  DollarSign,
  FileText,
  Plus,
  Save,
  Scale,
  Trash2,
  Truck,
} from 'lucide-react';
import type { AppSettings, Product, PurchaseItem, PurchaseOverheads } from '../../types';
import type { PaymentCurrency, PaymentMethod, ProcurementType, Totals } from './types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';

interface NewPurchaseViewProps {
  procurementType: ProcurementType;

  supplierName: string;
  setSupplierName: (v: string) => void;
  date: string;
  setDate: (v: string) => void;

  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  paymentCurrency: PaymentCurrency;
  setPaymentCurrency: (v: PaymentCurrency) => void;

  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (v: string) => void;
  inputQty: number;
  setInputQty: (v: number) => void;
  inputPrice: number;
  setInputPrice: (v: number) => void;

  openNewProductModal: () => void;
  handleAddItem: () => void;
  removeItem: (productId: string) => void;
  updateCartItemQty: (productId: string, qty: number) => void;
  updateCartItemPrice: (productId: string, price: number) => void;

  overheads: PurchaseOverheads;
  setOverheads: (v: PurchaseOverheads) => void;

  totals: Totals;
  cart: PurchaseItem[];
  settings: AppSettings;

  handleComplete: () => void;
}

export const NewPurchaseView: React.FC<NewPurchaseViewProps> = ({
  procurementType,
  supplierName,
  setSupplierName,
  date,
  setDate,
  paymentMethod,
  setPaymentMethod,
  paymentCurrency,
  setPaymentCurrency,
  products,
  selectedProductId,
  setSelectedProductId,
  inputQty,
  setInputQty,
  inputPrice,
  setInputPrice,
  openNewProductModal,
  handleAddItem,
  removeItem,
  updateCartItemQty,
  updateCartItemPrice,
  overheads,
  setOverheads,
  totals,
  cart,
  settings,
  handleComplete,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
      {/* Left: Inputs & Overheads */}
      <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-20">
        {/* Document Info */}
        <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} space-y-4 shadow-lg`}>
          <h3 className={`${t.text} font-bold flex items-center gap-2`}>
            <FileText size={18} className="text-primary-500" /> Основное (
            {procurementType === 'local' ? 'Местный' : 'Импорт'})
          </h3>
          <div className="space-y-2">
            <label className={`text-xs font-medium ${t.textMuted}`}>Поставщик</label>
            <input
              type="text"
              className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
              placeholder="Название поставщика"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className={`text-xs font-medium ${t.textMuted}`}>Дата прихода</label>
            <input
              type="date"
              className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className={`text-xs font-medium ${t.textMuted}`}>Оплата</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPaymentMethod('cash');
                }}
                className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'cash'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : `${t.bg} ${t.border} ${t.textMuted}`
                  }`}
              >
                💵 Наличные
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('card');
                  setPaymentCurrency('UZS');
                }}
                className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'card'
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : `${t.bg} ${t.border} ${t.textMuted}`
                  }`}
              >
                💳 Карта
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('bank');
                  setPaymentCurrency('UZS');
                }}
                className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'bank'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : `${t.bg} ${t.border} ${t.textMuted}`
                  }`}
              >
                🏦 Р/С (Банк)
              </button>
              <button
                onClick={() => setPaymentMethod('debt')}
                className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'debt'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : `${t.bg} ${t.border} ${t.textMuted}`
                  }`}
              >
                📋 В долг
              </button>
            </div>
            <button
              onClick={() => setPaymentMethod('mixed')}
              className={`w-full px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'mixed'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : `${t.bg} ${t.border} ${t.textMuted}`
                }`}
            >
              🔀 Смешанная оплата (Частично)
            </button>

            {/* Currency Selection - Only for cash */}
            {paymentMethod === 'cash' && (
              <div className="mt-2">
                <label className={`text-xs font-medium ${t.textMuted} mb-1 block`}>
                  Валюта оплаты
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentCurrency('USD')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${paymentCurrency === 'USD'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                        : `${t.bg} ${t.border} ${t.textMuted}`
                      }`}
                  >
                    💵 USD
                  </button>
                  <button
                    onClick={() => setPaymentCurrency('UZS')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${paymentCurrency === 'UZS'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : `${t.bg} ${t.border} ${t.textMuted}`
                      }`}
                  >
                    💰 UZS
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'bank' && (
              <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400">🏦 Оплата с расчётного счёта (UZS)</p>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-xs text-orange-400">💳 Оплата картой (UZS)</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Item Form */}
        <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} space-y-4 shadow-lg`}>
          <div className="flex items-center justify-between">
            <h3 className={`${t.text} font-bold flex items-center gap-2`}>
              <Plus size={18} className="text-emerald-500" /> Добавить товар
            </h3>
            <button
              onClick={openNewProductModal}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
            >
              + Новый товар
            </button>
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-medium ${t.textMuted}`}>Товар</label>
            <select
              className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none`}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">-- Выберите товар --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.dimensions})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Кол-во</label>
              <input
                type="number"
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none`}
                placeholder="0"
                value={inputQty || ''}
                onChange={(e) => setInputQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>
                {procurementType === 'import' ? 'Цена Invoice (USD)' : 'Цена закупки (USD)'}
              </label>
              <input
                type="number"
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none`}
                placeholder="0.00"
                value={inputPrice || ''}
                onChange={(e) => setInputPrice(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            onClick={handleAddItem}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20"
          >
            Добавить в список
          </button>
        </div>

        {/* Overheads Form - ONLY FOR IMPORT */}
        {procurementType === 'import' && (
          <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} space-y-4 shadow-lg relative overflow-hidden animate-fade-in`}>
            <div className={`absolute -right-6 -top-6 ${t.textMuted} opacity-20`}>
              <Container size={100} />
            </div>
            <h3 className={`${t.text} font-bold flex items-center gap-2`}>
              <Truck size={18} className="text-amber-500" /> Накладные расходы (USD)
            </h3>
            <p className={`text-xs ${t.textMuted}`}>
              Распределяются на себестоимость пропорционально сумме.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={`text-xs ${t.textMuted}`}>Логистика</label>
                <input
                  type="number"
                  className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none text-sm`}
                  value={overheads.logistics || ''}
                  onChange={(e) => setOverheads({ ...overheads, logistics: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className={`text-xs ${t.textMuted}`}>Тамож. Пошлина</label>
                <input
                  type="number"
                  className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none text-sm`}
                  value={overheads.customsDuty || ''}
                  onChange={(e) =>
                    setOverheads({ ...overheads, customsDuty: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className={`text-xs ${t.textMuted}`}>Тамож. НДС</label>
                <input
                  type="number"
                  className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none text-sm`}
                  value={overheads.importVat || ''}
                  onChange={(e) => setOverheads({ ...overheads, importVat: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-xs ${t.textMuted}`}>Прочее</label>
                <input
                  type="number"
                  className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none text-sm`}
                  value={overheads.other || ''}
                  onChange={(e) => setOverheads({ ...overheads, other: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Items Table & Summary */}
      <div className={`lg:col-span-2 flex flex-col h-full ${t.bgCard} border ${t.border} rounded-2xl shadow-2xl overflow-hidden`}>
        <div className={`p-4 ${t.bg} border-b ${t.border} flex justify-between items-center`}>
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <Scale className="text-blue-500" /> Список товаров к приходу
          </h3>
          <div className="bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
            <span className="text-xs text-blue-300">Позиций: </span>
            <span className={`font-mono font-bold ${t.text}`}>{cart.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className={`${t.bg} text-xs uppercase ${t.textMuted} font-medium sticky top-0`}>
              <tr>
                <th className="px-4 py-3">Товар</th>
                <th className="px-4 py-3 text-right">Кол-во</th>
                <th className="px-4 py-3 text-right">Цена</th>
                {procurementType === 'import' && (
                  <th className="px-4 py-3 text-right bg-amber-500/5 text-amber-200">
                    Себест. (Landed)
                  </th>
                )}
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-4 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divide}`}>
              {totals.itemsWithLandedCost.map((item) => {
                const cartItem = cart.find(c => c.productId === item.productId);
                return (
                  <tr key={item.productId} className={`hover:${t.bgHover}`}>
                    <td className={`px-4 py-3 font-medium ${t.text}`}>
                      <div>{item.productName}</div>
                      {cartItem?.dimensions && cartItem.dimensions !== '-' && cartItem.dimensions.trim() !== '' && (
                        <span className={`text-xs ${t.textMuted}`}>({cartItem.dimensions})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          className={`w-16 ${t.bg} border ${t.border} rounded px-2 py-1 text-right font-mono ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none text-sm`}
                          value={item.quantity}
                          onChange={(e) => updateCartItemQty(item.productId, Number(e.target.value))}
                          min={1}
                        />
                        <span className={`text-xs ${t.textMuted}`}>{item.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className={`text-xs ${t.textMuted}`}>$</span>
                        <input
                          type="number"
                          className={`w-20 ${t.bg} border ${t.border} rounded px-2 py-1 text-right font-mono ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none text-sm`}
                          value={item.invoicePrice}
                          onChange={(e) => updateCartItemPrice(item.productId, Number(e.target.value))}
                          step={0.01}
                          min={0}
                        />
                      </div>
                    </td>
                    {procurementType === 'import' && (
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 bg-amber-500/5">
                        ${item.landedCost.toFixed(2)}
                      </td>
                    )}
                    <td className={`px-4 py-3 text-right font-mono ${t.text}`}>
                      ${item.totalLineCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeItem(item.productId)}
                        className={`${t.textMuted} hover:text-red-400 transition-colors`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={procurementType === 'import' ? 6 : 5} className={`px-6 py-12 text-center ${t.textMuted}`}>
                    Список пуст. Добавьте товары слева.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className={`${t.bg} p-6 border-t ${t.border}`}>
          <div className="grid grid-cols-3 gap-8 mb-6">
            <div>
              <p className={`text-xs ${t.textMuted} uppercase`}>Сумма закупки</p>
              <p className={`text-xl font-mono font-bold ${t.text}`}>
                ${totals.totalInvoiceValue.toFixed(2)}
              </p>
            </div>
            {procurementType === 'import' && (
              <div>
                <p className={`text-xs ${t.textMuted} uppercase`}>Накладные расходы</p>
                <p className="text-xl font-mono font-bold text-amber-400">
                  +${totals.totalOverheads.toFixed(2)}
                </p>
              </div>
            )}
            <div>
              <p className={`text-xs ${t.textMuted} uppercase`}>Итого Себестоимость</p>
              <p className={`text-2xl font-mono font-bold ${t.text} border-b-2 border-primary-500 inline-block`}>
                ${totals.totalLandedValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Payment Info */}
          {paymentMethod !== 'debt' && (
            <div className={`mb-4 p-3 ${t.bgCard} border ${t.border} rounded-lg`}>
              <p className={`text-xs ${t.textMuted} mb-1`}>Оплата будет списана:</p>
              <p className={`text-sm font-mono ${t.text}`}>
                {paymentMethod === 'cash' ? '💵 Касса' : '🏦 Расчетный счет'} -{' '}
                {paymentCurrency === 'USD'
                  ? `$${totals.totalInvoiceValue.toFixed(2)}`
                  : `${(totals.totalInvoiceValue * settings.defaultExchangeRate).toLocaleString()} сўм`}
              </p>
            </div>
          )}

          {paymentMethod === 'debt' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400 mb-1">⚠️ Закупка будет оформлена в долг</p>
              <p className="text-sm font-mono text-red-300">Долг: ${totals.totalInvoiceValue.toFixed(2)} USD</p>
            </div>
          )}

          <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <p className={`text-xs ${t.textMuted}`}>
              При проведении документа остатки товаров увеличатся, а их учетная цена (Cost Price) будет
              пересчитана по методу <strong>средневзвешенной</strong> стоимости.
            </p>
          </div>

          <button
            onClick={handleComplete}
            disabled={cart.length === 0 || !supplierName}
            className={`w-full bg-primary-600 hover:bg-primary-500 disabled:${t.bgCard} disabled:${t.textMuted} disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-600/20`}
          >
            <Save size={22} /> Провести закупку
          </button>
        </div>
      </div>
    </div>
  );
};








