import React, { useState, useEffect } from 'react';
import { X, Plus, DollarSign, Wallet, CreditCard, Building, Banknote } from 'lucide-react';

interface PaymentSplitModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmountUSD: number;
    totalAmountUZS: number;
    exchangeRate: number;
    onConfirm: (distribution: PaymentDistribution) => void;
}

export interface PaymentDistribution {
    cashUSD: number;
    cashUZS: number;
    cardUZS: number;
    bankUZS: number;
    isPaid: boolean; // Fully paid?
    remainingUSD: number;
}

export const PaymentSplitModal: React.FC<PaymentSplitModalProps> = ({
    isOpen, onClose, totalAmountUSD, totalAmountUZS, exchangeRate, onConfirm
}) => {
    const [cashUSD, setCashUSD] = useState('');
    const [cashUZS, setCashUZS] = useState('');
    const [cardUZS, setCardUZS] = useState('');
    const [bankUZS, setBankUZS] = useState('');

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setCashUSD(''); setCashUZS(''); setCardUZS(''); setBankUZS('');
        }
    }, [isOpen, totalAmountUSD]);

    if (!isOpen) return null;

    // Calculations
    const val = (s: string) => parseFloat(s) || 0;

    const vCashUSD = val(cashUSD);
    const vCashUZS = val(cashUZS);
    const vCardUZS = val(cardUZS);
    const vBankUZS = val(bankUZS);

    // Convert everything to USD to check saturation
    const totalPaidUSD = vCashUSD + (vCashUZS / exchangeRate) + (vCardUZS / exchangeRate) + (vBankUZS / exchangeRate);
    const remainingUSD = Math.max(0, totalAmountUSD - totalPaidUSD);
    const isPaid = remainingUSD < 0.05; // Tolerance

    const remainingUZS = remainingUSD * exchangeRate;

    const handleConfirm = () => {
        onConfirm({
            cashUSD: vCashUSD,
            cashUZS: vCashUZS,
            cardUZS: vCardUZS,
            bankUZS: vBankUZS,
            isPaid,
            remainingUSD
        });
        onClose();
    };

    const autoFill = (setter: (s: string) => void, currentVal: number) => {
        // Fill the remaining amount into this field
        // We know total needed is totalAmountUSD.
        // Already paid by OTHERS?
        const othersUSD = totalPaidUSD - (currentVal / (setter === setCashUSD ? 1 : exchangeRate));
        const neededUSD = Math.max(0, totalAmountUSD - othersUSD);

        if (setter === setCashUSD) {
            setter(neededUSD.toFixed(2));
        } else {
            setter(Math.round(neededUSD * exchangeRate).toString());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Wallet className="text-emerald-400" size={20} /> Смешанная оплата
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="flex justify-between items-end mb-4 bg-slate-700/30 p-3 rounded-xl border border-slate-700">
                        <div>
                            <div className="text-xs text-slate-400 font-medium uppercase">К оплате</div>
                            <div className="text-xl font-bold text-white font-mono">${totalAmountUSD.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-400 font-medium uppercase">В сумах</div>
                            <div className="text-lg font-bold text-emerald-400 font-mono">{Math.round(totalAmountUZS).toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">

                        {/* Cash USD */}
                        <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-slate-300 flex items-center gap-1"><DollarSign size={12} className="text-emerald-400" /> Наличные (USD)</label>
                                <button onClick={() => autoFill(setCashUSD, vCashUSD)} className="text-[10px] bg-slate-600 px-1.5 rounded text-emerald-300 hover:bg-slate-500">MAX</button>
                            </div>
                            <input type="number" value={cashUSD} onChange={e => setCashUSD(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0.00" />
                        </div>

                        {/* Cash UZS */}
                        <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-slate-300 flex items-center gap-1"><Banknote size={12} className="text-blue-400" /> Наличные (UZS)</label>
                                <button onClick={() => autoFill(setCashUZS, vCashUZS)} className="text-[10px] bg-slate-600 px-1.5 rounded text-blue-300 hover:bg-slate-500">MAX</button>
                            </div>
                            <input type="number" value={cashUZS} onChange={e => setCashUZS(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0" />
                        </div>

                        {/* Card UZS */}
                        <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-slate-300 flex items-center gap-1"><CreditCard size={12} className="text-purple-400" /> Терминал / Карта (UZS)</label>
                                <button onClick={() => autoFill(setCardUZS, vCardUZS)} className="text-[10px] bg-slate-600 px-1.5 rounded text-purple-300 hover:bg-slate-500">MAX</button>
                            </div>
                            <input type="number" value={cardUZS} onChange={e => setCardUZS(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0" />
                        </div>

                        {/* Bank UZS */}
                        <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-slate-300 flex items-center gap-1"><Building size={12} className="text-amber-400" /> Перечисление (UZS)</label>
                                <button onClick={() => autoFill(setBankUZS, vBankUZS)} className="text-[10px] bg-slate-600 px-1.5 rounded text-amber-300 hover:bg-slate-500">MAX</button>
                            </div>
                            <input type="number" value={bankUZS} onChange={e => setBankUZS(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-white font-mono text-lg focus:ring-0 placeholder-slate-600" placeholder="0" />
                        </div>

                    </div>

                    {/* Remaining */}
                    <div className={`mt-4 p-3 rounded-xl border flex justify-between items-center ${isPaid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <span className={`text-sm font-medium ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPaid ? 'Оплачено полностью' : 'Остаток (в долг):'}
                        </span>
                        <span className={`text-lg font-bold font-mono ${isPaid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {remainingUSD > 0.01 ? `$${remainingUSD.toFixed(2)}` : 'OK'}
                        </span>
                    </div>

                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-900/50 grid grid-cols-2 gap-3">
                    <button onClick={onClose} className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all text-sm">
                        Отмена
                    </button>
                    <button onClick={handleConfirm} className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-emerald-600/20">
                        Подтвердить оплату
                    </button>
                </div>
            </div>
        </div>
    );
};
