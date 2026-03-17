import React, { useState, useEffect, useMemo } from 'react';
import { X, Wallet, CreditCard, Building, Banknote, DollarSign, AlertCircle, Calendar, Zap, CheckCircle, Check } from 'lucide-react';
import { Transaction } from '../../types';

export interface PaymentDistribution {
  cashUSD: number;
  cashUZS: number;
  cardUZS: number;
  bankUZS: number;
  isPaid: boolean;
  remainingUSD: number;
  linkedBankTransferId?: string;
}

export type QuickPaymentMethod = 'cash_uzs' | 'cash_usd' | 'card' | 'bank' | 'debt' | 'mixed';

interface PostSalePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmountUSD: number;
  totalAmountUZS: number;
  exchangeRate: number;
  onConfirm: (distribution: PaymentDistribution, method: string, debtDueDate?: string) => void;
  bankTransfers?: Transaction[];
}

export const PostSalePaymentModal: React.FC<PostSalePaymentModalProps> = ({
  isOpen, onClose, totalAmountUSD, totalAmountUZS, exchangeRate, onConfirm, bankTransfers
}) => {
  const [selectedMethod, setSelectedMethod] = useState<QuickPaymentMethod | null>(null);
  const [cashUSD, setCashUSD] = useState('');
  const [cashUZS, setCashUZS] = useState('');
  const [cardUZS, setCardUZS] = useState('');
  const [bankUZS, setBankUZS] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [selectedBankTransferId, setSelectedBankTransferId] = useState('');

  // Available unallocated bank transfers
  const availableBankTransfers = useMemo(() => {
    if (!bankTransfers) return [];
    return bankTransfers.filter(tx => !tx.orderId && tx.method === 'bank' && tx.type === 'client_payment');
  }, [bankTransfers]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMethod(null);
      setCashUSD(''); setCashUZS(''); setCardUZS(''); setBankUZS('');
      setDebtDueDate('');
      setSelectedBankTransferId('');
    }
  }, [isOpen, totalAmountUSD]);

  if (!isOpen) return null;

  const val = (s: string) => parseFloat(s) || 0;

  // For mixed mode calculations
  const vCashUSD = val(cashUSD);
  const vCashUZS = val(cashUZS);
  const vCardUZS = val(cardUZS);
  const vBankUZS = val(bankUZS);

  const totalPaidUSD = vCashUSD + (vCashUZS / exchangeRate) + (vCardUZS / exchangeRate) + (vBankUZS / exchangeRate);
  const remainingUSD = Math.max(0, totalAmountUSD - totalPaidUSD);
  const isPaid = remainingUSD < 0.05;

  const autoFill = (setter: (s: string) => void, currentVal: number) => {
    const othersUSD = totalPaidUSD - (currentVal / (setter === setCashUSD ? 1 : exchangeRate));
    const neededUSD = Math.max(0, totalAmountUSD - othersUSD);
    if (setter === setCashUSD) {
      setter(neededUSD.toFixed(2));
    } else {
      setter(Math.round(neededUSD * exchangeRate).toString());
    }
  };

  const handleQuickPay = (method: QuickPaymentMethod) => {
    if (method === 'mixed') {
      setSelectedMethod('mixed');
      return;
    }

    // If bank and there are available transfers, show selection
    if (method === 'bank' && availableBankTransfers.length > 0) {
      setSelectedMethod('bank');
      return;
    }

    let dist: PaymentDistribution = {
      cashUSD: 0, cashUZS: 0, cardUZS: 0, bankUZS: 0,
      isPaid: method !== 'debt', remainingUSD: method === 'debt' ? totalAmountUSD : 0
    };

    switch (method) {
      case 'cash_uzs': dist.cashUZS = totalAmountUZS; break;
      case 'cash_usd': dist.cashUSD = totalAmountUSD; break;
      case 'card': dist.cardUZS = totalAmountUZS; break;
      case 'bank': dist.bankUZS = totalAmountUZS; break;
      case 'debt': break; // Everything stays 0, remaining is total
    }

    const paymentMethodMap: Record<QuickPaymentMethod, string> = {
      'cash_uzs': 'cash', 'cash_usd': 'cash', 'card': 'card', 'bank': 'bank', 'debt': 'debt', 'mixed': 'mixed'
    };

    onConfirm(dist, paymentMethodMap[method], method === 'debt' ? debtDueDate : undefined);
    onClose();
  };

  const handleBankConfirm = () => {
    const dist: PaymentDistribution = {
      cashUSD: 0, cashUZS: 0, cardUZS: 0, bankUZS: totalAmountUZS,
      isPaid: true, remainingUSD: 0,
      linkedBankTransferId: selectedBankTransferId || undefined
    };
    onConfirm(dist, 'bank');
    onClose();
  };

  const handleMixedConfirm = () => {
    onConfirm(
      { cashUSD: vCashUSD, cashUZS: vCashUZS, cardUZS: vCardUZS, bankUZS: vBankUZS, isPaid, remainingUSD },
      'mixed',
      !isPaid ? debtDueDate : undefined
    );
    onClose();
  };

  const quickMethods: { method: QuickPaymentMethod; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
    { method: 'cash_uzs', label: 'Наличные (сўм)', icon: <Banknote size={22} />, color: 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400', desc: totalAmountUZS.toLocaleString() + ' сўм' },
    { method: 'cash_usd', label: 'Наличные ($)', icon: <DollarSign size={22} />, color: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400', desc: '$' + totalAmountUSD.toFixed(2) },
    { method: 'card', label: 'Терминал / Карта', icon: <CreditCard size={22} />, color: 'from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400', desc: totalAmountUZS.toLocaleString() + ' сўм' },
    { method: 'bank', label: 'Перечисление', icon: <Building size={22} />, color: 'from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400', desc: totalAmountUZS.toLocaleString() + ' сўм' },
    { method: 'debt', label: 'В долг', icon: <AlertCircle size={22} />, color: 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400', desc: '$' + totalAmountUSD.toFixed(2) },
    { method: 'mixed', label: 'Смешанная оплата', icon: <Zap size={22} />, color: 'from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400', desc: 'Разделить платёж' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="text-emerald-400" size={20} />
              {selectedMethod === 'mixed' ? 'Смешанная оплата' : selectedMethod === 'bank' ? 'Перечисление' : 'Способ оплаты'}
            </h3>
            <div className="flex gap-4 mt-1">
              <span className="text-xs text-slate-400">К оплате: <span className="text-white font-bold font-mono">${totalAmountUSD.toFixed(2)}</span></span>
              <span className="text-xs text-slate-400">= <span className="text-emerald-400 font-bold font-mono">{totalAmountUZS.toLocaleString()} сўм</span></span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* Quick Payment Buttons */}
          {!selectedMethod && (
            <div className="space-y-4">
              {/* Debt due date (shown when debt is selected) */}
              <div className="grid grid-cols-2 gap-3">
                {quickMethods.map(({ method, label, icon, color, desc }) => (
                  <button
                    key={method}
                    onClick={() => method === 'debt' ? setSelectedMethod('debt') : handleQuickPay(method)}
                    className={`bg-gradient-to-r ${color} text-white rounded-xl p-4 flex flex-col items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] ${method === 'mixed' ? 'col-span-2' : ''}`}
                  >
                    {icon}
                    <span className="font-bold text-sm">{label}</span>
                    <span className="text-xs opacity-80 font-mono">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Debt Mode - Date Picker */}
          {selectedMethod === 'debt' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <AlertCircle className="text-red-400 mx-auto mb-2" size={32} />
                <div className="text-lg font-bold text-white font-mono">${totalAmountUSD.toFixed(2)}</div>
                <div className="text-xs text-red-400 mt-1">Вся сумма будет записана в долг</div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Calendar size={16} className="text-red-400" />
                  Срок оплаты (необязательно)
                </label>
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setSelectedMethod(null)}
                  className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Назад
                </button>
                <button
                  onClick={() => handleQuickPay('debt')}
                  className="py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/20"
                >
                  Оформить в долг
                </button>
              </div>
            </div>
          )}

          {/* Bank Transfer Selection Mode */}
          {selectedMethod === 'bank' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <Building className="text-amber-400 mx-auto mb-2" size={32} />
                <div className="text-lg font-bold text-white font-mono">{totalAmountUZS.toLocaleString()} сўм</div>
                <div className="text-xs text-amber-400 mt-1">Оплата перечислением</div>
              </div>

              {availableBankTransfers.length > 0 && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Check size={16} className="text-amber-400" />
                    Привязать к тушган пулга (необязательно)
                  </label>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
                    <button
                      onClick={() => setSelectedBankTransferId('')}
                      className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${
                        !selectedBankTransferId
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      Новое перечисление (не привязывать)
                    </button>
                    {availableBankTransfers.map(tx => {
                      const txRate = tx.exchangeRate || exchangeRate;
                      const amountUZS = tx.currency === 'UZS' ? tx.amount : tx.amount * txRate;
                      return (
                        <button
                          key={tx.id}
                          onClick={() => setSelectedBankTransferId(tx.id)}
                          className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${
                            selectedBankTransferId === tx.id
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="truncate">{tx.description}</span>
                            <span className="font-mono font-bold ml-2">{amountUZS.toLocaleString()} сўм</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(tx.date).toLocaleDateString('ru-RU')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setSelectedMethod(null)}
                  className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Назад
                </button>
                <button
                  onClick={handleBankConfirm}
                  className="py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-600/20"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          )}

          {/* Mixed Payment Mode */}
          {selectedMethod === 'mixed' && (
            <div className="space-y-4 animate-fade-in">
              {/* Inputs */}
              <div className="space-y-3">
                {/* Cash USD */}
                <div className="bg-slate-700/50 p-2.5 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-300 flex items-center gap-1"><DollarSign size={12} className="text-emerald-400" /> Наличные (USD)</label>
                    <button onClick={() => autoFill(setCashUSD, vCashUSD)} className="text-[10px] bg-slate-600 px-1.5 rounded text-emerald-300 hover:bg-slate-500">MAX</button>
                  </div>
                  <input type="number" value={cashUSD} onChange={e => setCashUSD(e.target.value)}
                    className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0.00" />
                </div>

                {/* Cash UZS */}
                <div className="bg-slate-700/50 p-2.5 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-300 flex items-center gap-1"><Banknote size={12} className="text-blue-400" /> Наличные (UZS)</label>
                    <button onClick={() => autoFill(setCashUZS, vCashUZS)} className="text-[10px] bg-slate-600 px-1.5 rounded text-blue-300 hover:bg-slate-500">MAX</button>
                  </div>
                  <input type="number" value={cashUZS} onChange={e => setCashUZS(e.target.value)}
                    className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0" />
                </div>

                {/* Card UZS */}
                <div className="bg-slate-700/50 p-2.5 rounded-lg border border-slate-600 focus-within:border-purple-500 transition-colors">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-300 flex items-center gap-1"><CreditCard size={12} className="text-purple-400" /> Терминал / Карта (UZS)</label>
                    <button onClick={() => autoFill(setCardUZS, vCardUZS)} className="text-[10px] bg-slate-600 px-1.5 rounded text-purple-300 hover:bg-slate-500">MAX</button>
                  </div>
                  <input type="number" value={cardUZS} onChange={e => setCardUZS(e.target.value)}
                    className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0" />
                </div>

                {/* Bank UZS */}
                <div className="bg-slate-700/50 p-2.5 rounded-lg border border-slate-600 focus-within:border-amber-500 transition-colors">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-300 flex items-center gap-1"><Building size={12} className="text-amber-400" /> Перечисление (UZS)</label>
                    <button onClick={() => autoFill(setBankUZS, vBankUZS)} className="text-[10px] bg-slate-600 px-1.5 rounded text-amber-300 hover:bg-slate-500">MAX</button>
                  </div>
                  <input type="number" value={bankUZS} onChange={e => setBankUZS(e.target.value)}
                    className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0" />
                </div>
              </div>

              {/* Remaining indicator */}
              <div className={`p-3 rounded-xl border flex justify-between items-center ${isPaid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <span className={`text-sm font-medium ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPaid ? 'Оплачено полностью' : 'Остаток (в долг):'}
                </span>
                <span className={`text-lg font-bold font-mono ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {remainingUSD > 0.01 ? `$${remainingUSD.toFixed(2)}` : <CheckCircle size={20} />}
                </span>
              </div>

              {/* Date for remaining debt */}
              {!isPaid && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <Calendar size={14} className="text-red-400" />
                    Срок оплаты остатка
                  </label>
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setSelectedMethod(null)}
                  className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Назад
                </button>
                <button
                  onClick={handleMixedConfirm}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
