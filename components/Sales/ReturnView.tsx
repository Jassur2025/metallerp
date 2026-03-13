import React, { useState } from 'react';
import { RefreshCw, Package, Banknote } from 'lucide-react';
import { Product, Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

type ReturnType = 'product' | 'money';
type PaymentMethod = 'cash' | 'bank' | 'card';
type Currency = 'USD' | 'UZS';

interface ReturnViewProps {
  returnClientName: string;
  setReturnClientName: (val: string) => void;
  returnProductName: string;
  setReturnProductName: (val: string) => void;
  returnQuantity: string;
  setReturnQuantity: (val: string) => void;
  returnMethod: 'cash' | 'debt';
  setReturnMethod: (val: 'cash' | 'debt') => void;
  clients: Client[];
  products: Product[];
  onSubmit: () => void;
  onSubmitMoneyReturn?: (data: { clientName: string; amount: number; method: PaymentMethod; currency: Currency; reason: string }) => void;
}

export const ReturnView: React.FC<ReturnViewProps> = ({
  returnClientName,
  setReturnClientName,
  returnProductName,
  setReturnProductName,
  returnQuantity,
  setReturnQuantity,
  returnMethod,
  setReturnMethod,
  clients,
  products,
  onSubmit,
  onSubmitMoneyReturn,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';
  const [returnType, setReturnType] = useState<ReturnType>('product');

  // Money return states
  const [moneyAmount, setMoneyAmount] = useState('');
  const [moneyMethod, setMoneyMethod] = useState<PaymentMethod>('cash');
  const [moneyCurrency, setMoneyCurrency] = useState<Currency>('UZS');
  const [moneyReason, setMoneyReason] = useState('');

  const handleMoneyReturn = () => {
    if (!returnClientName || !moneyAmount || Number(moneyAmount) <= 0) return;
    onSubmitMoneyReturn?.({
      clientName: returnClientName,
      amount: Number(moneyAmount),
      method: moneyMethod,
      currency: moneyMethod === 'cash' ? moneyCurrency : 'UZS',
      reason: moneyReason || 'Возврат денежных средств'
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
      {/* Header */}
      <div className={`${isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200'} border rounded-2xl p-6 max-w-2xl`}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
            <RefreshCw size={20} className="text-amber-500" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${t.text}`}>Оформление возврата</h3>
            <p className={`text-sm ${t.textMuted}`}>Выберите тип возврата и заполните данные</p>
          </div>
        </div>

        {/* Return Type Tabs — sliding pill style */}
        <div className={`relative flex ${isDark ? 'bg-slate-900/50' : 'bg-slate-100'} p-1 rounded-xl mb-6`}>
          <div
            className={`absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-in-out z-0 ${isDark ? 'bg-slate-700 shadow-lg shadow-black/20' : 'bg-white shadow-md'}`}
            style={{ width: 'calc((100% - 8px) / 2)', left: returnType === 'product' ? '4px' : 'calc(4px + (100% - 8px) / 2)' }}
          />
          <button
            onClick={() => setReturnType('product')}
            className={`relative z-10 flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 ${
              returnType === 'product' ? (isDark ? 'text-amber-400' : 'text-amber-600') : `${t.textMuted}`
            }`}
          >
            <Package size={16} /> Возврат товара
          </button>
          <button
            onClick={() => setReturnType('money')}
            className={`relative z-10 flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 ${
              returnType === 'money' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : `${t.textMuted}`
            }`}
          >
            <Banknote size={16} /> Возврат денег
          </button>
        </div>

        <div className="space-y-4">
          {/* Client Selection (common) */}
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Клиент *</label>
            <input
              type="text"
              placeholder="Выберите клиента..."
              className={`w-full ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border rounded-xl px-4 py-2.5 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none transition-all`}
              value={returnClientName}
              onChange={e => setReturnClientName(e.target.value)}
              list="return-clients-list-inline"
            />
            <datalist id="return-clients-list-inline">
              {clients.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          {/* Product Return Form */}
          {returnType === 'product' && (
            <>
              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Товар (со склада) *</label>
                <select
                  className={`w-full ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border rounded-xl px-4 py-2.5 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none transition-all`}
                  value={returnProductName}
                  onChange={e => setReturnProductName(e.target.value)}
                >
                  <option value="">— Выберите товар —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.dimensions && p.dimensions !== '-' ? `(${p.dimensions})` : ''} — остаток: {p.quantity} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Количество *</label>
                <input
                  type="number"
                  value={returnQuantity}
                  onChange={e => setReturnQuantity(e.target.value)}
                  className={`w-full ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border rounded-xl px-4 py-2.5 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none transition-all`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Метод возврата</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReturnMethod('cash')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      returnMethod === 'cash'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500'
                        : (isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                    }`}
                  >
                    Вернуть деньги (Нал)
                  </button>
                  <button
                    onClick={() => setReturnMethod('debt')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      returnMethod === 'debt'
                        ? 'bg-red-500/15 border-red-500 text-red-500'
                        : (isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                    }`}
                  >
                    Списать с долга
                  </button>
                </div>
              </div>

              <button
                onClick={onSubmit}
                className={`w-full ${isDark ? 'bg-amber-600 hover:bg-amber-500' : 'bg-amber-500 hover:bg-amber-600'} text-white py-3 rounded-xl font-bold text-base shadow-lg shadow-amber-600/20 transition-all mt-2`}
              >
                Оформить Возврат товара
              </button>
            </>
          )}

          {/* Money Return Form */}
          {returnType === 'money' && (
            <>
              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Сумма возврата *</label>
                <input
                  type="number"
                  value={moneyAmount}
                  onChange={e => setMoneyAmount(e.target.value)}
                  className={`w-full ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border rounded-xl px-4 py-2.5 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Способ возврата</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setMoneyMethod('cash')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      moneyMethod === 'cash'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500'
                        : (isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                    }`}
                  >
                    Наличные
                  </button>
                  <button
                    onClick={() => setMoneyMethod('bank')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      moneyMethod === 'bank'
                        ? 'bg-purple-500/15 border-purple-500 text-purple-500'
                        : (isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                    }`}
                  >
                    Р/С (Банк)
                  </button>
                  <button
                    onClick={() => setMoneyMethod('card')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      moneyMethod === 'card'
                        ? 'bg-blue-500/15 border-blue-500 text-blue-500'
                        : (isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                    }`}
                  >
                    Карта
                  </button>
                </div>
              </div>

              {/* Currency for cash only */}
              {moneyMethod === 'cash' && (
                <div>
                  <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Валюта</label>
                  <div className={`relative flex ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-100 border-slate-200'} rounded-xl p-1 border`}>
                    <div
                      className={`absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-in-out z-0 ${isDark ? 'bg-slate-700 shadow-lg shadow-black/20' : 'bg-white shadow-md'}`}
                      style={{ width: 'calc((100% - 8px) / 2)', left: moneyCurrency === 'UZS' ? '4px' : 'calc(4px + (100% - 8px) / 2)' }}
                    />
                    <button
                      onClick={() => setMoneyCurrency('UZS')}
                      className={`relative z-10 flex-1 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${moneyCurrency === 'UZS' ? (isDark ? 'text-white' : 'text-slate-800') : `${t.textMuted}`}`}
                    >
                      Сум (UZS)
                    </button>
                    <button
                      onClick={() => setMoneyCurrency('USD')}
                      className={`relative z-10 flex-1 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${moneyCurrency === 'USD' ? (isDark ? 'text-white' : 'text-slate-800') : `${t.textMuted}`}`}
                    >
                      Доллар (USD)
                    </button>
                  </div>
                </div>
              )}

              {moneyMethod !== 'cash' && (
                <div className={`${isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'} p-3 rounded-xl border`}>
                  <p className={`text-xs ${t.textMuted}`}>
                    {moneyMethod === 'bank' ? 'Р/С (Банк)' : 'Карта'} — возврат только в сумах (UZS)
                  </p>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Причина возврата</label>
                <input
                  type="text"
                  value={moneyReason}
                  onChange={e => setMoneyReason(e.target.value)}
                  className={`w-full ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border rounded-xl px-4 py-2.5 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                  placeholder="Например: Ошибочный платёж"
                />
              </div>

              <button
                onClick={handleMoneyReturn}
                disabled={!returnClientName || !moneyAmount || Number(moneyAmount) <= 0}
                className={`w-full ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500' : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400'} text-white py-3 rounded-xl font-bold text-base shadow-lg shadow-emerald-600/20 transition-all mt-2`}
              >
                Вернуть деньги
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
