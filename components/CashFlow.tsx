import React, { useState, useMemo } from 'react';
import { Order, Expense, AppSettings, Transaction as TransactionType } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { validateUSD } from '../utils/finance';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, Calendar, DollarSign, Tag, Printer, FileSpreadsheet, Download, CreditCard, Building2, Banknote, RefreshCw } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../contexts/ThemeContext';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface CashFlowProps {
    orders: Order[];
    expenses: Expense[];
    settings: AppSettings;
    onAddExpense: (expense: Expense) => void;
    transactions?: TransactionType[]; // Добавляем транзакции для анализа по счетам
}

interface Transaction {
    id: string;
    date: string; // ISO string
    dateObj: Date;
    type: 'income' | 'expense';
    amount: number; // В выбранной валюте
    amountUSD: number;
    amountUZS: number;
    description: string;
    category?: string;
    method?: 'cash' | 'bank' | 'card';
    currency?: 'USD' | 'UZS';
}

type DisplayCurrency = 'USD' | 'UZS';

export const CashFlow: React.FC<CashFlowProps> = ({ orders, expenses, settings, onAddExpense, transactions: rawTransactions }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const toast = useToast();
    const [showModal, setShowModal] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('UZS');
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        amount: 0,
        category: 'Прочее',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const rate = settings.defaultExchangeRate || 12800;

    // Merge and Sort Transactions с поддержкой обеих валют
    const transactions: Transaction[] = useMemo(() => {
        const incomeTx: Transaction[] = orders.map(o => {
            const correctedAmount = validateUSD(o.totalAmount, settings.defaultExchangeRate, { id: o.id, type: 'order' });
            const amountUZS = o.totalAmountUZS || correctedAmount * rate;
            return {
                id: o.id,
                date: o.date,
                dateObj: new Date(o.date),
                type: 'income' as const,
                amount: displayCurrency === 'USD' ? correctedAmount : amountUZS,
                amountUSD: correctedAmount,
                amountUZS: amountUZS,
                description: `Заказ от ${o.customerName}`,
                category: 'Продажа',
                method: o.paymentMethod === 'bank' ? 'bank' : o.paymentMethod === 'card' ? 'card' : 'cash',
                currency: o.paymentCurrency || 'USD'
            };
        });

        const expenseTx: Transaction[] = expenses.map(e => {
            let amountUSD = 0;
            let amountUZS = 0;
            const expRate = e.exchangeRate || settings.defaultExchangeRate || rate;
            
            if (e.currency === 'UZS') {
                amountUZS = e.amount || 0;
                amountUSD = amountUZS / expRate;
            } else {
                amountUSD = validateUSD(e.amount, settings.defaultExchangeRate, { id: e.id, type: 'expense' });
                amountUZS = amountUSD * expRate;
            }

            return {
                id: e.id,
                date: e.date,
                dateObj: new Date(e.date),
                type: 'expense' as const,
                amount: displayCurrency === 'USD' ? amountUSD : amountUZS,
                amountUSD,
                amountUZS,
                description: e.description,
                category: e.category,
                method: e.paymentMethod || 'cash',
                currency: e.currency || 'USD'
            };
        });

        return [...incomeTx, ...expenseTx].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [orders, expenses, settings.defaultExchangeRate, displayCurrency, rate]);

    // Анализ по счетам (из rawTransactions)
    const accountAnalysis = useMemo(() => {
        const analysis = {
            cashUSD: { income: 0, expense: 0, balance: 0 },
            cashUZS: { income: 0, expense: 0, balance: 0 },
            bankUZS: { income: 0, expense: 0, balance: 0 },
            cardUZS: { income: 0, expense: 0, balance: 0 }
        };

        // Анализ из заказов
        orders.forEach(o => {
            const amountUSD = validateUSD(o.totalAmount, settings.defaultExchangeRate, { id: o.id, type: 'order' });
            const amountUZS = o.totalAmountUZS || amountUSD * rate;
            
            if (o.paymentMethod === 'bank') {
                analysis.bankUZS.income += amountUZS;
            } else if (o.paymentMethod === 'card') {
                analysis.cardUZS.income += amountUZS;
            } else if (o.paymentCurrency === 'UZS') {
                analysis.cashUZS.income += amountUZS;
            } else {
                analysis.cashUSD.income += amountUSD;
            }
        });

        // Анализ из расходов
        expenses.forEach(e => {
            const expRate = e.exchangeRate || settings.defaultExchangeRate || rate;
            const amountUZS = e.currency === 'UZS' ? (e.amount || 0) : (e.amount || 0) * expRate;
            const amountUSD = e.currency === 'USD' ? (e.amount || 0) : (e.amount || 0) / expRate;
            
            if (e.paymentMethod === 'bank') {
                analysis.bankUZS.expense += amountUZS;
            } else if (e.paymentMethod === 'card') {
                analysis.cardUZS.expense += amountUZS;
            } else if (e.currency === 'UZS') {
                analysis.cashUZS.expense += amountUZS;
            } else {
                analysis.cashUSD.expense += amountUSD;
            }
        });

        // Анализ из транзакций (payments)
        (rawTransactions || []).forEach(tx => {
            const txRate = tx.exchangeRate || settings.defaultExchangeRate || rate;
            const isIncome = tx.type === 'client_payment';
            const isExpense = tx.type === 'supplier_payment' || tx.type === 'expense';
            
            if (tx.method === 'bank') {
                const amountUZS = tx.currency === 'UZS' ? tx.amount : tx.amount * txRate;
                if (isIncome) analysis.bankUZS.income += amountUZS;
                if (isExpense) analysis.bankUZS.expense += amountUZS;
            } else if (tx.method === 'card') {
                const amountUZS = tx.currency === 'UZS' ? tx.amount : tx.amount * txRate;
                if (isIncome) analysis.cardUZS.income += amountUZS;
                if (isExpense) analysis.cardUZS.expense += amountUZS;
            } else if (tx.currency === 'UZS') {
                if (isIncome) analysis.cashUZS.income += tx.amount;
                if (isExpense) analysis.cashUZS.expense += tx.amount;
            } else {
                if (isIncome) analysis.cashUSD.income += tx.amount;
                if (isExpense) analysis.cashUSD.expense += tx.amount;
            }
        });

        // Расчёт балансов
        analysis.cashUSD.balance = analysis.cashUSD.income - analysis.cashUSD.expense;
        analysis.cashUZS.balance = analysis.cashUZS.income - analysis.cashUZS.expense;
        analysis.bankUZS.balance = analysis.bankUZS.income - analysis.bankUZS.expense;
        analysis.cardUZS.balance = analysis.cardUZS.income - analysis.cardUZS.expense;

        return analysis;
    }, [orders, expenses, rawTransactions, settings.defaultExchangeRate, rate]);

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
        return transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
    }, [transactions]);

    const totalExpense = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
    }, [transactions]);

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
            id: IdGenerator.expense(),
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

    const formatAmount = (amount: number) => {
        if (displayCurrency === 'USD') {
            return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `${amount.toLocaleString()} сум`;
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-20 print:p-0 print:pb-0 print:text-black">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className={`text-3xl font-bold ${t.text} tracking-tight print:text-black`}>Cash Flow</h2>
                    <p className={`${t.textMuted} mt-1 print:text-gray-600`}>Отчет о движении денежных средств</p>
                </div>
                <div className="flex gap-2 print:hidden">
                    {/* Переключатель валюты */}
                    <div className={`flex rounded-lg border ${t.border} overflow-hidden`}>
                        <button
                            onClick={() => setDisplayCurrency('UZS')}
                            className={`px-3 py-2 text-sm font-medium transition-all ${
                                displayCurrency === 'UZS' 
                                    ? 'bg-blue-500 text-white' 
                                    : `${t.bgCard} ${t.textMuted} hover:${t.text}`
                            }`}
                        >
                            UZS
                        </button>
                        <button
                            onClick={() => setDisplayCurrency('USD')}
                            className={`px-3 py-2 text-sm font-medium transition-all ${
                                displayCurrency === 'USD' 
                                    ? 'bg-emerald-500 text-white' 
                                    : `${t.bgCard} ${t.textMuted} hover:${t.text}`
                            }`}
                        >
                            USD
                        </button>
                    </div>

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
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 print:text-black print:bg-transparent">
                                <ArrowUpRight size={24} />
                            </div>
                            <span className={`${t.textMuted} font-medium print:text-gray-600`}>Всего поступлений</span>
                        </div>
                        <h3 className={`text-3xl font-bold ${t.text} font-mono print:text-black`}>{formatAmount(totalIncome)}</h3>
                    </div>

                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg text-red-500 print:text-black print:bg-transparent">
                                <ArrowDownRight size={24} />
                            </div>
                            <span className={`${t.textMuted} font-medium print:text-gray-600`}>Всего расходов</span>
                        </div>
                        <h3 className={`text-3xl font-bold ${t.text} font-mono print:text-black`}>{formatAmount(totalExpense)}</h3>
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
                            {netCashFlow >= 0 ? '+' : ''}{formatAmount(netCashFlow)}
                        </h3>
                    </div>
                </div>

                {/* Анализ по счетам */}
                <div className={`${t.bgCard} border ${t.border} rounded-2xl p-6 shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                    <h3 className={`text-xl font-bold ${t.text} mb-4 print:text-black flex items-center gap-2`}>
                        <Building2 size={20} className="text-blue-500" />
                        Анализ по счетам и валютам
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Касса USD */}
                        <div className={`p-4 rounded-xl border ${t.border} ${theme === 'dark' ? 'bg-emerald-500/5' : 'bg-emerald-50'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Banknote size={18} className="text-emerald-500" />
                                <span className={`font-medium ${t.text}`}>Касса USD</span>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Приход:</span>
                                    <span className="text-emerald-500 font-mono">${accountAnalysis.cashUSD.income.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Расход:</span>
                                    <span className="text-red-500 font-mono">${accountAnalysis.cashUSD.expense.toLocaleString()}</span>
                                </div>
                                <div className={`flex justify-between pt-2 border-t ${t.border}`}>
                                    <span className={`font-medium ${t.text}`}>Остаток:</span>
                                    <span className={`font-mono font-bold ${accountAnalysis.cashUSD.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        ${accountAnalysis.cashUSD.balance.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Касса UZS */}
                        <div className={`p-4 rounded-xl border ${t.border} ${theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Banknote size={18} className="text-blue-500" />
                                <span className={`font-medium ${t.text}`}>Касса UZS</span>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Приход:</span>
                                    <span className="text-emerald-500 font-mono">{accountAnalysis.cashUZS.income.toLocaleString()} сум</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Расход:</span>
                                    <span className="text-red-500 font-mono">{accountAnalysis.cashUZS.expense.toLocaleString()} сум</span>
                                </div>
                                <div className={`flex justify-between pt-2 border-t ${t.border}`}>
                                    <span className={`font-medium ${t.text}`}>Остаток:</span>
                                    <span className={`font-mono font-bold ${accountAnalysis.cashUZS.balance >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                        {accountAnalysis.cashUZS.balance.toLocaleString()} сум
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Р/С (Банк) */}
                        <div className={`p-4 rounded-xl border ${t.border} ${theme === 'dark' ? 'bg-purple-500/5' : 'bg-purple-50'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Building2 size={18} className="text-purple-500" />
                                <span className={`font-medium ${t.text}`}>Р/С (Банк)</span>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Приход:</span>
                                    <span className="text-emerald-500 font-mono">{accountAnalysis.bankUZS.income.toLocaleString()} сум</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Расход:</span>
                                    <span className="text-red-500 font-mono">{accountAnalysis.bankUZS.expense.toLocaleString()} сум</span>
                                </div>
                                <div className={`flex justify-between pt-2 border-t ${t.border}`}>
                                    <span className={`font-medium ${t.text}`}>Остаток:</span>
                                    <span className={`font-mono font-bold ${accountAnalysis.bankUZS.balance >= 0 ? 'text-purple-500' : 'text-red-500'}`}>
                                        {accountAnalysis.bankUZS.balance.toLocaleString()} сум
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Карта */}
                        <div className={`p-4 rounded-xl border ${t.border} ${theme === 'dark' ? 'bg-amber-500/5' : 'bg-amber-50'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <CreditCard size={18} className="text-amber-500" />
                                <span className={`font-medium ${t.text}`}>Карта</span>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Приход:</span>
                                    <span className="text-emerald-500 font-mono">{accountAnalysis.cardUZS.income.toLocaleString()} сум</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className={t.textMuted}>Расход:</span>
                                    <span className="text-red-500 font-mono">{accountAnalysis.cardUZS.expense.toLocaleString()} сум</span>
                                </div>
                                <div className={`flex justify-between pt-2 border-t ${t.border}`}>
                                    <span className={`font-medium ${t.text}`}>Остаток:</span>
                                    <span className={`font-mono font-bold ${accountAnalysis.cardUZS.balance >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                        {accountAnalysis.cardUZS.balance.toLocaleString()} сум
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className={`${t.bgCard} border ${t.border} rounded-2xl p-6 shadow-lg print:bg-white print:border-gray-300 print:shadow-none print:break-inside-avoid`}>
                    <h3 className={`text-xl font-bold ${t.text} mb-6 print:text-black`}>Динамика за 14 дней ({displayCurrency})</h3>
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
                                    tickFormatter={val => displayCurrency === 'USD' ? `$${val}` : `${(val/1000).toFixed(0)}k`} 
                                />
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                    }}
                                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                                    formatter={(value: number) => formatAmount(value)}
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
                                    <th className="px-6 py-4 text-right">Сумма ({displayCurrency})</th>
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
                                            {tx.type === 'income' ? '+' : '-'}{formatAmount(tx.amount)}
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