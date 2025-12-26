import React, { useState, useMemo } from 'react';
import { Order, Expense } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { TrendingUp, DollarSign, Printer, FileSpreadsheet, Download } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface PnLProps {
    orders: Order[];
    expenses: Expense[];
    defaultExchangeRate?: number;
}

export const PnL: React.FC<PnLProps> = ({ orders, expenses, defaultExchangeRate = 12600 }) => {
    const toast = useToast();
    const [timeRange, setTimeRange] = useState<'all' | 'currentMonth' | 'lastMonth'>('currentMonth');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Normalize potentially invalid numeric values to avoid runtime crashes
    const safeNumber = (value: unknown, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastMonthYear = lastMonthDate.getFullYear();

        const filterFn = (dateStr: string) => {
            const d = new Date(dateStr);
            if (timeRange === 'all') return true;
            if (timeRange === 'currentMonth') {
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            }
            if (timeRange === 'lastMonth') {
                return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
            }
            return true;
        };

        return {
            orders: orders.filter(o => filterFn(o.date)),
            expenses: expenses.filter(e => filterFn(e.date))
        };
    }, [orders, expenses, timeRange]);

    // Calculations
    const revenue = filteredData.orders.reduce((sum, o) => sum + safeNumber(o.subtotalAmount), 0); // Excluding VAT

    const cogs = filteredData.orders.reduce((sumOrder, order) => {
        const orderCost = order.items.reduce((sumItem, item) => {
            const qty = safeNumber(item.quantity);
            const cost = safeNumber(item.costAtSale);
            return sumItem + (qty * cost);
        }, 0);
        return sumOrder + orderCost;
    }, 0);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    const operatingExpenses = filteredData.expenses.reduce((sum, e) => {
        // If exchangeRate exists, it means amount is in original currency.
        // If currency is UZS, convert to USD.
        // If exchangeRate is missing (legacy data), amount is already in USD.

        // Safety check for exchange rate to avoid division by zero
        const rate = safeNumber(e.exchangeRate) > 0 ? safeNumber(e.exchangeRate) : safeNumber(defaultExchangeRate, 12600);
        const amount = safeNumber(e.amount);

        const amountUSD = (e.currency === 'UZS')
            ? amount / rate
            : amount;

        return sum + amountUSD;
    }, 0);

    const netProfit = grossProfit - operatingExpenses;
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Waterfall Chart Data
    const waterfallData = [
        { name: 'Выручка', value: revenue, fill: '#3b82f6' }, // Blue
        { name: 'Себестоимость', value: -cogs, fill: '#f59e0b' }, // Orange
        { name: 'Валовая Прибыль', value: grossProfit, isSubtotal: true, fill: '#8b5cf6' }, // Purple (Intermediate)
        { name: 'Расходы', value: -operatingExpenses, fill: '#ef4444' }, // Red
        { name: 'Чистая Прибыль', value: netProfit, isTotal: true, fill: netProfit >= 0 ? '#10b981' : '#ef4444' } // Green/Red
    ];

    // Helper to calculate bar start points for waterfall effect
    let accumulated = 0;
    const chartData = waterfallData.map(item => {
        if (item.isTotal || item.isSubtotal) {
            accumulated = item.value; // Reset accumulation to the subtotal level
            return { ...item, start: 0, end: item.value };
        }
        const start = accumulated;
        accumulated += item.value;
        return { ...item, start, end: accumulated, size: Math.abs(item.value) };
    });

    const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleExportExcel = () => {
        const tableContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th colspan="2" style="background-color: #f0f0f0; font-size: 16px;">Отчет P&L (Profit and Loss)</th>
              </tr>
              <tr>
                <th colspan="2" style="background-color: #f0f0f0;">Период: ${timeRange === 'all' ? 'Все время' :
                timeRange === 'currentMonth' ? 'Текущий месяц' : 'Прошлый месяц'
            }</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Выручка (Revenue)</td>
                <td>${revenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Себестоимость (COGS)</td>
                <td>-${cogs.toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold; background-color: #e0e0e0;">
                <td>Валовая прибыль (Gross Profit)</td>
                <td>${grossProfit.toFixed(2)}</td>
              </tr>
               <tr>
                <td>Операционные расходы (OPEX)</td>
                <td>-${operatingExpenses.toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold; background-color: #d0f0c0;">
                <td>Чистая прибыль (Net Profit)</td>
                <td>${netProfit.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <br/>
          <h3>Детализация расходов</h3>
          <table border="1">
            <thead>
                <tr>
                    <th>Категория</th>
                    <th>Сумма</th>
                </tr>
            </thead>
            <tbody>
                ${filteredData.expenses.map(e => {
                const rate = safeNumber(e.exchangeRate) > 0 ? safeNumber(e.exchangeRate) : safeNumber(defaultExchangeRate, 12600);
                const amtUSD = e.currency === 'UZS' ? safeNumber(e.amount) / rate : safeNumber(e.amount);
                return `
                    <tr>
                        <td>${e.category}</td>
                        <td>${amtUSD.toFixed(2)}</td>
                    </tr>
                `}).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

        const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pnl_report_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);
        const element = document.getElementById('pnl-report-content');
        if (!element) return;
        setIsGeneratingPdf(true);

        try {
            // Create a canvas from the element
            const canvas = await html2canvas(element, {
                scale: 2, // Higher scale for better resolution
                backgroundColor: '#ffffff', // Force white background
                useCORS: true,
                logging: false,
                ignoreElements: (node) => node.classList.contains('print:hidden')
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            // Calculate ratio to fit width
            const ratio = pdfWidth / imgWidth;
            const finalHeight = imgHeight * ratio;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalHeight);
            pdf.save(`PnL_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            errorDev("PDF Generation failed", err);
            toast.error("Ошибка при создании PDF. Пожалуйста, воспользуйтесь функцией печати (Ctrl+P).");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in pb-20 print:p-0 print:pb-0 print:text-black">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 print:items-start">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight print:text-black">P&L Отчет</h2>
                    <p className="text-slate-400 mt-1 print:text-gray-600">Прибыли и убытки (USD) - {
                        timeRange === 'all' ? 'За все время' :
                            timeRange === 'currentMonth' ? 'За этот месяц' : 'За прошлый месяц'
                    }</p>
                </div>

                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/50 px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                        title="Экспорт в Excel"
                    >
                        <FileSpreadsheet size={18} />
                        <span className="hidden sm:inline">Excel</span>
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPdf}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                        title="Скачать PDF файл"
                    >
                        {isGeneratingPdf ? (
                            <span className="animate-spin">⌛</span>
                        ) : (
                            <Download size={18} />
                        )}
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                        title="Печать / Сохранить как PDF (Браузер)"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Печать</span>
                    </button>

                    <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex ml-2">
                        <button
                            onClick={() => setTimeRange('currentMonth')}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${timeRange === 'currentMonth' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Этот месяц
                        </button>
                        <button
                            onClick={() => setTimeRange('lastMonth')}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${timeRange === 'lastMonth' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Прошлый
                        </button>
                        <button
                            onClick={() => setTimeRange('all')}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${timeRange === 'all' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Все время
                        </button>
                    </div>
                </div>
            </div>

            {/* Wrapper for PDF Capture */}
            <div id="pnl-report-content" className="space-y-8 print:space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg print:bg-white print:border-gray-300 print:shadow-none">
                        <p className="text-slate-400 text-sm font-medium uppercase print:text-gray-600">Чистая выручка</p>
                        <h3 className="text-3xl font-bold text-blue-400 mt-2 font-mono print:text-black">{formatCurrency(revenue)}</h3>
                        <p className="text-xs text-slate-500 mt-1">Без учета НДС</p>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg print:bg-white print:border-gray-300 print:shadow-none">
                        <p className="text-slate-400 text-sm font-medium uppercase print:text-gray-600">Валовая прибыль</p>
                        <div className="flex items-end gap-2 mt-2">
                            <h3 className="text-3xl font-bold text-purple-400 font-mono print:text-black">{formatCurrency(grossProfit)}</h3>
                            <span className="text-sm text-slate-500 mb-1">({grossMargin.toFixed(1)}%)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Выручка - Себестоимость</p>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg print:bg-white print:border-gray-300 print:shadow-none">
                        <p className="text-slate-400 text-sm font-medium uppercase print:text-gray-600">Операц. Расходы</p>
                        <h3 className="text-3xl font-bold text-red-400 mt-2 font-mono print:text-black">{formatCurrency(operatingExpenses)}</h3>
                        <p className="text-xs text-slate-500 mt-1">OPEX</p>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden print:bg-white print:border-gray-300 print:shadow-none">
                        <div className="absolute right-0 top-0 p-4 opacity-5 print:hidden">
                            <DollarSign size={100} />
                        </div>
                        <p className="text-slate-400 text-sm font-medium uppercase print:text-gray-600">Чистая Прибыль</p>
                        <div className="flex items-end gap-2 mt-2">
                            <h3 className={`text-3xl font-bold font-mono ${netProfit >= 0 ? 'text-emerald-400 print:text-black' : 'text-red-400 print:text-black'}`}>
                                {formatCurrency(netProfit)}
                            </h3>
                            <span className="text-sm text-slate-500 mb-1">({netProfitMargin.toFixed(1)}%)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Bottom Line</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
                    {/* Waterfall Chart - Keep in print if possible, but often responsive charts struggle in print. Tailwind print: modifiers can help if needed */}
                    <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg print:bg-white print:border-gray-300 print:shadow-none print:mb-6 print:break-inside-avoid">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
                            <TrendingUp size={20} className="text-emerald-500 print:text-black" /> Структура Прибыли
                        </h3>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                        cursor={{ fill: 'transparent' }}
                                        formatter={(value: number) => formatCurrency(Math.abs(value))}
                                    />
                                    <ReferenceLine y={0} stroke="#475569" />
                                    <Bar dataKey="start" stackId="a" fill="transparent" />
                                    <Bar dataKey="size" stackId="a">
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                    <Bar dataKey="end" hide={true} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Detailed Breakdown Table */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg flex flex-col print:bg-white print:border-gray-300 print:shadow-none print:break-inside-avoid">
                        <h3 className="text-xl font-bold text-white mb-6 print:text-black">Детализация</h3>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">

                            {/* Revenue Section */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-blue-400 print:text-black">ВЫРУЧКА (Продажи)</span>
                                    <span className="font-mono text-white print:text-black">{formatCurrency(revenue)}</span>
                                </div>
                                <div className="pl-4 text-sm text-slate-400 space-y-1 border-l-2 border-slate-700 print:text-gray-600 print:border-gray-300">
                                    <div className="flex justify-between">
                                        <span>Продажа товара</span>
                                        <span>{formatCurrency(revenue)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* COGS Section */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-amber-400 print:text-black">(-) СЕБЕСТОИМОСТЬ</span>
                                    <span className="font-mono text-white print:text-black">{formatCurrency(cogs)}</span>
                                </div>
                                <div className="pl-4 text-sm text-slate-400 space-y-1 border-l-2 border-slate-700 print:text-gray-600 print:border-gray-300">
                                    <div className="flex justify-between">
                                        <span>Закупочная стоимость</span>
                                        <span>{formatCurrency(cogs)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-700 my-2 print:border-gray-300"></div>

                            {/* Gross Profit */}
                            <div className="flex justify-between items-center bg-slate-700/30 p-2 rounded print:bg-gray-100">
                                <span className="font-bold text-purple-400 print:text-black">(=) ВАЛОВАЯ ПРИБЫЛЬ</span>
                                <span className="font-mono text-white font-bold print:text-black">{formatCurrency(grossProfit)}</span>
                            </div>

                            {/* OPEX Section */}
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-red-400 print:text-black">(-) РАСХОДЫ (OPEX)</span>
                                    <span className="font-mono text-white print:text-black">{formatCurrency(operatingExpenses)}</span>
                                </div>
                                <div className="pl-4 text-sm text-slate-400 space-y-1 border-l-2 border-slate-700 print:text-gray-600 print:border-gray-300">
                                    {filteredData.expenses.length === 0 ? (
                                        <span className="text-slate-600 italic">Нет расходов за период</span>
                                    ) : (
                                        filteredData.expenses.map(e => (
                                            <div key={e.id} className="flex justify-between">
                                                <span>{e.category}</span>
                                                <span>
                                                    {formatCurrency(
                                                        e.currency === 'UZS'
                                                            ? safeNumber(e.amount) / (safeNumber(e.exchangeRate) > 0 ? safeNumber(e.exchangeRate) : safeNumber(defaultExchangeRate, 12600))
                                                            : safeNumber(e.amount)
                                                    )}
                                                    {e.currency === 'UZS' && (
                                                        <span className="text-xs text-slate-500 ml-1">
                                                            ({safeNumber(e.amount).toLocaleString()} UZS)
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-700 my-2 print:border-gray-300"></div>

                            {/* Net Profit */}
                            <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded border border-emerald-500/20 print:bg-green-50 print:border-green-200">
                                <span className="font-bold text-emerald-400 print:text-black">(=) ЧИСТАЯ ПРИБЫЛЬ</span>
                                <span className="font-mono text-emerald-300 font-bold text-lg print:text-black">{formatCurrency(netProfit)}</span>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};