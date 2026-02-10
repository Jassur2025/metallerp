import React, { useState, useMemo } from 'react';
import { Order, Expense, FixedAsset, ExpenseCategory } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { TrendingUp, DollarSign, Printer, FileSpreadsheet, Download } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface PnLProps {
    orders: Order[];
    expenses: Expense[];
    fixedAssets?: FixedAsset[];
    expenseCategories?: ExpenseCategory[];
    defaultExchangeRate?: number;
}

export const PnL: React.FC<PnLProps> = ({ orders, expenses, fixedAssets = [], expenseCategories = [], defaultExchangeRate = 12600 }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
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

    // FIX #5: OPEX breakdown by IFRS categories
    const categoryMap = useMemo(() => {
        const map: Record<string, string> = {};
        expenseCategories.forEach(c => { map[c.id] = c.pnlCategory; });
        return map;
    }, [expenseCategories]);

    const opexByCategory = useMemo(() => {
        const result = { administrative: 0, operational: 0, commercial: 0 };
        filteredData.expenses.forEach(e => {
            const rate = safeNumber(e.exchangeRate) > 0 ? safeNumber(e.exchangeRate) : safeNumber(defaultExchangeRate, 12600);
            const amountUSD = (e.currency === 'UZS') ? safeNumber(e.amount) / rate : safeNumber(e.amount);
            const pnlCat = categoryMap[e.category] || 'administrative';
            if (pnlCat === 'operational') result.operational += amountUSD;
            else if (pnlCat === 'commercial') result.commercial += amountUSD;
            else result.administrative += amountUSD;
        });
        return result;
    }, [filteredData.expenses, categoryMap, defaultExchangeRate]);

    // FIX #4: Амортизация ОС за период
    const depreciation = useMemo(() => {
        if (!fixedAssets.length) return 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Для "все время" считаем полную накопленную амортизацию
        if (timeRange === 'all') {
            return fixedAssets.reduce((sum, fa) => sum + safeNumber(fa.accumulatedDepreciation), 0);
        }

        // Для месяца считаем месячную амортизацию = годовая / 12
        const targetMonth = timeRange === 'currentMonth' ? currentMonth : (currentMonth === 0 ? 11 : currentMonth - 1);
        const targetYear = timeRange === 'currentMonth' ? currentYear : (currentMonth === 0 ? currentYear - 1 : currentYear);

        return fixedAssets.reduce((sum, fa) => {
            const purchaseDate = new Date(fa.purchaseDate);
            // Актив должен быть куплен до конца целевого месяца
            const endOfTarget = new Date(targetYear, targetMonth + 1, 0);
            if (purchaseDate > endOfTarget) return sum;
            // Земля не амортизируется
            if (safeNumber(fa.depreciationRate) === 0) return sum;
            const monthlyDep = (safeNumber(fa.purchaseCost) * safeNumber(fa.depreciationRate) / 100) / 12;
            return sum + monthlyDep;
        }, 0);
    }, [fixedAssets, timeRange]);

    const netProfit = grossProfit - operatingExpenses - depreciation;
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Waterfall Chart Data
    const waterfallData = [
        { name: 'Выручка', value: revenue, fill: '#3b82f6' },
        { name: 'Себестоимость', value: -cogs, fill: '#f59e0b' },
        { name: 'Валовая Прибыль', value: grossProfit, isSubtotal: true, fill: '#8b5cf6' },
        { name: 'Расходы', value: -operatingExpenses, fill: '#ef4444' },
        ...(depreciation > 0 ? [{ name: 'Амортизация', value: -depreciation, fill: '#fb923c' }] : []),
        { name: 'Чистая Прибыль', value: netProfit, isTotal: true, fill: netProfit >= 0 ? '#10b981' : '#ef4444' }
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
              ${depreciation > 0 ? `<tr>
                <td>Амортизация ОС (Depreciation)</td>
                <td>-${depreciation.toFixed(2)}</td>
              </tr>` : ''}
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
                    <h2 className={`text-3xl font-bold ${t.text} tracking-tight print:text-black`}>P&L Отчет</h2>
                    <p className={`${t.textMuted} mt-1 print:text-gray-600`}>Прибыли и убытки (USD) - {
                        timeRange === 'all' ? 'За все время' :
                            timeRange === 'currentMonth' ? 'За этот месяц' : 'За прошлый месяц'
                    }</p>
                </div>

                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 border border-emerald-500/50 px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                        title="Экспорт в Excel"
                    >
                        <FileSpreadsheet size={18} />
                        <span className="hidden sm:inline">Excel</span>
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPdf}
                        className={`${t.bgButtonSecondary} ${t.text} px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}
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
                        className={`${t.bgButtonSecondary} ${t.text} px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}
                        title="Печать / Сохранить как PDF (Браузер)"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Печать</span>
                    </button>

                    <div className={`${t.bgCard} p-1 rounded-lg border ${t.border} flex ml-2`}>
                        <button
                            onClick={() => setTimeRange('currentMonth')}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${timeRange === 'currentMonth' ? `${t.bgButton} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`}`}
                        >
                            Этот месяц
                        </button>
                        <button
                            onClick={() => setTimeRange('lastMonth')}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${timeRange === 'lastMonth' ? `${t.bgButton} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`}`}
                        >
                            Прошлый
                        </button>
                        <button
                            onClick={() => setTimeRange('all')}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${timeRange === 'all' ? `${t.bgButton} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`}`}
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
                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <p className={`${t.textMuted} text-sm font-medium uppercase print:text-gray-600`}>Чистая выручка</p>
                        <h3 className="text-3xl font-bold text-blue-500 mt-2 font-mono print:text-black">{formatCurrency(revenue)}</h3>
                        <p className={`text-xs ${t.textMuted} mt-1`}>Без учета НДС</p>
                    </div>

                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <p className={`${t.textMuted} text-sm font-medium uppercase print:text-gray-600`}>Валовая прибыль</p>
                        <div className="flex items-end gap-2 mt-2">
                            <h3 className="text-3xl font-bold text-purple-500 font-mono print:text-black">{formatCurrency(grossProfit)}</h3>
                            <span className={`text-sm ${t.textMuted} mb-1`}>({grossMargin.toFixed(1)}%)</span>
                        </div>
                        <p className={`text-xs ${t.textMuted} mt-1`}>Выручка - Себестоимость</p>
                    </div>

                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg print:bg-white print:border-gray-300 print:shadow-none`}>
                        <p className={`${t.textMuted} text-sm font-medium uppercase print:text-gray-600`}>Операц. Расходы</p>
                        <h3 className="text-3xl font-bold text-red-500 mt-2 font-mono print:text-black">{formatCurrency(operatingExpenses)}</h3>
                        <p className={`text-xs ${t.textMuted} mt-1`}>OPEX</p>
                    </div>

                    <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-lg relative overflow-hidden print:bg-white print:border-gray-300 print:shadow-none`}>
                        <div className="absolute right-0 top-0 p-4 opacity-5 print:hidden">
                            <DollarSign size={100} />
                        </div>
                        <p className={`${t.textMuted} text-sm font-medium uppercase print:text-gray-600`}>Чистая Прибыль</p>
                        <div className="flex items-end gap-2 mt-2">
                            <h3 className={`text-3xl font-bold font-mono ${netProfit >= 0 ? 'text-emerald-500 print:text-black' : 'text-red-500 print:text-black'}`}>
                                {formatCurrency(netProfit)}
                            </h3>
                            <span className={`text-sm ${t.textMuted} mb-1`}>({netProfitMargin.toFixed(1)}%)</span>
                        </div>
                        <p className={`text-xs ${t.textMuted} mt-1`}>Bottom Line</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
                    {/* Waterfall Chart - Keep in print if possible, but often responsive charts struggle in print. Tailwind print: modifiers can help if needed */}
                    <div className={`lg:col-span-2 ${t.bgCard} rounded-2xl border ${t.border} p-6 shadow-lg print:bg-white print:border-gray-300 print:shadow-none print:mb-6 print:break-inside-avoid`}>
                        <h3 className={`text-xl font-bold ${t.text} mb-6 flex items-center gap-2 print:text-black`}>
                            <TrendingUp size={20} className="text-emerald-500 print:text-black" /> Структура Прибыли
                        </h3>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis 
                                        dataKey="name" 
                                        stroke={theme === 'dark' ? "#64748b" : "#94a3b8"} 
                                        fontSize={11} 
                                        tickLine={false} 
                                        axisLine={false} 
                                    />
                                    <YAxis 
                                        stroke={theme === 'dark' ? "#64748b" : "#94a3b8"} 
                                        fontSize={12} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickFormatter={(val) => `$${val}`} 
                                    />
                                    <Tooltip
                                        contentStyle={{ 
                                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                            color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                        }}
                                        cursor={{ fill: 'transparent' }}
                                        formatter={(value: number) => formatCurrency(Math.abs(value))}
                                    />
                                    <ReferenceLine y={0} stroke={theme === 'dark' ? "#475569" : "#cbd5e1"} />
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
                    <div className={`${t.bgCard} rounded-2xl border ${t.border} p-6 shadow-lg flex flex-col print:bg-white print:border-gray-300 print:shadow-none print:break-inside-avoid`}>
                        <h3 className={`text-xl font-bold ${t.text} mb-6 print:text-black`}>Детализация</h3>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">

                            {/* Revenue Section */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-blue-500 print:text-black">ВЫРУЧКА (Продажи)</span>
                                    <span className={`font-mono ${t.text} print:text-black`}>{formatCurrency(revenue)}</span>
                                </div>
                                <div className={`pl-4 text-sm ${t.textMuted} space-y-1 border-l-2 ${t.border} print:text-gray-600 print:border-gray-300`}>
                                    <div className="flex justify-between">
                                        <span>Продажа товара</span>
                                        <span>{formatCurrency(revenue)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* COGS Section */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-amber-500 print:text-black">(-) СЕБЕСТОИМОСТЬ</span>
                                    <span className={`font-mono ${t.text} print:text-black`}>{formatCurrency(cogs)}</span>
                                </div>
                                <div className={`pl-4 text-sm ${t.textMuted} space-y-1 border-l-2 ${t.border} print:text-gray-600 print:border-gray-300`}>
                                    <div className="flex justify-between">
                                        <span>Закупочная стоимость</span>
                                        <span>{formatCurrency(cogs)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={`border-t ${t.border} my-2 print:border-gray-300`}></div>

                            {/* Gross Profit */}
                            <div className={`flex justify-between items-center ${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-100'} p-2 rounded print:bg-gray-100`}>
                                <span className="font-bold text-purple-500 print:text-black">(=) ВАЛОВАЯ ПРИБЫЛЬ</span>
                                <span className={`font-mono ${t.text} font-bold print:text-black`}>{formatCurrency(grossProfit)}</span>
                            </div>

                            {/* OPEX Section — IFRS breakdown */}
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-red-500 print:text-black">(-) РАСХОДЫ (OPEX)</span>
                                    <span className={`font-mono ${t.text} print:text-black`}>{formatCurrency(operatingExpenses)}</span>
                                </div>
                                <div className={`pl-4 text-sm ${t.textMuted} space-y-1 border-l-2 ${t.border} print:text-gray-600 print:border-gray-300`}>
                                    {filteredData.expenses.length === 0 ? (
                                        <span className={`${t.textMuted} italic`}>Нет расходов за период</span>
                                    ) : (
                                        <>
                                            {opexByCategory.administrative > 0 && (
                                                <div className="flex justify-between font-medium">
                                                    <span>Административные</span>
                                                    <span>{formatCurrency(opexByCategory.administrative)}</span>
                                                </div>
                                            )}
                                            {opexByCategory.operational > 0 && (
                                                <div className="flex justify-between font-medium">
                                                    <span>Производственные</span>
                                                    <span>{formatCurrency(opexByCategory.operational)}</span>
                                                </div>
                                            )}
                                            {opexByCategory.commercial > 0 && (
                                                <div className="flex justify-between font-medium">
                                                    <span>Коммерческие</span>
                                                    <span>{formatCurrency(opexByCategory.commercial)}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {depreciation > 0 && (
                                <div className="mt-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-orange-400 print:text-black">(-) АМОРТИЗАЦИЯ</span>
                                        <span className={`font-mono ${t.text} print:text-black`}>{formatCurrency(depreciation)}</span>
                                    </div>
                                </div>
                            )}

                            <div className={`border-t ${t.border} my-2 print:border-gray-300`}></div>

                            {/* Net Profit */}
                            <div className={`flex justify-between items-center ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-100 border-emerald-200'} p-3 rounded border print:bg-green-50 print:border-green-200`}>
                                <span className={`font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'} print:text-black`}>(=) ЧИСТАЯ ПРИБЫЛЬ</span>
                                <span className={`font-mono ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'} font-bold text-lg print:text-black`}>{formatCurrency(netProfit)}</span>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};