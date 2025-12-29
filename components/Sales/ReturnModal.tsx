import React, { useState } from 'react';
import { RefreshCw, Package, Banknote } from 'lucide-react';
import { Product, Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

type ReturnType = 'product' | 'money';
type PaymentMethod = 'cash' | 'bank' | 'card';
type Currency = 'USD' | 'UZS';

interface ReturnModalProps {
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
  onClose: () => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
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
  onClose
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${t.bgCard} rounded-2xl w-full max-w-lg border ${t.border} shadow-2xl animate-scale-in`}>
        <div className={`p-6 border-b ${t.border} flex justify-between items-center`}>
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <RefreshCw className="text-amber-500" /> Возврат
          </h3>
          <button onClick={onClose} className={`${t.textMuted} hover:${t.text} text-2xl`}>&times;</button>
        </div>

        {/* Return Type Tabs */}
        <div className={`flex border-b ${t.border}`}>
          <button
            onClick={() => setReturnType('product')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              returnType === 'product' 
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500' 
                : `${t.textMuted} hover:${t.text}`
            }`}
          >
            <Package size={18} /> Возврат товара
          </button>
          <button
            onClick={() => setReturnType('money')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              returnType === 'money' 
                ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500' 
                : `${t.textMuted} hover:${t.text}`
            }`}
          >
            <Banknote size={18} /> Возврат денег
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Client Selection (common) */}
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Клиент *</label>
            <input
              type="text"
              placeholder="Выберите клиента..."
              className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none`}
              value={returnClientName}
              onChange={e => setReturnClientName(e.target.value)}
              list="return-clients-list"
            />
            <datalist id="return-clients-list">
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
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none`}
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
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Метод возврата</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReturnMethod('cash')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${returnMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
                  >
                    Вернуть деньги (Нал)
                  </button>
                  <button
                    onClick={() => setReturnMethod('debt')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${returnMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
                  >
                    Списать с долга
                  </button>
                </div>
              </div>

              <button
                onClick={onSubmit}
                className={`w-full ${theme === 'light' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-600 hover:bg-amber-500'} text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-amber-600/20 transition-all mt-4`}
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
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none`}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Способ возврата</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setMoneyMethod('cash')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${moneyMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
                  >
                    Наличные
                  </button>
                  <button
                    onClick={() => setMoneyMethod('bank')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${moneyMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
                  >
                    Р/С (Банк)
                  </button>
                  <button
                    onClick={() => setMoneyMethod('card')}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${moneyMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
                  >
                    Карта
                  </button>
                </div>
              </div>

              {/* Currency for cash only */}
              {moneyMethod === 'cash' && (
                <div>
                  <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Валюта</label>
                  <div className={`flex ${t.bgInput} rounded-xl p-1 border ${t.borderInput}`}>
                    <button
                      onClick={() => setMoneyCurrency('UZS')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${moneyCurrency === 'UZS' ? (theme === 'light' ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white') : `${t.textMuted} hover:${t.text}`}`}
                    >
                      Сум (UZS)
                    </button>
                    <button
                      onClick={() => setMoneyCurrency('USD')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${moneyCurrency === 'USD' ? (theme === 'light' ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white') : `${t.textMuted} hover:${t.text}`}`}
                    >
                      Доллар (USD)
                    </button>
                  </div>
                </div>
              )}

              {moneyMethod !== 'cash' && (
                <div className={`${t.bgPanelAlt} p-2 rounded-lg border ${t.border}`}>
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
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-emerald-500 outline-none`}
                  placeholder="Например: Ошибочный платёж"
                />
              </div>

              <button
                onClick={handleMoneyReturn}
                disabled={!returnClientName || !moneyAmount || Number(moneyAmount) <= 0}
                className={`w-full ${theme === 'light' ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500'} text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 transition-all mt-4`}
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

