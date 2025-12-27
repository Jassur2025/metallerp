import React, { useState, useMemo } from 'react';
import { Purchase, Order, Expense, AppSettings } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Calendar, Filter, ArrowDownRight, ArrowUpRight, Scale, FileText, List } from 'lucide-react';

interface VatReportProps {
    purchases: Purchase[];
    orders: Order[];
    expenses: Expense[];
    settings: AppSettings;
}

export const VatReport: React.FC<VatReportProps> = ({ purchases, orders, expenses, settings }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    // Default to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    // Курс для конвертации USD → UZS (НДС отчёт в национальной валюте)
    const exchangeRate = settings.defaultExchangeRate || 12650;

    // Форматирование в сумах
    const formatUZS = (usd: number) => {
        const uzs = usd * exchangeRate;
        return `${uzs.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} сум`;
    };

    const reportData = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day

        // 1. Input VAT (from Imports/Purchases) & Customs
        const filteredPurchases = purchases.filter(p => {
            const d = new Date(p.date);
            return d >= start && d <= end;
        });

        // 2. Input VAT (from Expenses)
        const filteredExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            return d >= start && d <= end && e.vatAmount && e.vatAmount > 0;
        });

        const importVat = filteredPurchases.reduce((sum, p) => sum + (p.overheads?.importVat || 0), 0);
        const expenseVat = filteredExpenses.reduce((sum, e) => sum + (e.vatAmount || 0), 0);
        const totalImportVat = importVat + expenseVat;

        const totalCustomsDuty = filteredPurchases.reduce((sum, p) => sum + (p.overheads?.customsDuty || 0), 0);

        // 3. Output VAT (from Sales/Orders)
        const filteredOrders = orders.filter(o => {
            const d = new Date(o.date);
            return d >= start && d <= end && o.status !== 'cancelled';
        });

        const totalOutputVat = filteredOrders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);

        // 4. Net VAT
        const netVat = totalOutputVat - totalImportVat;

        // 5. Registry (Combined List)
        const registry = [
            ...filteredPurchases.map(p => ({
                id: p.id,
                date: p.date,
                type: 'import' as const,
                counterparty: p.supplierName,
                amount: p.totalLandedAmount || 0,
                vatIn: p.overheads?.importVat || 0,
                vatOut: 0
            })),
            ...filteredExpenses.map(e => ({
                id: e.id,
                date: e.date,
                type: 'expense' as const,
                counterparty: e.category,
                amount: e.amount,
                vatIn: e.vatAmount || 0,
                vatOut: 0
            })),
            ...filteredOrders.map(o => ({
                id: o.id,
                date: o.date,
                type: 'sale' as const,
                counterparty: o.customerName,
                amount: o.totalAmount,
                vatIn: 0,
                vatOut: o.vatAmount || 0
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            totalImportVat,
            totalCustomsDuty,
            totalOutputVat,
            netVat,
            filteredPurchases,
            filteredOrders,
            registry
        };
    }, [purchases, orders, expenses, startDate, endDate]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Filters */}
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${t.bgCard} p-4 rounded-xl border ${t.border} shadow-lg`}>
                <div>
                    <h2 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                        <Scale className="text-blue-500" /> Отчет по НДС и Таможне
                    </h2>
                    <p className={`text-sm ${t.textMuted}`}>Анализ входящего и исходящего НДС за период (в сумах, курс: {exchangeRate.toLocaleString()} UZS)</p>
                </div>

                <div className={`flex items-center gap-2 ${t.input} p-1 rounded-lg border ${t.border}`}>
                    <div className={`flex items-center gap-2 px-3 py-1 border-r ${t.border}`}>
                        <Calendar size={16} className={`${t.textMuted}`} />
                        <span className={`text-xs ${t.textMuted} font-medium uppercase`}>Период</span>
                    </div>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className={`bg-transparent ${t.text} text-sm outline-none px-2 py-1`}
                    />
                    <span className={`${t.textMuted}`}>-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className={`bg-transparent ${t.text} text-sm outline-none px-2 py-1`}
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Output VAT */}
                <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowUpRight size={60} className="text-red-500" />
                    </div>
                    <p className={`text-xs font-medium ${t.textMuted} uppercase tracking-wider`}>НДС к уплате (OUT)</p>
                    <h3 className={`text-2xl font-bold ${t.text} mt-1 group-hover:text-red-500 transition-colors`}>
                        {formatUZS(reportData.totalOutputVat)}
                    </h3>
                    <p className={`text-xs ${t.textMuted} mt-2`}>Начислено с продаж</p>
                </div>

                {/* Input VAT */}
                <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowDownRight size={60} className="text-emerald-500" />
                    </div>
                    <p className={`text-xs font-medium ${t.textMuted} uppercase tracking-wider`}>НДС к зачету (IN)</p>
                    <h3 className={`text-2xl font-bold ${t.text} mt-1 group-hover:text-emerald-500 transition-colors`}>
                        {formatUZS(reportData.totalImportVat)}
                    </h3>
                    <p className={`text-xs ${t.textMuted} mt-2`}>Уплачено при импорте</p>
                </div>

                {/* Net VAT Position */}
                <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Scale size={60} className={reportData.netVat > 0 ? "text-amber-500" : "text-blue-500"} />
                    </div>
                    <p className={`text-xs font-medium ${t.textMuted} uppercase tracking-wider`}>Итого НДС (Сальдо)</p>
                    <h3 className={`text-2xl font-bold mt-1 transition-colors ${reportData.netVat > 0 ? 'text-amber-500' : 'text-blue-500'}`}>
                        {formatUZS(Math.abs(reportData.netVat))}
                    </h3>
                    <p className={`text-xs ${t.textMuted} mt-2`}>
                        {reportData.netVat > 0 ? 'К уплате в бюджет' : 'К возмещению из бюджета'}
                    </p>
                </div>

                {/* Customs Duty */}
                <div className={`${t.bgCard} p-5 rounded-xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText size={60} className="text-purple-500" />
                    </div>
                    <p className={`text-xs font-medium ${t.textMuted} uppercase tracking-wider`}>Таможенные пошлины</p>
                    <h3 className={`text-2xl font-bold ${t.text} mt-1 group-hover:text-purple-500 transition-colors`}>
                        {formatUZS(reportData.totalCustomsDuty)}
                    </h3>
                    <p className={`text-xs ${t.textMuted} mt-2`}>Справочно (не влияет на НДС)</p>
                </div>
            </div>

            {/* Detailed Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Import VAT Details */}
                <div className={`${t.bgCard} rounded-xl border ${t.border} shadow-lg overflow-hidden flex flex-col h-[500px]`}>
                    <div className={`p-4 border-b ${t.border} ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                        <h3 className={`font-bold ${t.text} text-sm uppercase tracking-wider flex items-center gap-2`}>
                            <ArrowDownRight size={16} className="text-emerald-500" /> Входящий НДС и Пошлины (Импорт)
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} text-xs uppercase ${t.textMuted} font-medium sticky top-0`}>
                                <tr>
                                    <th className="px-4 py-3">Дата</th>
                                    <th className="px-4 py-3">Поставщик</th>
                                    <th className="px-4 py-3 text-right">Пошлина</th>
                                    <th className="px-4 py-3 text-right">НДС (In)</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${t.divide}`}>
                                {reportData.filteredPurchases.length > 0 ? (
                                    reportData.filteredPurchases.map(p => (
                                        <tr key={p.id} className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-4 py-3 ${t.textMuted}`}>{new Date(p.date).toLocaleDateString()}</td>
                                            <td className={`px-4 py-3 font-medium ${t.text}`}>{p.supplierName}</td>
                                            <td className="px-4 py-3 text-right font-mono text-purple-500">
                                                {p.overheads?.customsDuty ? formatUZS(p.overheads.customsDuty) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-500 font-bold">
                                                {p.overheads?.importVat ? formatUZS(p.overheads.importVat) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className={`px-4 py-8 text-center ${t.textMuted}`}>Нет данных за период</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Output VAT Details */}
                <div className={`${t.bgCard} rounded-xl border ${t.border} shadow-lg overflow-hidden flex flex-col h-[500px]`}>
                    <div className={`p-4 border-b ${t.border} ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                        <h3 className={`font-bold ${t.text} text-sm uppercase tracking-wider flex items-center gap-2`}>
                            <ArrowUpRight size={16} className="text-red-500" /> Исходящий НДС (Продажи)
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} text-xs uppercase ${t.textMuted} font-medium sticky top-0`}>
                                <tr>
                                    <th className="px-4 py-3">Дата</th>
                                    <th className="px-4 py-3">Клиент</th>
                                    <th className="px-4 py-3 text-right">Сумма</th>
                                    <th className="px-4 py-3 text-right">НДС (Out)</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${t.divide}`}>
                                {reportData.filteredOrders.length > 0 ? (
                                    reportData.filteredOrders.map(o => (
                                        <tr key={o.id} className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-4 py-3 ${t.textMuted}`}>{new Date(o.date).toLocaleDateString()}</td>
                                            <td className={`px-4 py-3 font-medium ${t.text}`}>{o.customerName}</td>
                                            <td className={`px-4 py-3 text-right font-mono ${t.textMuted}`}>{formatUZS(o.totalAmount)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-red-500 font-bold">
                                                {o.vatAmount ? formatUZS(o.vatAmount) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className={`px-4 py-8 text-center ${t.textMuted}`}>Нет данных за период</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* VAT Registry Table */}
            <div className={`${t.bgCard} rounded-xl border ${t.border} shadow-lg overflow-hidden flex flex-col h-[600px] mt-6`}>
                <div className={`p-4 border-b ${t.border} ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold ${t.text} text-sm uppercase tracking-wider flex items-center gap-2`}>
                        <List size={16} className="text-blue-500" /> Реестр НДС (Все операции)
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} text-xs uppercase ${t.textMuted} font-medium sticky top-0`}>
                            <tr>
                                <th className="px-4 py-3">Дата</th>
                                <th className="px-4 py-3">Тип</th>
                                <th className="px-4 py-3">Контрагент</th>
                                <th className="px-4 py-3 text-right">Сумма</th>
                                <th className="px-4 py-3 text-right text-emerald-500">НДС (Входящий)</th>
                                <th className="px-4 py-3 text-right text-red-500">НДС (Исходящий)</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${t.divide}`}>
                            {reportData.registry.length > 0 ? (
                                reportData.registry.map((item, idx) => (
                                    <tr key={`${item.type}-${item.id}-${idx}`} className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                        <td className={`px-4 py-3 ${t.textMuted}`}>{new Date(item.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${item.type === 'import' ? 'bg-purple-500/20 text-purple-500' :
                                                    item.type === 'expense' ? 'bg-amber-500/20 text-amber-500' :
                                                        'bg-blue-500/20 text-blue-500'
                                                }`}>
                                                {item.type === 'import' ? 'Импорт' : item.type === 'expense' ? 'Расход' : 'Продажа'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 font-medium ${t.text}`}>{item.counterparty}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${t.textMuted}`}>{formatUZS(item.amount)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-emerald-500 font-bold">
                                            {item.vatIn > 0 ? `+${formatUZS(item.vatIn)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-red-500 font-bold">
                                            {item.vatOut > 0 ? `-${formatUZS(item.vatOut)}` : '-'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className={`px-4 py-8 text-center ${t.textMuted}`}>Нет данных за период</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
