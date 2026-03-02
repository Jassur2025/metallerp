import React, { useState, useCallback } from 'react';
import { Purchase, Transaction } from '../../types';
import { History, Wallet, ChevronDown, ChevronUp } from 'lucide-react';

interface PurchaseHistoryTabProps {
    purchases: Purchase[];
    purchasesLoading: boolean;
    transactions: Transaction[];
    onOpenRepayModal: (purchase: Purchase) => void;
}

export const PurchaseHistoryTab = React.memo<PurchaseHistoryTabProps>(({
    purchases,
    purchasesLoading,
    transactions,
    onOpenRepayModal,
}) => {
    const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

    const toggleExpand = useCallback((purchaseId: string) => {
        setExpandedPurchases(prev => {
            const next = new Set(prev);
            if (next.has(purchaseId)) next.delete(purchaseId);
            else next.add(purchaseId);
            return next;
        });
    }, []);

    const getPurchaseTransactions = useCallback((purchaseId: string) => {
        return transactions.filter(t => t.relatedId === purchaseId);
    }, [transactions]);

    return (
        <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <History size={18} className="text-slate-400" /> История закупок и Долги
                    {purchasesLoading && <span className="text-xs text-primary-400">(загрузка...)</span>}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        Показано: {purchases.length}
                    </span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-xs uppercase text-slate-400 font-medium sticky top-0">
                        <tr>
                            <th className="px-6 py-4">Дата</th>
                            <th className="px-6 py-4">Поставщик</th>
                            <th className="px-6 py-4 text-right">Сумма (Inv.)</th>
                            <th className="px-6 py-4 text-center">Метод</th>
                            <th className="px-6 py-4 text-center">Статус</th>
                            <th className="px-6 py-4 text-right">Оплачено</th>
                            <th className="px-6 py-4 text-right">Долг</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {purchases.slice().reverse().map(purchase => {
                            const debt = purchase.totalInvoiceAmount - purchase.amountPaid;
                            const isMixed = purchase.paymentMethod === 'mixed';
                            const isExpanded = expandedPurchases.has(purchase.id);
                            const purchaseTrx = isMixed && isExpanded ? getPurchaseTransactions(purchase.id) : [];

                            return (
                                <React.Fragment key={purchase.id}>
                                    <tr className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 text-slate-300">{new Date(purchase.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium text-white">{purchase.supplierName}</td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-300">${purchase.totalInvoiceAmount.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                disabled={!isMixed}
                                                onClick={() => isMixed && toggleExpand(purchase.id)}
                                                className={`flex items-center gap-1 mx-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${purchase.paymentMethod === 'cash' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    purchase.paymentMethod === 'bank' ? 'bg-blue-500/20 text-blue-400' :
                                                        purchase.paymentMethod === 'mixed' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 cursor-pointer' :
                                                            'bg-red-500/20 text-red-400'
                                                    }`}
                                            >
                                                {purchase.paymentMethod === 'cash' ? 'Наличные' :
                                                    purchase.paymentMethod === 'bank' ? 'Банк' :
                                                        purchase.paymentMethod === 'mixed' ? 'МИКС' : 'Долг'}
                                                {isMixed && (isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${purchase.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                                purchase.paymentStatus === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {purchase.paymentStatus === 'paid' ? 'Оплачено' :
                                                    purchase.paymentStatus === 'partial' ? 'Частично' : 'Не оплачено'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-emerald-400">${purchase.amountPaid.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono text-red-400 font-bold">
                                            {debt > 0 ? `$${debt.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {debt > 0 && (
                                                <button
                                                    onClick={() => onOpenRepayModal(purchase)}
                                                    className="text-xs bg-slate-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1 ml-auto"
                                                >
                                                    <Wallet size={14} /> Оплатить
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {/* Details row */}
                                    {isExpanded && isMixed && (
                                        <tr className="bg-slate-800/50">
                                            <td colSpan={8} className="px-6 py-3">
                                                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 ml-10">
                                                    <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Детализация оплаты (МИКС)</div>
                                                    {purchaseTrx.length === 0 ? (
                                                        <div className="text-xs text-red-400">Транзакции не найдены</div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-4">
                                                            {purchaseTrx.map(t => (
                                                                <div key={t.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                                                                    <div className="text-[10px] text-slate-500 uppercase">{t.method === 'cash' ? 'Наличные' : t.method === 'card' ? 'Карта' : 'Банк'}</div>
                                                                    <div className={`text-sm font-mono font-bold ${t.method === 'cash' && t.currency === 'USD' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                                        {t.currency === 'UZS' ? `${t.amount.toLocaleString()} UZS` : `$${t.amount.toFixed(2)}`}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {purchases.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    История закупок пуста.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

PurchaseHistoryTab.displayName = 'PurchaseHistoryTab';
