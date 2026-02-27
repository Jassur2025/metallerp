import React, { useState } from 'react';
import { Purchase } from '../../types';
import { Plus, DollarSign, Wallet } from 'lucide-react';

interface ImportRepaymentModalProps {
    purchase: Purchase;
    onClose: () => void;
    onRepay: (amount: number) => void;
}

export const ImportRepaymentModal = React.memo<ImportRepaymentModalProps>(({
    purchase,
    onClose,
    onRepay,
}) => {
    const remainingDebt = purchase.totalInvoiceAmount - purchase.amountPaid;
    const [amount, setAmount] = useState<number>(remainingDebt);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl animate-scale-in">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wallet className="text-emerald-500" /> Оплата поставщику
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">Поставщик</p>
                        <p className="text-lg font-bold text-white">{purchase.supplierName}</p>
                        <div className="mt-3 flex justify-between items-end">
                            <span className="text-sm text-slate-500">Остаток долга:</span>
                            <span className="text-xl font-mono font-bold text-red-400">
                                ${remainingDebt.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Сумма оплаты ($)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={amount || ''}
                                onChange={e => setAmount(Number(e.target.value))}
                                max={remainingDebt}
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => onRepay(amount)}
                        disabled={amount <= 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
                    >
                        Подтвердить оплату
                    </button>
                </div>
            </div>
        </div>
    );
});

ImportRepaymentModal.displayName = 'ImportRepaymentModal';
