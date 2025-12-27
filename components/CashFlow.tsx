import React, { useState, useMemo } from 'react';
import { Order, Expense } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, Calendar, DollarSign, Tag, Printer, FileSpreadsheet, Download } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../contexts/ThemeContext';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface CashFlowProps {
    orders: Order[];
    expenses: Expense[];
    onAddExpense: (expense: Expense) => void;
}

interface Transaction {
    id: string;
    date: string; // ISO string
    dateObj: Date;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category?: string;
}

export const CashFlow: React.FC<CashFlowProps> = ({ orders, expenses, onAddExpense }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const toast = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        amount: 0,
        category: 'Прочее',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Merge and Sort Transactions
    const transactions: Transaction[] = useMemo(() => {
        const incomeTx: Transaction[] = orders.map(o => ({
            id: o.id,
            date: o.date,
            dateObj: new Date(o.date),
            type: 'income',
            amount: o.totalAmount,
            description: `Заказ от ${o.customerName}`,
            category: 'Продажа'
        }));

        const expenseTx: Transaction[] = expenses.map(e => ({
            id: e.id,
            date: e.date,
            dateObj: new Date(e.date),
            type: 'expense',
            amount: e.amount,
            description: e.description,
            category: e.category
        }));

        return [...incomeTx, ...expenseTx].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [orders, expenses]);

    // Stats
    const num = (v: any): number => {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        if (typeof v === 'string') {
            const p = parseFloat(v.replace(/[^\d.-]/g, ''));
            return isFinite(p) ? p : 0;
        }
        return 0;
    };

    const totalIncome = useMemo(() => {
        return orders.reduce((sum, o) => {
            // Cash Flow is USD focused, so we convert if needed.
            // But for sales, totalAmount IS USD.
            return sum + num(o.totalAmount);
        }, 0);
    }, [orders]);

    const totalExpense = useMemo(() => {
        return expenses.reduce((sum, e) => {
            const amt = num(e.amount);
            if (e.currency === 'UZS' && e.exchangeRate > 0) return sum + (amt / e.exchangeRate);
            return sum + amt;
        }, 0);
    }, [expenses]);

    const netCashFlow = totalIncome - totalExpense;

    // Chart Data (Last 14 days grouped by day)
    const chartData = useMemo(() => {
        // Re-loop specifically for the chart array
        const result = [];
        const today = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];

            let dayIncome = 0;
            let dayExpense = 0;

            transactions.forEach(t => {
                if (t.date.startsWith(dateKey)) {
                    if (t.type === 'income') dayIncome += t.amount;
                    else dayExpense += t.amount;
                }
            });

            result.push({
                name: dateKey.split('-').slice(1).join('.'),
                income: dayIncome,
                expense: dayExpense,
                net: dayIncome - dayExpense
            });
        }
        return result;
    }, [transactions]);

    const handleSaveExpense = () => {
        if (!newExpense.amount || !newExpense.description) return;

        const expense: Expense = {
            id: `EXP-${Date.now()}`,
            date: new Date(newExpense.date!).toISOString(),
            amount: Number(newExpense.amount),
            category: newExpense.category || 'Прочее',
            description: newExpense.description!,
            paymentMethod: 'cash',
            currency: 'USD',
            exchangeRate: 1
        };

        onAddExpense(expense);
        setShowModal(false);
        setNewExpense({ amount: 0, category: 'Прочее', description: '', date: new Date().toISOString().split('T')[0] });
    };

    const handleExportExcel = () => {
        if (transactions.length === 0) return;

        const tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              <th style="background-color: #f0f0f0;">Дата</th>
              <th style="background-color: #f0f0f0;">Тип</th>
              <th style="background-color: #f0f0f0;">Категория</th>
              <th style="background-color: #f0f0f0;">Описание</th>
              <th style="background-color: #f0f0f0;">Сумма (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td>${new Date(tx.date).toLocaleDateString('ru-RU')}</td>
                <td>${tx.type === 'income' ? 'Доход' : 'Расход'}</td>
                <td>${tx.category}</td>
                <td>${tx.description}</td>
                <td>${(tx.type === 'expense' ? -1 : 1) * tx.amount}</td>
              </tr>
            `).join('')}
            <tr>
                <td colspan="4" style="font-weight: bold; text-align: right;">ИТОГО ПОТОК:</td>
                <td style="font-weight: bold;">${netCashFlow.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

        const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cash_flow_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = async () => {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);
        const element = document.getElementById('cashflow-report-content');
        if (!element) return;
        setIsGeneratingPdf(true);

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                ignoreElements: (node) => node.classList.contains('print:hidden')
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pdfWidth / imgWidth;
            const finalHeight = imgHeight * ratio;

            // Handle multi-page if content is very long (basic logic: cut if too long, but here we shrink fit or 1 page for dashboard)
            // For reports, often nice to fit on one page if possible, or just print the top part.
            // With this method, long lists will be captured as a very tall image and scaled down, which might look small.
            // For long lists, standard browser Print is better. 

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalHeight);
            pdf.save(`CashFlow_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            errorDev("PDF Generation failed", err);
            toast.error("Ошибка при создании PDF. Пожалуйста, воспользуйтесь функцией печати (Ctrl+P).");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-20 print:p-0 print:pb-0 print:text-black">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className={`text-3xl font-bold ${t.text} tracking-tight print:text-black`}>Cash Flow</h2>
                    <p className={`${t.textMuted} mt-1 print:text-gray-600`}>Отчет о движении денежных средств (USD)</p>
                </div>
                <div className="flex gap-2 print:hidden">
                    <button
                        onClick={handleExportExcel}
                        className={`bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 border border-emerald-500/50 px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}
                        title="Экспорт в Excel"
                    >
                        <FileSpreadsheet size={18} />
                        <span className="hidden sm:inline">Excel</span>
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPdf}
                        className={`${t.bgButton} ${t.text} px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}
                        title="Скачать PDF файл"
                    >
                        {isGeneratingPdf ? <span className="animate-spin">⌛</span> : <Download size={18} />}
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className={`${t.bgButton} ${t.text} px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}
                        title="Печать / Сохранить как PDF (Браузер)"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Печать</span>
                    </button>

                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">Расход</span>
                    </button>
                </div>
            </div>

            <div id="cashflow-report-content" className="space-y-6">
                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 print:text-black print:bg-transparent">
                                <ArrowUpRight size={24} />
                            </div>
                            <span className={`${t.textMuted} font-medium print:text-gray-600`}>Всего поступлений</span>
                        </div>
                        <h3 className={`text-3xl font-bold ${t.text} font-mono print:text-black`}>${totalIncome.toLocaleString()}</h3>
                    </div>

                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg text-red-500 print:text-black print:bg-transparent">
                                <ArrowDownRight size={24} />
                            </div>
                            <span className={`${t.textMuted} font-medium print:text-gray-600`}>Всего расходов</span>
                        </div>
                        <h3 className={`text-3xl font-bold ${t.text} font-mono print:text-black`}>${totalExpense.toLocaleString()}</h3>
                    </div>

                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg relative overflow-hidden print:bg-white print:border-gray-300 print:shadow-none`}>
                        <div className="absolute right-0 top-0 p-4 opacity-5 print:hidden">
                            <Wallet size={100} />
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 print:text-black print:bg-transparent">
                                <Wallet size={24} />
                            </div>
                            <span className={`${t.textMuted} font-medium print:text-gray-600`}>Чистый поток</span>
                        </div>
                        <h3 className={`text-3xl font-bold font-mono ${netCashFlow >= 0 ? 'text-blue-500' : 'text-red-500'} print:text-black`}>
                            {netCashFlow >= 0 ? '+' : ''}${netCashFlow.toLocaleString()}
                        </h3>
                    </div>
                </div>

                {/* Chart - Hide on print usually as they don't render well without specific size config, or keep if responsive */}
                <div className={`${t.bgCard} border ${t.border} rounded-2xl p-6 shadow-lg print:bg-white print:border-gray-300 print:shadow-none print:break-inside-avoid`}>
                    <h3 className={`text-xl font-bold ${t.text} mb-6 print:text-black`}>Динамика за 14 дней</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <XAxis 
                                    dataKey="name" 
                                    stroke={theme === 'dark' ? "#64748b" : "#94a3b8"} 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                />
                                <YAxis 
                                    stroke={theme === 'dark' ? "#64748b" : "#94a3b8"} 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickFormatter={val => `$${val}`} 
                                />
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                    }}
                                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                                />
                                <ReferenceLine y={0} stroke={theme === 'dark' ? "#475569" : "#cbd5e1"} />
                                <Bar dataKey="income" name="Доход" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Расход" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Transaction History Table */}
                <div className={`${t.bgCard} border ${t.border} rounded-2xl overflow-hidden shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                    <div className={`p-6 border-b ${t.border} ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} print:bg-gray-100 print:border-gray-300`}>
                        <h3 className={`text-xl font-bold ${t.text} print:text-black`}>История операций</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} text-xs uppercase ${t.textMuted} font-medium print:bg-gray-200 print:text-gray-700`}>
                                <tr>
                                    <th className="px-6 py-4">Дата</th>
                                    <th className="px-6 py-4">Тип</th>
                                    <th className="px-6 py-4">Категория</th>
                                    <th className="px-6 py-4">Описание</th>
                                    <th className="px-6 py-4 text-right">Сумма (USD)</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${t.divide} text-sm print:divide-gray-300`}>
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className={`${t.hover} transition-colors print:text-black`}>
                                        <td className={`px-6 py-4 font-mono ${t.textMuted} print:text-black`}>
                                            {new Date(tx.date).toLocaleDateString('ru-RU')}
                                        </td>
                                        <td className="px-6 py-4">
                                            {tx.type === 'income' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs print:text-green-700 print:bg-transparent print:border-none print:p-0">
                                                    <ArrowUpRight size={12} /> Доход
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs print:text-red-700 print:bg-transparent print:border-none print:p-0">
                                                    <ArrowDownRight size={12} /> Расход
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 ${t.textMuted} print:text-black`}>{tx.category}</td>
                                        <td className={`px-6 py-4 ${t.textMuted} print:text-gray-600`}>{tx.description}</td>
                                        <td className={`px-6 py-4 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-500 print:text-black' : 'text-red-500 print:text-black'}`}>
                                            {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className={`px-6 py-8 text-center ${t.textMuted}`}>Операций нет</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Expense Modal - Hidden on print */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-md border ${t.border} shadow-2xl overflow-hidden`}>
                        <div className={`p-6 border-b ${t.border} ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} flex justify-between items-center`}>
                            <h3 className={`text-xl font-bold ${t.text}`}>Новый расход</h3>
                            <button onClick={() => setShowModal(false)} className={`${t.textMuted} hover:${t.text}`}>&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className={`text-xs font-medium ${t.textMuted}`}>Дата</label>
                                <div className="relative">
                                    <Calendar className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                                    <input
                                        type="date"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-3 py-2 ${t.text} focus:ring-2 focus:ring-red-500 outline-none`}
                                        value={newExpense.date}
                                        onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className={`text-xs font-medium ${t.textMuted}`}>Сумма (USD)</label>
                                <div className="relative">
                                    <DollarSign className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-3 py-2 ${t.text} focus:ring-2 focus:ring-red-500 outline-none`}
                                        placeholder="0.00"
                                        value={newExpense.amount || ''}
                                        onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className={`text-xs font-medium ${t.textMuted}`}>Категория</label>
                                <div className="relative">
                                    <Tag className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                                    <select
                                        className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-3 py-2 ${t.text} focus:ring-2 focus:ring-red-500 outline-none appearance-none`}
                                        value={newExpense.category}
                                        onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                                    >
                                        <option>Аренда</option>
                                        <option>Зарплата</option>
                                        <option>Логистика</option>
                                        <option>Закупка товара</option>
                                        <option>Коммунальные</option>
                                        <option>Прочее</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className={`text-xs font-medium ${t.textMuted}`}>Описание</label>
                                <textarea
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none`}
                                    placeholder="Например: Оплата за доставку труб..."
                                    value={newExpense.description}
                                    onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className={`p-6 border-t ${t.border} flex justify-end gap-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                            <button onClick={() => setShowModal(false)} className={`${t.textMuted} hover:${t.text} px-4 py-2`}>Отмена</button>
                            <button
                                onClick={handleSaveExpense}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-red-600/20"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};