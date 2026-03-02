import React from 'react';
import { Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { Plus, DollarSign, Wallet } from 'lucide-react';

export interface UnpaidOrder {
    id: string;
    date: string;
    totalAmount: number;
    amountPaid: number;
    debtAmount: number;
    items: string;
    reportNo?: number;
    paymentDueDate?: string;
    payments: PaymentRecord[];
}

export interface PaymentRecord {
    date: string;
    amount: number;
    amountUSD: number;
    currency: string;
    method: string;
}

interface RepaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    debt: number;
    unpaidOrders: UnpaidOrder[];
    // Payment state
    repaymentAmount: number;
    setRepaymentAmount: (v: number) => void;
    repaymentMethod: 'cash' | 'bank' | 'card' | 'mixed';
    setRepaymentMethod: (v: 'cash' | 'bank' | 'card' | 'mixed') => void;
    repaymentCurrency: 'USD' | 'UZS';
    setRepaymentCurrency: (v: 'USD' | 'UZS') => void;
    exchangeRate: number;
    setExchangeRate: (v: number) => void;
    selectedOrderForRepayment: string | null;
    setSelectedOrderForRepayment: (v: string | null) => void;
    // Mix fields
    mixCashUZS: number;
    setMixCashUZS: (v: number) => void;
    mixCashUSD: number;
    setMixCashUSD: (v: number) => void;
    mixCard: number;
    setMixCard: (v: number) => void;
    mixBank: number;
    setMixBank: (v: number) => void;
    // Action
    onSubmit: () => void;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = ({
    isOpen, onClose, client, debt, unpaidOrders,
    repaymentAmount, setRepaymentAmount,
    repaymentMethod, setRepaymentMethod,
    repaymentCurrency, setRepaymentCurrency,
    exchangeRate, setExchangeRate,
    selectedOrderForRepayment, setSelectedOrderForRepayment,
    mixCashUZS, setMixCashUZS,
    mixCashUSD, setMixCashUSD,
    mixCard, setMixCard,
    mixBank, setMixBank,
    onSubmit
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${t.bgCard} rounded-2xl w-full max-w-md border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto`}>
                <div className={`p-6 border-b ${t.border} flex justify-between items-center sticky top-0 ${t.bgCard} z-10`}>
                    <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                        <Wallet className="text-emerald-500" /> Погашение долга
                    </h3>
                    <button onClick={onClose} className={`${t.textMuted} hover:${t.text}`}>
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {/* Client Info */}
                    <div className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} p-4 rounded-xl border ${t.border}`}>
                        <p className={`text-sm ${t.textMuted} mb-1`}>Клиент</p>
                        <p className={`text-lg font-bold ${t.text}`}>{client.name}</p>
                        <div className="mt-3 flex justify-between items-end">
                            <span className={`text-sm ${t.textMuted}`}>Общий долг:</span>
                            <span className="text-xl font-mono font-bold text-red-500">
                                ${debt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Order Selection */}
                    {unpaidOrders.length > 0 && (
                        <div className="space-y-2">
                            <label className={`text-sm font-medium ${t.textMuted}`}>Выберите чек для погашения</label>
                            <div className={`max-h-64 overflow-y-auto space-y-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} p-2 rounded-lg border ${t.border}`}>
                                {unpaidOrders.map(order => (
                                    <div
                                        key={order.id}
                                        onClick={() => {
                                            setSelectedOrderForRepayment(selectedOrderForRepayment === order.id ? null : order.id);
                                            if (selectedOrderForRepayment !== order.id) {
                                                setRepaymentAmount(order.debtAmount);
                                            }
                                        }}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                            selectedOrderForRepayment === order.id
                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                : `${t.border} hover:border-slate-400`
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className={`text-xs ${t.textMuted}`}>
                                                    {new Date(order.date).toLocaleDateString('ru-RU')}
                                                    {order.paymentDueDate && (
                                                        <span className="ml-2 text-amber-500">
                                                            • До: {new Date(order.paymentDueDate).toLocaleDateString('ru-RU')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`font-mono text-sm font-bold ${t.text}`}>
                                                    Отчёт №{order.reportNo || order.id.slice(-4)}
                                                </div>
                                                <div className={`text-xs ${t.textMuted} truncate max-w-[180px]`}>{order.items}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs ${t.textMuted}`}>Сумма: ${order.totalAmount.toLocaleString()}</div>
                                                <div className="text-sm font-mono font-bold text-red-500">
                                                    Долг: ${order.debtAmount.toLocaleString()}
                                                </div>
                                                {order.amountPaid > 0 && (
                                                    <div className={`text-xs ${t.success}`}>
                                                        Оплачено: ${order.amountPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Payment History */}
                                        {order.payments && order.payments.length > 0 && (
                                            <div className={`mt-2 pt-2 border-t ${t.border}`}>
                                                <div className={`text-xs ${t.textMuted} mb-1`}>История оплат:</div>
                                                <div className="space-y-1">
                                                    {order.payments.map((payment, idx) => (
                                                        <div key={idx} className={`flex justify-between text-xs ${t.text}`}>
                                                            <span>
                                                                {new Date(payment.date).toLocaleDateString('ru-RU')} • 
                                                                {payment.method === 'cash' ? ' 💵 Нал' : 
                                                                 payment.method === 'card' ? ' 💳 Карта' : 
                                                                 payment.method === 'bank' ? ' 🏦 Банк' : ' Микс'}
                                                            </span>
                                                            <span className={t.success}>
                                                                {payment.currency === 'UZS' 
                                                                    ? `${payment.amount.toLocaleString()} сум ($${payment.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                                                                    : `$${payment.amount.toLocaleString()}`
                                                                }
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {selectedOrderForRepayment && (
                                <div className="text-xs text-emerald-500">
                                    ✓ Выбран: Отчёт №{unpaidOrders.find(o => o.id === selectedOrderForRepayment)?.reportNo || selectedOrderForRepayment.slice(-4)} — долг ${unpaidOrders.find(o => o.id === selectedOrderForRepayment)?.debtAmount.toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>Способ оплаты</label>
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                onClick={() => { setRepaymentMethod('cash'); setRepaymentCurrency('UZS'); }}
                                className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                            >
                                Нал
                            </button>
                            <button
                                onClick={() => { setRepaymentMethod('bank'); setRepaymentCurrency('UZS'); }}
                                className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                            >
                                Банк
                            </button>
                            <button
                                onClick={() => { setRepaymentMethod('card'); setRepaymentCurrency('UZS'); }}
                                className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                            >
                                Карта
                            </button>
                            <button
                                onClick={() => setRepaymentMethod('mixed')}
                                className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'mixed' ? 'bg-amber-500/20 border-amber-500 text-amber-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                            >
                                Микс
                            </button>
                        </div>
                    </div>

                    {/* Exchange Rate */}
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>Курс обмена (1 USD = ? UZS)</label>
                        <input
                            type="number"
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} font-mono focus:ring-2 focus:ring-emerald-500 outline-none`}
                            value={exchangeRate}
                            onChange={e => setExchangeRate(Number(e.target.value))}
                        />
                    </div>

                    {/* Mix Payment */}
                    {repaymentMethod === 'mixed' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>💵 Нал (сум)</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none`}
                                        value={mixCashUZS || ''}
                                        onChange={e => setMixCashUZS(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>💵 Нал ($)</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none`}
                                        value={mixCashUSD || ''}
                                        onChange={e => setMixCashUSD(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>💳 Карта (сум)</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none`}
                                        value={mixCard || ''}
                                        onChange={e => setMixCard(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>🏦 Перечисл. (сум)</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none`}
                                        value={mixBank || ''}
                                        onChange={e => setMixBank(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            
                            {/* Mix totals */}
                            <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} p-3 rounded-lg border ${t.border}`}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={`${t.textMuted}`}>Итого в USD:</span>
                                    <span className={`${t.success} font-mono font-bold`}>
                                        ${((mixCashUZS / exchangeRate) + mixCashUSD + (mixCard / exchangeRate) + (mixBank / exchangeRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className={`${t.textMuted}`}>Остаток долга:</span>
                                    <span className={`${t.text} font-mono opacity-80`}>
                                        ${Math.max(0, debt - ((mixCashUZS / exchangeRate) + mixCashUSD + (mixCard / exchangeRate) + (mixBank / exchangeRate))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Currency Selector (Only for Cash) */}
                            {repaymentMethod === 'cash' && (
                                <div className="space-y-2">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>Валюта</label>
                                    <div className={`flex ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} rounded-lg p-1 border ${t.border}`}>
                                        <button
                                            onClick={() => setRepaymentCurrency('UZS')}
                                            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${repaymentCurrency === 'UZS' ? 'bg-slate-700 text-white' : `${t.textMuted} hover:${t.text}`}`}
                                        >
                                            UZS (Сумы)
                                        </button>
                                        <button
                                            onClick={() => setRepaymentCurrency('USD')}
                                            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${repaymentCurrency === 'USD' ? 'bg-slate-700 text-white' : `${t.textMuted} hover:${t.text}`}`}
                                        >
                                            USD (Доллары)
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>
                                    Сумма погашения ({repaymentCurrency})
                                </label>
                                <div className="relative">
                                    <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-3 ${t.text} text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none`}
                                        value={repaymentAmount || ''}
                                        onChange={e => setRepaymentAmount(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} p-3 rounded-lg border ${t.border}`}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={`${t.textMuted}`}>Сумма в USD:</span>
                                    <span className={`${t.text} font-mono`}>
                                        ${(repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className={`${t.textMuted}`}>Остаток долга:</span>
                                    <span className={`${t.text} font-mono opacity-80`}>
                                        ${Math.max(0, debt - (repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        onClick={onSubmit}
                        disabled={repaymentMethod === 'mixed' 
                            ? (mixCashUZS + mixCashUSD + mixCard + mixBank) <= 0 
                            : repaymentAmount <= 0}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
                    >
                        Подтвердить оплату
                    </button>
                </div>
            </div>
        </div>
    );
};
