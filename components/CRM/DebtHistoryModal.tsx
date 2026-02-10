import React from 'react';
import { Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { History, Plus } from 'lucide-react';

export type HistoryItem = {
    id: string;
    date: string;
    type: 'order' | 'repayment' | 'transaction';
    description: string;
    items?: { name: string; qty: number; price: number }[];
    totalAmount: number;
    amountPaid: number;
    debtChange: number;
    balance: number;
    reportNo?: number;
    paymentMethod?: string;
    currency?: string;
    exchangeRate?: number;
    amountInUSD?: number;
    paymentDueDate?: string;
};

interface DebtHistoryModalProps {
    client: Client;
    history: HistoryItem[];
    onClose: () => void;
}

export const DebtHistoryModal: React.FC<DebtHistoryModalProps> = ({ client, history, onClose }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    const totalDebtFromHistory = history.filter(h => h.debtChange > 0).reduce((s, h) => s + h.debtChange, 0);
    const totalRepaidFromHistory = Math.abs(history.filter(h => h.debtChange < 0).reduce((s, h) => s + h.debtChange, 0));
    const currentDebtFromHistory = Math.max(0, totalDebtFromHistory - totalRepaidFromHistory);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${t.bgCard} rounded-2xl w-full max-w-4xl border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col`}>
                <div className={`p-6 border-b ${t.border} flex justify-between items-center flex-shrink-0`}>
                    <div>
                        <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                            <History size={22} className="text-indigo-500" />
                            История долга: {client.companyName || client.name}
                        </h3>
                        <p className={`text-sm ${t.textMuted} mt-1`}>
                            Полная история операций по долгу клиента
                        </p>
                    </div>
                    <div className="text-right mr-4">
                        <p className={`text-xs ${t.textMuted}`}>Текущий долг</p>
                        <p className={`text-2xl font-mono font-bold ${currentDebtFromHistory > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            ${currentDebtFromHistory.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <button onClick={onClose} className={`${t.textMuted} hover:${t.text}`}>
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {history.length === 0 ? (
                        <div className={`text-center py-12 ${t.textMuted}`}>
                            <History size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-lg">Нет записей по долгу</p>
                            <p className="text-sm mt-2">
                                Долг в карточке: <span className="text-red-500 font-bold">${(client.totalDebt || 0).toLocaleString()}</span>
                            </p>
                            <p className="text-xs mt-4 max-w-md mx-auto">
                                Возможно долг был введён вручную или заказы оформлены на другое имя клиента.
                                Проверьте имя клиента в заказах.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className={`${t.bg} sticky top-0`}>
                                <tr className={`border-b ${t.border}`}>
                                    <th className={`px-3 py-3 text-left ${t.textMuted} font-medium`}>Дата</th>
                                    <th className={`px-3 py-3 text-left ${t.textMuted} font-medium`}>Операция</th>
                                    <th className={`px-3 py-3 text-left ${t.textMuted} font-medium`}>Описание</th>
                                    <th className={`px-3 py-3 text-center ${t.textMuted} font-medium`}>Способ оплаты</th>
                                    <th className={`px-3 py-3 text-right ${t.textMuted} font-medium`}>Сумма</th>
                                    <th className={`px-3 py-3 text-right ${t.textMuted} font-medium`}>Долг ±</th>
                                    <th className={`px-3 py-3 text-right ${t.textMuted} font-medium`}>Остаток</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${t.divide}`}>
                                {history.map((item) => (
                                    <tr key={item.id} className={`hover:${t.bgHover} ${item.type === 'repayment' ? 'bg-emerald-500/5' : item.type === 'order' ? 'bg-red-500/5' : ''}`}>
                                        <td className={`px-3 py-3 ${t.textMuted} whitespace-nowrap`}>
                                            <div>{new Date(item.date).toLocaleDateString('ru-RU')}</div>
                                            {item.paymentDueDate && (
                                                <div className="text-xs text-amber-500">
                                                    До: {new Date(item.paymentDueDate).toLocaleDateString('ru-RU')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                item.type === 'order' ? 'bg-red-500/20 text-red-500' :
                                                item.type === 'repayment' ? 'bg-emerald-500/20 text-emerald-500' :
                                                'bg-blue-500/20 text-blue-500'
                                            }`}>
                                                {item.type === 'order' ? '📦 Долг' : 
                                                 item.type === 'repayment' ? '✅ Оплачено' : 
                                                 '📋 Транзакция'}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-3 ${t.text}`}>
                                            <div className="max-w-xs">
                                                <div className="font-medium">
                                                    {item.reportNo 
                                                        ? `Отчёт №${item.reportNo}` 
                                                        : item.type === 'order' && item.description.includes('ORD-')
                                                            ? `Заказ #${item.description.match(/ORD-[a-z0-9]+/i)?.[0]?.slice(-6) || item.id.slice(-6)}`
                                                            : item.type === 'repayment'
                                                                ? 'Погашение долга'
                                                                : item.description
                                                    }
                                                </div>
                                                {item.items && item.items.length > 0 && (
                                                    <div className={`text-xs ${t.textMuted} mt-1`}>
                                                        {item.items.slice(0, 2).map((it, idx) => (
                                                            <span key={idx}>{it.name} × {it.qty}{idx < Math.min(item.items!.length, 2) - 1 ? ', ' : ''}</span>
                                                        ))}
                                                        {item.items.length > 2 && <span> +{item.items.length - 2}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-3 py-3 text-center`}>
                                            {item.type === 'repayment' ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                        item.paymentMethod === 'cash' ? 'bg-green-500/20 text-green-500' :
                                                        item.paymentMethod === 'card' ? 'bg-blue-500/20 text-blue-500' :
                                                        item.paymentMethod === 'bank' ? 'bg-purple-500/20 text-purple-500' :
                                                        item.paymentMethod === 'mixed' ? 'bg-amber-500/20 text-amber-500' :
                                                        `${t.bgCard} ${t.textMuted}`
                                                    }`}>
                                                        {item.paymentMethod === 'cash' ? '💵 Наличные' :
                                                         item.paymentMethod === 'card' ? '💳 Карта' :
                                                         item.paymentMethod === 'bank' ? '🏦 Р/С (Банк)' :
                                                         item.paymentMethod === 'mixed' ? '🔀 Микс' :
                                                         '—'}
                                                    </span>
                                                    <span className={`text-xs ${t.textMuted}`}>
                                                        {item.currency === 'UZS' ? '🇺🇿 Сум' : '🇺🇸 USD'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className={`text-xs ${t.textMuted}`}>—</span>
                                            )}
                                        </td>
                                        <td className={`px-3 py-3 text-right font-mono ${t.text}`}>
                                            <div>
                                                {item.currency === 'UZS' ? (
                                                    <>
                                                        <div>{item.totalAmount.toLocaleString()} сум</div>
                                                        {item.amountInUSD && (
                                                            <div className={`text-xs ${t.textMuted}`}>
                                                                ≈ ${item.amountInUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div>${item.totalAmount.toLocaleString()}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${item.debtChange > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {item.debtChange > 0 ? '+' : ''}${item.debtChange.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${item.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            ${item.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                <div className={`p-4 border-t ${t.border} flex justify-between items-center ${t.bg}`}>
                    <div className={`text-sm ${t.textMuted}`}>
                        Записей: {history.length}
                        {history.length > 0 && (() => {
                            const totalDebtAdded = history.filter(h => h.debtChange > 0).reduce((s, h) => s + h.debtChange, 0);
                            const totalRepaid = Math.abs(history.filter(h => h.debtChange < 0).reduce((s, h) => s + h.debtChange, 0));
                            const calculatedDebt = Math.max(0, totalDebtAdded - totalRepaid);
                            return (
                                <>
                                    <span className="mx-2">|</span>
                                    Сумма долга: <span className={`font-mono ${t.text}`}>${totalDebtAdded.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    <span className="mx-2">|</span>
                                    Погашено: <span className="text-emerald-500 font-mono">${totalRepaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    <span className="mx-2">|</span>
                                    Остаток долга: <span className={`font-mono font-bold ${calculatedDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>${calculatedDebt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </>
                            );
                        })()}
                    </div>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} rounded-lg font-medium transition-colors`}
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};
