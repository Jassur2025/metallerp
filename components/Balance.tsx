
import React from 'react';
import { BalanceData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShieldCheck, Wallet, Building2, Landmark } from 'lucide-react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

interface BalanceProps {
    balance: BalanceData;
}

export const Balance: React.FC<BalanceProps> = React.memo(({ balance }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    const {
        inventoryValue,
        inventoryByWarehouse,
        totalCashUSD,
        netBankUSD,
        netCardUSD,
        fixedAssetsValue,
        accountsReceivable,
        totalAssets,
        vatOutput,
        vatInput,
        vatLiability,
        accountsPayable,
        fixedAssetsPayable,
        equity,
        fixedAssetsFund,
        retainedEarnings,
        totalPassives,
        netProfit,
        totalExpenses,
        corrections,
        exchangeRate,
    } = balance;

    const formatCurrency = (val: number) =>
        `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Chart Data
    const assetsData = [
        { name: 'Осн. Средства', value: fixedAssetsValue, color: '#0ea5e9' },
        { name: 'Товар', value: inventoryValue, color: '#3b82f6' },
        { name: 'Касса (Нал)', value: totalCashUSD, color: '#10b981' },
        { name: 'Р/С (Банк)', value: netBankUSD, color: '#8b5cf6' },
        { name: 'Дебиторка', value: accountsReceivable, color: '#f59e0b' },
    ].filter(item => item.value > 0);

    const passivesData = [
        { name: 'Товарный капитал', value: equity, color: '#8b5cf6' },
        { name: 'Фонд ОС', value: fixedAssetsFund, color: '#0ea5e9' },
        { name: 'Нераспр. прибыль', value: retainedEarnings > 0 ? retainedEarnings : 0, color: '#f59e0b' },
        { name: 'Обязательства по НДС', value: vatLiability, color: '#ef4444' },
        { name: 'Долг поставщикам', value: accountsPayable, color: '#fca5a5' },
        { name: 'Долг за ОС', value: fixedAssetsPayable, color: '#fb923c' },
    ].filter(item => item.value > 0);

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets Card */}
                <div className={`${t.bgCard} rounded-2xl p-6 border-t-4 border-t-emerald-500 border-x border-b ${t.border} shadow-lg`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                                <Wallet className="text-emerald-500" /> АКТИВ
                            </h3>
                            <p className={`${t.textMuted} text-sm`}>Куда вложены средства</p>
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-sm font-mono">
                            {formatCurrency(totalAssets)}
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div className={`flex justify-between items-center p-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-sky-500 rounded-full"></div>
                                <span className={t.textMuted}>Основные средства</span>
                            </div>
                            <span className="font-mono text-sky-500">{formatCurrency(fixedAssetsValue)}</span>
                        </div>

                        {/* Товарные запасы с разбивкой по складам */}
                        <div className={`p-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                    <span className={t.textMuted}>Товарные запасы (ТМЦ)</span>
                                </div>
                                <span className="font-mono text-blue-500 font-bold">{formatCurrency(inventoryValue)}</span>
                            </div>
                            <div className="ml-5 space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className={`${t.textMuted} flex items-center gap-1`}>
                                        <span className="text-cyan-400">🏭</span> Основной склад
                                    </span>
                                    <span className="font-mono text-cyan-400">{formatCurrency(inventoryByWarehouse.main)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className={`${t.textMuted} flex items-center gap-1`}>
                                        <span className="text-violet-400">☁️</span> Облачный склад
                                    </span>
                                    <span className="font-mono text-violet-400">{formatCurrency(inventoryByWarehouse.cloud)}</span>
                                </div>
                            </div>
                        </div>

                        <div className={`flex justify-between items-center p-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                                <span className={t.textMuted}>Касса (Наличные)</span>
                            </div>
                            <span className="font-mono text-emerald-500">{formatCurrency(totalCashUSD)}</span>
                        </div>

                        <div className={`flex justify-between items-center p-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                                <span className={t.textMuted}>Расчетный счет</span>
                            </div>
                            <span className="font-mono text-purple-500">{formatCurrency(netBankUSD)}</span>
                        </div>

                        <div className={`flex justify-between items-center p-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-indigo-400 rounded-full"></div>
                                <span className={t.textMuted}>Терминал / Карта</span>
                            </div>
                            <span className="font-mono text-indigo-500">{formatCurrency(netCardUSD)}</span>
                        </div>

                        <div className={`flex justify-between items-center p-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
                                <span className={t.textMuted}>Дебиторская задолженность</span>
                            </div>
                            <span className="font-mono text-amber-500">{formatCurrency(accountsReceivable)}</span>
                        </div>
                    </div>
                </div>

                {/* Passives Card */}
                <div className={`${t.bgCard} rounded-2xl p-6 border-t-4 border-t-indigo-500 border-x border-b ${t.border} shadow-lg`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                                <Building2 className="text-indigo-500" /> ПАССИВ
                            </h3>
                            <p className={`${t.textMuted} text-sm`}>Источники средств</p>
                        </div>
                        <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-sm font-mono">
                            {formatCurrency(totalPassives)}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className={`flex justify-between items-center p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-xl border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-indigo-500 rounded-full"></div>
                                <div>
                                    <p className={`${t.text} font-medium`}>Собственный капитал</p>
                                    <p className={`text-xs ${t.textMuted}`}>Инвестиции в товар</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-indigo-400">{formatCurrency(equity)}</p>
                        </div>

                        <div className={`flex justify-between items-center p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-xl border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-sky-500 rounded-full"></div>
                                <div>
                                    <p className={`${t.text} font-medium`}>Фонд основных средств</p>
                                    <p className={`text-xs ${t.textMuted}`}>Инвестиции в ОС</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-sky-400">{formatCurrency(fixedAssetsFund)}</p>
                        </div>

                        <div className={`flex justify-between items-center p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-xl border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-amber-500 rounded-full"></div>
                                <div>
                                    <p className={`${t.text} font-medium`}>Нераспределенная прибыль</p>
                                    <p className={`text-xs ${t.textMuted}`}>Retained Earnings</p>
                                </div>
                            </div>
                            <p className={`font-mono text-lg ${retainedEarnings >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                {formatCurrency(retainedEarnings)}
                            </p>
                        </div>

                        <div className={`p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-xl border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-10 bg-red-500 rounded-full"></div>
                                    <div>
                                        <p className={`${t.text} font-medium`}>Обязательства по НДС</p>
                                        <p className={`text-xs ${t.textMuted}`}>Исходящий - Входящий = К уплате</p>
                                    </div>
                                </div>
                                <p className="font-mono text-lg text-red-500">{formatCurrency(vatLiability)}</p>
                            </div>
                            <div className="ml-5 mt-2 space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className={t.textMuted}>НДС исходящий (продажи)</span>
                                    <span className="font-mono text-red-400">{formatCurrency(vatOutput)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className={t.textMuted}>НДС входящий (закупки) — к зачёту</span>
                                    <span className="font-mono text-emerald-400">-{formatCurrency(vatInput)}</span>
                                </div>
                            </div>
                        </div>

                        <div className={`flex justify-between items-center p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-xl border ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-red-300 rounded-full"></div>
                                <div>
                                    <p className={`${t.text} font-medium`}>Обязательства перед поставщиками</p>
                                    <p className={`text-xs ${t.textMuted}`}>Долг за товары</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-red-400">{formatCurrency(accountsPayable)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${t.bgCard} rounded-xl border ${t.border} p-6`}>
                    <h4 className={`text-lg font-bold ${t.text} mb-4 text-center`}>Структура Пассивов</h4>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={passivesData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {passivesData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                                        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                    }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={`${t.bgCard} rounded-xl border ${t.border} p-6 flex flex-col justify-center items-center text-center space-y-6`}>
                    <div className="p-4 bg-emerald-500/10 rounded-full">
                        <Landmark size={48} className="text-emerald-500" />
                    </div>
                    <div>
                        <h4 className={`text-xl font-bold ${t.text}`}>Финансовая сводка</h4>
                        <p className={`${t.textMuted} max-w-md mx-auto mt-2`}>
                            Текущий денежный поток позволяет покрыть налоговые обязательства. Зарезервировано <span className={`${t.text} font-bold`}>{formatCurrency(vatLiability)}</span> на НДС.
                        </p>
                    </div>
                    <div className={`w-full ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'} rounded-lg p-4 grid grid-cols-2 gap-4 divide-x ${t.divide}`}>
                        <div>
                            <p className={`text-xs ${t.textMuted}`}>Чистая Прибыль</p>
                            <p className={`font-bold ${netProfit >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                {formatCurrency(netProfit)}
                            </p>
                        </div>
                        <div>
                            <p className={`text-xs ${t.textMuted}`}>Расходы</p>
                            <p className="text-red-500 font-bold">{formatCurrency(totalExpenses)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Auto-Correction Report */}
            {corrections && corrections.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2">
                        <ShieldCheck className="text-amber-500" /> Автоматическая коррекция ошибок
                    </h3>
                    <p className={`${t.textMuted} text-sm mb-4`}>
                        Система обнаружила и исправила следующие вероятные ошибки ввода (суммы {'>'} $1M были сконвертированы как UZS):
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {corrections.map((c, idx) => (
                            <div key={`${c.id}-${idx}`} className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} p-3 rounded-xl flex justify-between items-center border border-amber-500/20`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.type === 'order' ? 'bg-blue-500/20 text-blue-500' :
                                                c.type === 'transaction' ? 'bg-purple-500/20 text-purple-500' :
                                                    'bg-red-500/20 text-red-500'
                                            }`}>
                                            {c.type === 'order' ? 'ЗАКАЗ' : c.type === 'transaction' ? 'ТРАНЗАКЦИЯ' : 'РАСХОД'}
                                        </span>
                                        <span className={`${t.text} font-mono text-sm`}>ID: {c.id}</span>
                                    </div>
                                    <p className={`text-xs ${t.textMuted} mt-1`}>{c.reason}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-red-400 line-through">{formatCurrency(c.originalAmount)}</p>
                                    <p className="text-emerald-500 font-bold font-mono">{formatCurrency(c.correctedAmount)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
