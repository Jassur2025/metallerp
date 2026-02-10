import React from 'react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { DollarSign, Wallet, History, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

interface RepaymentStatsData {
    totalRepaidUSD: number;
    totalCount: number;
    chartData: { date: string; amount: number; count: number }[];
    methodData: { name: string; value: number; color: string }[];
    topClients: { name: string; amount: number; count: number }[];
}

interface RepaymentStatsViewProps {
    stats: RepaymentStatsData;
    timeRange: 'week' | 'month' | 'year' | 'all';
    onTimeRangeChange: (range: 'week' | 'month' | 'year' | 'all') => void;
}

export const RepaymentStatsView: React.FC<RepaymentStatsViewProps> = ({
    stats, timeRange, onTimeRangeChange
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    return (
        <div className="flex-1 overflow-y-auto space-y-6 pb-20 custom-scrollbar">
            {/* Time Range Selector */}
            <div className={`flex items-center gap-2 ${t.bgCard} rounded-xl p-1 border ${t.border} w-full sm:w-auto`}>
                {(['week', 'month', 'year', 'all'] as const).map((range) => (
                    <button
                        key={range}
                        onClick={() => onTimeRangeChange(range)}
                        className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                            timeRange === range
                                ? t.tabActive
                                : t.tabInactive
                        }`}
                    >
                        {range === 'week' ? 'Неделя' : 
                         range === 'month' ? 'Месяц' : 
                         range === 'year' ? 'Год' : 'Все'}
                    </button>
                ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className={`${t.bgStatEmerald} p-4 sm:p-6 rounded-xl border`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 ${t.iconBgEmerald} rounded-lg`}>
                            <TrendingUp size={20} className={t.iconEmerald} />
                        </div>
                        <p className={`text-xs sm:text-sm ${t.textMuted}`}>Всего погашено</p>
                    </div>
                    <p className={`text-2xl sm:text-3xl font-mono font-bold ${t.iconEmerald}`}>
                        ${stats.totalRepaidUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className={`${t.bgStatBlue} p-4 sm:p-6 rounded-xl border`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 ${t.iconBgBlue} rounded-lg`}>
                            <History size={20} className={t.iconBlue} />
                        </div>
                        <p className={`text-xs sm:text-sm ${t.textMuted}`}>Количество операций</p>
                    </div>
                    <p className={`text-2xl sm:text-3xl font-mono font-bold ${t.iconBlue}`}>
                        {stats.totalCount}
                    </p>
                </div>
                <div className={`${t.bgStatPurple} p-4 sm:p-6 rounded-xl border sm:col-span-2 lg:col-span-1`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 ${t.iconBgPurple} rounded-lg`}>
                            <DollarSign size={20} className={t.iconPurple} />
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400">Среднее погашение</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-mono font-bold text-purple-400">
                        ${stats.totalCount > 0 
                            ? (stats.totalRepaidUSD / stats.totalCount).toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : '0.00'}
                    </p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Repayments by Day Chart */}
                <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-bold ${t.text} mb-4 flex items-center gap-2`}>
                        <Calendar className="text-blue-400" size={20} /> Погашения по дням
                    </h3>
                    {stats.chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#334155" : "#e2e8f0"} />
                                <XAxis dataKey="date" stroke={theme === 'dark' ? "#94a3b8" : "#64748b"} fontSize={12} />
                                <YAxis stroke={theme === 'dark' ? "#94a3b8" : "#64748b"} fontSize={12} />
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                    }}
                                    formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                />
                                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className={`h-[300px] flex items-center justify-center ${t.textMuted}`}>
                            Нет данных за выбранный период
                        </div>
                    )}
                </div>

                {/* Repayments by Method Chart */}
                <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 sm:p-6`}>
                    <h3 className={`text-lg font-bold ${t.text} mb-4 flex items-center gap-2`}>
                        <Wallet className="text-emerald-400" size={20} /> По методам оплаты
                    </h3>
                    {stats.methodData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stats.methodData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {stats.methodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke={theme === 'dark' ? undefined : '#fff'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                    }}
                                    formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className={`h-[300px] flex items-center justify-center ${t.textMuted}`}>
                            Нет данных за выбранный период
                        </div>
                    )}
                </div>
            </div>

            {/* Top Clients Table */}
            <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden`}>
                <div className={`p-4 sm:p-6 border-b ${t.border}`}>
                    <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                        <BarChart3 className="text-indigo-400" size={20} /> Топ клиентов по погашениям
                    </h3>
                </div>
                {stats.topClients.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} text-xs uppercase ${t.textMuted} font-medium`}>
                                <tr>
                                    <th className="px-4 sm:px-6 py-3">Клиент</th>
                                    <th className="px-4 sm:px-6 py-3 text-right">Сумма (USD)</th>
                                    <th className="px-4 sm:px-6 py-3 text-center">Операций</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${t.divide}`}>
                                {stats.topClients.map((client, index) => (
                                    <tr key={client.name} className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <span className={`font-medium ${t.text}`}>{client.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-emerald-500 font-bold">
                                            ${client.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className={`px-4 sm:px-6 py-4 text-center ${t.textMuted}`}>
                                            {client.count}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className={`p-12 text-center ${t.textMuted}`}>
                        Нет данных за выбранный период
                    </div>
                )}
            </div>
        </div>
    );
};
