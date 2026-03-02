import React from 'react';
import { Purchase, AppSettings } from '../../types';
import { Plus, DollarSign, Wallet, CreditCard, Building2, Banknote } from 'lucide-react';
import type { Balances } from './types';

interface RepaymentModalProps {
  isOpen: boolean;
  purchase: Purchase;
  repaymentAmount: number;
  setRepaymentAmount: (v: number) => void;
  repaymentMethod: 'cash' | 'bank' | 'card' | 'debt' | 'mixed';
  setRepaymentMethod: (v: 'cash' | 'bank' | 'card' | 'debt' | 'mixed') => void;
  repaymentCurrency: 'USD' | 'UZS';
  setRepaymentCurrency: (v: 'USD' | 'UZS') => void;
  balances?: Balances;
  settings: AppSettings;
  t: Record<string, string>;
  onClose: () => void;
  onConfirm: () => void;
  onOpenMixed: () => void;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = React.memo(({
  isOpen, purchase, repaymentAmount, setRepaymentAmount,
  repaymentMethod, setRepaymentMethod, repaymentCurrency, setRepaymentCurrency,
  balances, settings, t, onClose, onConfirm, onOpenMixed
}) => {
  if (!isOpen) return null;

  const isLegacy = purchase.totalInvoiceAmountUZS === undefined || purchase.totalInvoiceAmountUZS === 0;
  let purchasePaidUSD = purchase.amountPaidUSD;
  if (isLegacy && (purchasePaidUSD === undefined || purchasePaidUSD === null)) {
    purchasePaidUSD = purchase.amountPaid || 0;
  } else {
    purchasePaidUSD = purchasePaidUSD ?? 0;
  }
  const debtUSD = Math.max(0, purchase.totalInvoiceAmount - purchasePaidUSD);

  const recalcAmount = (currency: 'USD' | 'UZS') => {
    if (currency === 'USD') {
      setRepaymentAmount(debtUSD);
    } else {
      setRepaymentAmount(Math.round(debtUSD * settings.defaultExchangeRate));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${t.bgCard} rounded-2xl w-full max-w-sm border ${t.border} shadow-2xl animate-scale-in`}>
        <div className={`p-6 border-b ${t.border} flex justify-between items-center`}>
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <Wallet className="text-emerald-500" /> Оплата поставщику
          </h3>
          <button onClick={onClose} className={`${t.textMuted} hover:${t.text}`}>
            <Plus size={24} className="rotate-45" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className={`${t.bg} p-4 rounded-xl border ${t.border}`}>
            <p className={`text-sm ${t.textMuted} mb-1`}>Поставщик</p>
            <p className={`text-lg font-bold ${t.text}`}>{purchase.supplierName}</p>
            <div className="mt-3 flex justify-between items-end">
              <span className={`text-sm ${t.textMuted}`}>Остаток долга:</span>
              <span className="text-xl font-mono font-bold text-red-400">
                ${debtUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {balances && (
            <div className={`${t.bg} p-3 rounded-xl border ${t.border}`}>
              <p className={`text-xs font-medium ${t.textMuted} mb-2`}>Доступно в кассах:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className={t.textMuted}>Нал USD:</span>
                  <span className="text-emerald-400 font-mono">${balances.cashUSD.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className={t.textMuted}>Нал сум:</span>
                  <span className="text-blue-400 font-mono">{balances.cashUZS.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className={t.textMuted}>Карта:</span>
                  <span className="text-purple-400 font-mono">{balances.cardUZS.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className={t.textMuted}>Р/С:</span>
                  <span className="text-amber-400 font-mono">{balances.bankUZS.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className={`text-sm font-medium ${t.textMuted}`}>Способ оплаты</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setRepaymentMethod('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'cash'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                  : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
              >
                <Banknote size={20} /><span className="text-xs font-bold">Нал</span>
              </button>
              <button
                onClick={() => { setRepaymentMethod('card'); setRepaymentCurrency('UZS'); }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'card'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                  : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
              >
                <CreditCard size={20} /><span className="text-xs font-bold">Карта</span>
              </button>
              <button
                onClick={() => { setRepaymentMethod('bank'); setRepaymentCurrency('UZS'); }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'bank'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
              >
                <Building2 size={20} /><span className="text-xs font-bold">Р/С</span>
              </button>
              <button
                onClick={onOpenMixed}
                className="p-3 rounded-xl border flex flex-col items-center gap-2 transition-all bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/50 text-purple-400 hover:border-purple-400"
              >
                <Wallet size={20} /><span className="text-xs font-bold">Микс</span>
              </button>
            </div>
          </div>

          {/* Currency Selector */}
          <div className="space-y-2">
            <label className={`text-sm font-medium ${t.textMuted}`}>Валюта</label>
            <div className={`flex ${t.bg} rounded-lg p-1 border ${t.border}`}>
              {repaymentMethod === 'cash' ? (
                <>
                  <button
                    onClick={() => { setRepaymentCurrency('USD'); recalcAmount('USD'); }}
                    className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${repaymentCurrency === 'USD' ? `${t.bgCard} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`}`}
                  >
                    USD ($)
                  </button>
                  <button
                    onClick={() => { setRepaymentCurrency('UZS'); recalcAmount('UZS'); }}
                    className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${repaymentCurrency === 'UZS' ? `${t.bgCard} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`}`}
                  >
                    UZS (сум)
                  </button>
                </>
              ) : (
                <button className={`flex-1 py-1.5 rounded-md text-sm font-bold ${t.bgCard} ${t.text} shadow cursor-not-allowed opacity-50`} disabled>
                  UZS (сум) — Только сумы
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className={`text-sm font-medium ${t.textMuted}`}>Сумма оплаты ({repaymentCurrency})</label>
              {repaymentCurrency === 'UZS' && (
                <span className={`text-xs ${t.textMuted} self-center`}>Курс: {settings.defaultExchangeRate.toLocaleString()}</span>
              )}
            </div>
            <div className="relative">
              {repaymentCurrency === 'USD' ? (
                <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
              ) : (
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted} font-bold text-xs`}>UZS</span>
              )}
              <input
                type="number"
                className={`w-full ${t.bg} border ${t.border} rounded-lg pl-12 pr-4 py-3 ${t.text} text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none`}
                value={repaymentAmount || ''}
                onChange={e => setRepaymentAmount(Number(e.target.value))}
                max={purchase.totalInvoiceAmount - (purchase.amountPaidUSD ?? purchase.amountPaid ?? 0)}
              />
            </div>
            {repaymentCurrency === 'UZS' && repaymentAmount > 0 && (
              <p className="text-xs text-right text-emerald-400">
                ≈ ${(repaymentAmount / settings.defaultExchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
              </p>
            )}
          </div>

          <button
            onClick={onConfirm}
            disabled={repaymentAmount <= 0}
            className={`w-full bg-emerald-600 hover:bg-emerald-500 disabled:${t.bgHover} disabled:${t.textMuted} text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20`}
          >
            Подтвердить оплату
          </button>
        </div>
      </div>
    </div>
  );
});

RepaymentModal.displayName = 'RepaymentModal';
