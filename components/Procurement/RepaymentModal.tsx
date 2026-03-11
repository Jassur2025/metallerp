import React from 'react';
import { Purchase, AppSettings } from '../../types';
import { X, DollarSign, Wallet, CreditCard, Building2, Banknote, CheckCircle2, ArrowRight } from 'lucide-react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
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

  const { theme } = useTheme();
  const tc = getThemeClasses(theme);
  const isDark = theme !== 'light';

  const isLegacy = purchase.totalInvoiceAmountUZS === undefined || purchase.totalInvoiceAmountUZS === 0;
  let purchasePaidUSD = purchase.amountPaidUSD;
  if (isLegacy && (purchasePaidUSD === undefined || purchasePaidUSD === null)) {
    purchasePaidUSD = purchase.amountPaid || 0;
  } else {
    purchasePaidUSD = purchasePaidUSD ?? 0;
  }
  const debtUSD = Math.max(0, purchase.totalInvoiceAmount - purchasePaidUSD);
  const paidPercent = purchase.totalInvoiceAmount > 0 ? Math.round((purchasePaidUSD / purchase.totalInvoiceAmount) * 100) : 0;

  const recalcAmount = (currency: 'USD' | 'UZS') => {
    if (currency === 'USD') {
      setRepaymentAmount(debtUSD);
    } else {
      setRepaymentAmount(Math.round(debtUSD * settings.defaultExchangeRate));
    }
  };

  const paymentMethods = [
    { key: 'cash' as const, label: 'Нал', icon: Banknote, activeColor: 'from-emerald-500 to-teal-500', activeBg: 'bg-emerald-500/10', activeBorder: 'border-emerald-500/50' },
    { key: 'card' as const, label: 'Карта', icon: CreditCard, activeColor: 'from-indigo-500 to-purple-500', activeBg: 'bg-indigo-500/10', activeBorder: 'border-indigo-500/50' },
    { key: 'bank' as const, label: 'Р/С', icon: Building2, activeColor: 'from-blue-500 to-cyan-500', activeBg: 'bg-blue-500/10', activeBorder: 'border-blue-500/50' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${isDark ? 'bg-slate-900' : 'bg-white'} rounded-2xl w-full max-w-md border ${t.border} shadow-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`p-5 border-b ${t.border} flex justify-between items-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
              <Wallet size={18} className="text-white" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${t.text}`}>Оплата поставщику</h3>
              <p className={`text-xs ${t.textMuted}`}>{purchase.supplierName}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} transition-colors`}>
            <X size={18} className={t.textMuted} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Debt Summary Card */}
          <div className={`${isDark ? 'bg-slate-800/50' : 'bg-slate-50'} p-4 rounded-xl border ${t.border}`}>
            <div className="flex justify-between items-center mb-3">
              <span className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Остаток долга</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${paidPercent >= 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {paidPercent}% оплачено
              </span>
            </div>
            <p className="text-2xl font-mono font-bold text-red-400">
              ${debtUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {/* Progress bar */}
            <div className={`mt-3 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} overflow-hidden`}>
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: `${Math.min(paidPercent, 100)}%` }} />
            </div>
          </div>

          {/* Balance Info */}
          {balances && (
            <div className={`${isDark ? 'bg-slate-800/30' : 'bg-slate-50/80'} p-3 rounded-xl border ${t.border}`}>
              <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-2`}>Доступно в кассах</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className={t.textMuted}>Нал USD</span>
                  <span className="text-emerald-400 font-mono font-medium">${balances.cashUSD.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={t.textMuted}>Нал сум</span>
                  <span className="text-blue-400 font-mono font-medium">{balances.cashUZS.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={t.textMuted}>Карта</span>
                  <span className="text-purple-400 font-mono font-medium">{balances.cardUZS.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={t.textMuted}>Р/С</span>
                  <span className="text-amber-400 font-mono font-medium">{balances.bankUZS.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Способ оплаты</label>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map(pm => {
                const isActive = repaymentMethod === pm.key;
                return (
                  <button
                    key={pm.key}
                    onClick={() => {
                      setRepaymentMethod(pm.key);
                      if (pm.key !== 'cash') setRepaymentCurrency('UZS');
                    }}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all duration-200 ${isActive
                      ? `${pm.activeBg} ${pm.activeBorder}`
                      : `border-transparent ${isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200'}`}`}
                  >
                    {isActive ? (
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${pm.activeColor}`}>
                        <pm.icon size={16} className="text-white" />
                      </div>
                    ) : (
                      <pm.icon size={20} className={t.textMuted} />
                    )}
                    <span className={`text-[10px] font-bold ${isActive ? t.text : t.textMuted}`}>{pm.label}</span>
                  </button>
                );
              })}
              <button
                onClick={onOpenMixed}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all duration-200 ${repaymentMethod === 'mixed'
                  ? 'bg-purple-500/10 border-purple-500/50'
                  : `border-transparent ${isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200'}`}`}
              >
                {repaymentMethod === 'mixed' ? (
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Wallet size={16} className="text-white" />
                  </div>
                ) : (
                  <Wallet size={20} className={t.textMuted} />
                )}
                <span className={`text-[10px] font-bold ${repaymentMethod === 'mixed' ? t.text : t.textMuted}`}>Микс</span>
              </button>
            </div>
          </div>

          {/* Currency Selector */}
          <div className="space-y-2">
            <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Валюта</label>
            <div className={`flex ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl p-1 gap-1`}>
              {repaymentMethod === 'cash' ? (
                <>
                  <button
                    onClick={() => { setRepaymentCurrency('USD'); recalcAmount('USD'); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${repaymentCurrency === 'USD'
                      ? `${isDark ? 'bg-slate-700' : 'bg-white'} ${t.text} shadow-sm`
                      : `${t.textMuted} hover:${t.text}`}`}
                  >
                    USD ($)
                  </button>
                  <button
                    onClick={() => { setRepaymentCurrency('UZS'); recalcAmount('UZS'); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${repaymentCurrency === 'UZS'
                      ? `${isDark ? 'bg-slate-700' : 'bg-white'} ${t.text} shadow-sm`
                      : `${t.textMuted} hover:${t.text}`}`}
                  >
                    UZS (сум)
                  </button>
                </>
              ) : (
                <div className={`flex-1 py-2 rounded-lg text-sm font-bold text-center ${t.textMuted} opacity-60`}>
                  UZS (сум) — Только сумы
                </div>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>Сумма оплаты ({repaymentCurrency})</label>
              {repaymentCurrency === 'UZS' && (
                <span className={`text-[10px] ${t.textMuted}`}>Курс: {settings.defaultExchangeRate.toLocaleString()}</span>
              )}
            </div>
            <div className="relative">
              {repaymentCurrency === 'USD' ? (
                <DollarSign className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
              ) : (
                <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textMuted} font-bold text-xs`}>UZS</span>
              )}
              <input
                type="number"
                className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'} border-2 rounded-xl pl-12 pr-4 py-3 text-lg font-mono focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all duration-200`}
                value={repaymentAmount || ''}
                onChange={e => setRepaymentAmount(Number(e.target.value))}
                max={purchase.totalInvoiceAmount - (purchase.amountPaidUSD ?? purchase.amountPaid ?? 0)}
              />
            </div>
            {repaymentCurrency === 'UZS' && repaymentAmount > 0 && (
              <p className="text-xs text-right text-emerald-400 font-medium">
                ≈ ${(repaymentAmount / settings.defaultExchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
              </p>
            )}
          </div>

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            disabled={repaymentAmount <= 0}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              repaymentAmount > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20'
                : `${isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} cursor-not-allowed`
            }`}
          >
            <CheckCircle2 size={18} /> Подтвердить оплату <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

RepaymentModal.displayName = 'RepaymentModal';
