import React, { useState, useMemo } from 'react';
import { Order, Expense, FixedAsset, ExpenseCategory } from '../types';
import { Printer, FileSpreadsheet, Download, CalendarDays, ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react';
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
    onUpdateExpense?: (id: string, updates: Partial<Expense>) => Promise<boolean>;
    onDeleteExpense?: (id: string) => Promise<boolean>;
}

// Month names in Russian
const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTH_NAMES_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

interface MonthData {
    revenue: number;
    cogs: number;
    grossProfit: number;
    opexAdmin: number;
    opexOperational: number;
    opexCommercial: number;
    opexTotal: number;
    depreciation: number;
    netProfit: number;
}

export const PnL: React.FC<PnLProps> = ({ orders, expenses, fixedAssets = [], expenseCategories = [], defaultExchangeRate = 12600, onUpdateExpense, onDeleteExpense }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const toast = useToast();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showExpenseDetails, setShowExpenseDetails] = useState(false);
    const [showCogsDetails, setShowCogsDetails] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ description: string; amount: string; date: string }>({ description: '', amount: '', date: '' });
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const now = new Date();
    const currentYear = now.getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [useDateRange, setUseDateRange] = useState(false);

    const safeNumber = (value: unknown, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    };

    // Build category map for OPEX breakdown
    const categoryMap = useMemo(() => {
        const map: Record<string, string> = {};
        expenseCategories.forEach(c => { map[c.id] = c.pnlCategory; map[c.name] = c.pnlCategory; });
        return map;
    }, [expenseCategories]);

    // Available years from data
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        orders.forEach(o => { const y = new Date(o.date).getFullYear(); if (y > 2000) years.add(y); });
        expenses.forEach(e => { const y = new Date(e.date).getFullYear(); if (y > 2000) years.add(y); });
        years.add(currentYear);
        return Array.from(years).sort((a, b) => b - a);
    }, [orders, expenses, currentYear]);

    // Date range helpers
    const dateFromObj = useDateRange && dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const dateToObj = useDateRange && dateTo ? new Date(dateTo + 'T23:59:59') : null;

    const isInRange = (dateStr: string) => {
        if (!useDateRange) return true; // no filter
        const d = new Date(dateStr);
        if (dateFromObj && d < dateFromObj) return false;
        if (dateToObj && d > dateToObj) return false;
        return true;
    };

    // Calculate data per month for selected year
    const monthlyData = useMemo(() => {
        const data: MonthData[] = Array.from({ length: 12 }, () => ({
            revenue: 0, cogs: 0, grossProfit: 0,
            opexAdmin: 0, opexOperational: 0, opexCommercial: 0, opexTotal: 0,
            depreciation: 0, netProfit: 0
        }));

        // Revenue & COGS from orders
        orders.forEach(o => {
            const d = new Date(o.date);
            if (d.getFullYear() !== selectedYear) return;
            if (!isInRange(o.date)) return;
            const m = d.getMonth();

            data[m].revenue += safeNumber(o.subtotalAmount);

            const items = Array.isArray(o.items) ? o.items : [];
            items.forEach(item => {
                data[m].cogs += safeNumber(item.quantity) * safeNumber(item.costAtSale);
            });
        });

        // OPEX from expenses
        expenses.forEach(e => {
            const d = new Date(e.date);
            if (d.getFullYear() !== selectedYear) return;
            if (!isInRange(e.date)) return;
            const m = d.getMonth();

            const rate = safeNumber(e.exchangeRate) > 0 ? safeNumber(e.exchangeRate) : safeNumber(defaultExchangeRate, 12600);
            const amountUSD = (e.currency === 'UZS') ? safeNumber(e.amount) / rate : safeNumber(e.amount);

            const pnlCat = categoryMap[e.category] || 'administrative';
            if (pnlCat === 'operational') data[m].opexOperational += amountUSD;
            else if (pnlCat === 'commercial') data[m].opexCommercial += amountUSD;
            else data[m].opexAdmin += amountUSD;

            data[m].opexTotal += amountUSD;
        });

        // Depreciation from fixed assets
        fixedAssets.forEach(fa => {
            if (safeNumber(fa.depreciationRate) === 0) return;
            const purchaseDate = new Date(fa.purchaseDate);
            const monthlyDep = (safeNumber(fa.purchaseCost) * safeNumber(fa.depreciationRate) / 100) / 12;

            for (let m = 0; m < 12; m++) {
                const endOfMonth = new Date(selectedYear, m + 1, 0);
                if (purchaseDate <= endOfMonth) {
                    data[m].depreciation += monthlyDep;
                }
            }
        });

        // Calculate derived values
        data.forEach(d => {
            d.grossProfit = d.revenue - d.cogs;
            d.netProfit = d.grossProfit - d.opexTotal - d.depreciation;
        });

        return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders, expenses, fixedAssets, selectedYear, categoryMap, defaultExchangeRate, useDateRange, dateFrom, dateTo]);

    // Totals for the year
    const totals = useMemo(() => {
        return monthlyData.reduce((acc, d) => ({
            revenue: acc.revenue + d.revenue,
            cogs: acc.cogs + d.cogs,
            grossProfit: acc.grossProfit + d.grossProfit,
            opexAdmin: acc.opexAdmin + d.opexAdmin,
            opexOperational: acc.opexOperational + d.opexOperational,
            opexCommercial: acc.opexCommercial + d.opexCommercial,
            opexTotal: acc.opexTotal + d.opexTotal,
            depreciation: acc.depreciation + d.depreciation,
            netProfit: acc.netProfit + d.netProfit,
        }), { revenue: 0, cogs: 0, grossProfit: 0, opexAdmin: 0, opexOperational: 0, opexCommercial: 0, opexTotal: 0, depreciation: 0, netProfit: 0 });
    }, [monthlyData]);

    // Check which OPEX subcategories have data
    const hasAdmin = totals.opexAdmin > 0 || monthlyData.some(d => d.opexAdmin > 0);
    const hasOperational = totals.opexOperational > 0 || monthlyData.some(d => d.opexOperational > 0);
    const hasCommercial = totals.opexCommercial > 0 || monthlyData.some(d => d.opexCommercial > 0);
    const hasDepreciation = totals.depreciation > 0;

    // Detailed expense breakdown by category name
    const expenseBreakdown = useMemo(() => {
        const map: Record<string, { name: string; pnlCat: string; items: { id: string; date: string; description: string; amount: number; originalAmount: number; currency: string }[]; total: number }> = {};
        expenses.forEach(e => {
            const d = new Date(e.date);
            if (d.getFullYear() !== selectedYear) return;
            if (!isInRange(e.date)) return;
            const rate = safeNumber(e.exchangeRate) > 0 ? safeNumber(e.exchangeRate) : safeNumber(defaultExchangeRate, 12600);
            const amountUSD = (e.currency === 'UZS') ? safeNumber(e.amount) / rate : safeNumber(e.amount);
            const catName = e.category || 'Без категории';
            const pnlCat = categoryMap[catName] || 'administrative';
            if (!map[catName]) map[catName] = { name: catName, pnlCat, items: [], total: 0 };
            map[catName].items.push({ id: e.id, date: e.date, description: e.description || '—', amount: amountUSD, originalAmount: safeNumber(e.amount), currency: e.currency || 'USD' });
            map[catName].total += amountUSD;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expenses, selectedYear, categoryMap, defaultExchangeRate, useDateRange, dateFrom, dateTo]);

    // Detailed COGS breakdown by orders and items
    const cogsBreakdown = useMemo(() => {
        const orderMap: Record<string, { id: string; date: string; customerName: string; reportNo?: number; items: { productName: string; quantity: number; costAtSale: number; total: number }[]; total: number }> = {};
        orders.forEach(o => {
            const d = new Date(o.date);
            if (d.getFullYear() !== selectedYear) return;
            if (!isInRange(o.date)) return;
            const items = Array.isArray(o.items) ? o.items : [];
            let orderCogs = 0;
            const itemDetails: { productName: string; quantity: number; costAtSale: number; total: number }[] = [];
            items.forEach(item => {
                const itemCogs = safeNumber(item.quantity) * safeNumber(item.costAtSale);
                orderCogs += itemCogs;
                itemDetails.push({
                    productName: item.productName || '—',
                    quantity: safeNumber(item.quantity),
                    costAtSale: safeNumber(item.costAtSale),
                    total: itemCogs
                });
            });
            if (orderCogs > 0) {
                orderMap[o.id] = {
                    id: o.id,
                    date: o.date,
                    customerName: o.customerName || '—',
                    reportNo: o.reportNo,
                    items: itemDetails,
                    total: orderCogs
                };
            }
        });
        return Object.values(orderMap).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders, selectedYear, useDateRange, dateFrom, dateTo]);

    const fmt = (val: number) => {
        if (val === 0) return '—';
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const fmtFull = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Cell style helpers
    const cellBase = `px-3 py-2 text-right text-sm font-mono whitespace-nowrap`;
    const labelBase = `px-4 py-2 text-sm whitespace-nowrap`;

    // Row component
    const Row = ({ label, getValue, isSubtotal, isTotal, isSubRow, isNegative }: {
        label: string;
        getValue: (d: MonthData) => number;
        getTotal?: number;
        isSubtotal?: boolean;
        isTotal?: boolean;
        isSubRow?: boolean;
        isNegative?: boolean;
    }) => {
        const totalVal = monthlyData.reduce((s, d) => s + getValue(d), 0);
        const rowBg = isTotal
            ? (theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50')
            : isSubtotal
                ? (theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-100')
                : '';
        const fontWeight = (isSubtotal || isTotal) ? 'font-bold' : isSubRow ? 'font-normal' : 'font-medium';
        const textColor = isTotal
            ? (totalVal >= 0 ? 'text-emerald-500' : 'text-red-500')
            : isNegative ? 'text-red-400' : '';

        return (
            <tr className={`${rowBg} border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'} hover:${theme === 'dark' ? 'bg-slate-700/20' : 'bg-slate-50'} transition-colors`}>
                <td className={`${labelBase} ${fontWeight} ${isSubRow ? 'pl-8' : ''} ${t.text} sticky left-0 z-10 ${rowBg || (theme === 'dark' ? 'bg-slate-800' : 'bg-white')}`}>
                    {isNegative && !isSubRow ? '(−) ' : ''}{label}
                </td>
                {monthlyData.map((d, i) => {
                    const val = getValue(d);
                    return (
                        <td key={i} className={`${cellBase} ${fontWeight} ${textColor || t.text}`}>
                            {isNegative && val > 0 ? `-${fmt(val)}` : fmt(val)}
                        </td>
                    );
                })}
                <td className={`${cellBase} ${fontWeight} ${textColor || t.text} ${theme === 'dark' ? 'bg-slate-700/20' : 'bg-slate-100/50'}`}>
                    {isNegative && totalVal > 0 ? `-${fmtFull(totalVal)}` : fmtFull(totalVal)}
                </td>
            </tr>
        );
    };

    // Excel export
    const handleExportExcel = () => {
        const headers = ['Статья', ...MONTH_NAMES.map((m, i) => `${m} ${selectedYear}`), `Итого ${selectedYear}`];
        const rows = [
            ['Выручка (Revenue)', ...monthlyData.map(d => d.revenue.toFixed(2)), totals.revenue.toFixed(2)],
            ['Себестоимость (COGS)', ...monthlyData.map(d => (-d.cogs).toFixed(2)), (-totals.cogs).toFixed(2)],
            ['ВАЛОВАЯ ПРИБЫЛЬ', ...monthlyData.map(d => d.grossProfit.toFixed(2)), totals.grossProfit.toFixed(2)],
            ['Расходы (OPEX)', ...monthlyData.map(d => (-d.opexTotal).toFixed(2)), (-totals.opexTotal).toFixed(2)],
            ...(hasAdmin ? [['  Административные', ...monthlyData.map(d => (-d.opexAdmin).toFixed(2)), (-totals.opexAdmin).toFixed(2)]] : []),
            ...(hasOperational ? [['  Производственные', ...monthlyData.map(d => (-d.opexOperational).toFixed(2)), (-totals.opexOperational).toFixed(2)]] : []),
            ...(hasCommercial ? [['  Коммерческие', ...monthlyData.map(d => (-d.opexCommercial).toFixed(2)), (-totals.opexCommercial).toFixed(2)]] : []),
            ...(hasDepreciation ? [['Амортизация', ...monthlyData.map(d => (-d.depreciation).toFixed(2)), (-totals.depreciation).toFixed(2)]] : []),
            ['ЧИСТАЯ ПРИБЫЛЬ', ...monthlyData.map(d => d.netProfit.toFixed(2)), totals.netProfit.toFixed(2)],
        ];

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head><body><table border="1">
        <tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold">${h}</th>`).join('')}</tr>
        ${rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? '' : ' style="text-align:right"'}>${c}</td>`).join('')}</tr>`).join('')}
        </table></body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `PnL_${selectedYear}_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Excel файл скачан!');
    };

    const handlePrint = () => { window.print(); };

    const handleDownloadPDF = async () => {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);
        const element = document.getElementById('pnl-report-content');
        if (!element) return;
        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
                ignoreElements: (node) => node.classList.contains('print:hidden')
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4'); // landscape for wide table
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const ratio = pdfWidth / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 5, pdfWidth, canvas.height * ratio);
            pdf.save(`PnL_${selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('PDF файл скачан!');
        } catch (err) {
            errorDev("PDF Generation failed", err);
            toast.error("Ошибка при создании PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-20 print:p-2 print:pb-0 print:text-black">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 print:items-start">
                <div>
                    <h2 className={`text-3xl font-bold ${t.text} tracking-tight print:text-black`}>P&L Отчет</h2>
                    <p className={`${t.textMuted} mt-1 print:text-gray-600`}>Прибыли и убытки (USD) — {selectedYear} год</p>
                </div>

                <div className="flex items-center gap-2 print:hidden flex-wrap">
                    <button onClick={handleExportExcel}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 border border-emerald-500/50 px-3 py-2 rounded-lg flex items-center gap-2 transition-all">
                        <FileSpreadsheet size={18} /><span className="hidden sm:inline">Excel</span>
                    </button>
                    <button onClick={handleDownloadPDF} disabled={isGeneratingPdf}
                        className={`${t.bgButtonSecondary} ${t.text} px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}>
                        {isGeneratingPdf ? <span className="animate-spin">⌛</span> : <Download size={18} />}
                        <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button onClick={handlePrint}
                        className={`${t.bgButtonSecondary} ${t.text} px-3 py-2 rounded-lg flex items-center gap-2 transition-all`}>
                        <Printer size={18} /><span className="hidden sm:inline">Печать</span>
                    </button>

                    {/* Year selector */}
                    <div className={`${t.bgCard} p-1 rounded-lg border ${t.border} flex ml-2`}>
                        {availableYears.map(y => (
                            <button key={y} onClick={() => setSelectedYear(y)}
                                className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${selectedYear === y
                                    ? `${t.bgButton} ${t.text} shadow`
                                    : `${t.textMuted} hover:${t.text}`}`}>
                                {y}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Date Range Filter */}
            <div className={`flex flex-wrap items-center gap-3 print:hidden`}>
                <button
                    onClick={() => setUseDateRange(!useDateRange)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${useDateRange
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                        : `${t.bgButtonSecondary} ${t.border} ${t.textMuted}`}`}
                >
                    <CalendarDays size={16} />
                    {useDateRange ? 'Фильтр по датам ✓' : 'Фильтр по датам'}
                </button>
                {useDateRange && (
                    <>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${t.textMuted}`}>с</span>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className={`${t.bgCard} ${t.text} border ${t.border} rounded-lg px-3 py-2 text-sm`} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${t.textMuted}`}>по</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className={`${t.bgCard} ${t.text} border ${t.border} rounded-lg px-3 py-2 text-sm`} />
                        </div>
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className={`text-xs ${t.textMuted} hover:text-red-400 transition-colors`}>
                                ✕ Сбросить
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* P&L Table */}
            <div id="pnl-report-content" className={`${t.bgCard} rounded-2xl border ${t.border} shadow-lg overflow-hidden print:bg-white print:border-gray-300 print:shadow-none`}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className={`${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'} print:bg-gray-100`}>
                                <th className={`${labelBase} text-left font-bold ${t.text} sticky left-0 z-10 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'} print:bg-gray-100`}>
                                    Статья P&L
                                </th>
                                {MONTH_NAMES.map((m, i) => (
                                    <th key={i} className={`${cellBase} font-bold ${t.text} ${i === now.getMonth() && selectedYear === currentYear ? (theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50') : ''}`}>
                                        {m}
                                    </th>
                                ))}
                                <th className={`${cellBase} font-bold ${t.text} ${theme === 'dark' ? 'bg-slate-600/30' : 'bg-slate-200/50'}`}>
                                    Итого
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Revenue */}
                            <Row label="Выручка (Revenue)" getValue={d => d.revenue} />

                            {/* COGS */}
                            <Row label="Себестоимость (COGS)" getValue={d => d.cogs} isNegative />

                            {/* Gross Profit */}
                            <Row label="ВАЛОВАЯ ПРИБЫЛЬ" getValue={d => d.grossProfit} isSubtotal />

                            {/* Spacer */}
                            <tr><td colSpan={14} className="h-1"></td></tr>

                            {/* OPEX Total */}
                            <Row label="Расходы (OPEX)" getValue={d => d.opexTotal} isNegative />

                            {/* OPEX Subcategories */}
                            {hasAdmin && <Row label="Административные" getValue={d => d.opexAdmin} isSubRow isNegative />}
                            {hasOperational && <Row label="Производственные" getValue={d => d.opexOperational} isSubRow isNegative />}
                            {hasCommercial && <Row label="Коммерческие" getValue={d => d.opexCommercial} isSubRow isNegative />}

                            {/* Depreciation */}
                            {hasDepreciation && <Row label="Амортизация ОС" getValue={d => d.depreciation} isNegative />}

                            {/* Spacer */}
                            <tr><td colSpan={14} className="h-1"></td></tr>

                            {/* Net Profit */}
                            <Row label="ЧИСТАЯ ПРИБЫЛЬ" getValue={d => d.netProfit} isTotal />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Expense Breakdown */}
            {expenseBreakdown.length > 0 && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} shadow-lg overflow-hidden print:bg-white print:border-gray-300`}>
                    <button
                        onClick={() => setShowExpenseDetails(!showExpenseDetails)}
                        className={`w-full flex items-center justify-between p-4 ${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}
                    >
                        <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                            {showExpenseDetails ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            Детальная расшифровка расходов
                        </h3>
                        <span className={`text-sm ${t.textMuted}`}>{expenseBreakdown.length} категорий • {fmtFull(totals.opexTotal)}</span>
                    </button>

                    {showExpenseDetails && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className={`${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-50'} border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                                        <th className={`px-4 py-2 text-left text-xs font-bold ${t.textMuted} uppercase`}>Категория / Описание</th>
                                        <th className={`px-4 py-2 text-left text-xs font-bold ${t.textMuted} uppercase`}>Дата</th>
                                        <th className={`px-4 py-2 text-right text-xs font-bold ${t.textMuted} uppercase`}>Сумма (USD)</th>
                                        {(onUpdateExpense || onDeleteExpense) && (
                                            <th className={`px-4 py-2 text-center text-xs font-bold ${t.textMuted} uppercase w-24`}>Действия</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseBreakdown.map(cat => (
                                        <React.Fragment key={cat.name}>
                                            {/* Category header */}
                                            <tr className={`${theme === 'dark' ? 'bg-slate-700/20' : 'bg-slate-100/70'} border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                                                <td className={`px-4 py-2 font-bold text-sm ${t.text}`}>
                                                    {cat.name}
                                                    <span className={`ml-2 text-xs font-normal ${t.textMuted}`}>
                                                        ({cat.pnlCat === 'operational' ? 'Производственные' : cat.pnlCat === 'commercial' ? 'Коммерческие' : 'Административные'})
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-2 text-sm ${t.textMuted}`}>{cat.items.length} записей</td>
                                                <td className={`px-4 py-2 text-right font-bold text-sm font-mono text-red-400`}>{fmtFull(cat.total)}</td>
                                                {(onUpdateExpense || onDeleteExpense) && <td></td>}
                                            </tr>
                                            {/* Individual items */}
                                            {cat.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                                                <tr key={item.id} className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} ${theme === 'dark' ? 'hover:bg-slate-700/10' : 'hover:bg-slate-50'}`}>
                                                    {editingExpenseId === item.id ? (
                                                        <>
                                                            <td className={`px-4 py-1 pl-8`}>
                                                                <input type="text" value={editForm.description}
                                                                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                                    className={`w-full ${t.bgCard} ${t.text} border ${t.border} rounded px-2 py-1 text-sm`} />
                                                            </td>
                                                            <td className={`px-4 py-1`}>
                                                                <input type="date" value={editForm.date}
                                                                    onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                                                    className={`${t.bgCard} ${t.text} border ${t.border} rounded px-2 py-1 text-sm`} />
                                                            </td>
                                                            <td className={`px-4 py-1`}>
                                                                <input type="number" value={editForm.amount} step="0.01"
                                                                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                                                    className={`w-full ${t.bgCard} ${t.text} border ${t.border} rounded px-2 py-1 text-sm text-right font-mono`} />
                                                            </td>
                                                            <td className="px-4 py-1 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button onClick={async () => {
                                                                        if (!onUpdateExpense) return;
                                                                        const ok = await onUpdateExpense(item.id, {
                                                                            description: editForm.description,
                                                                            amount: parseFloat(editForm.amount) || 0,
                                                                            date: editForm.date ? new Date(editForm.date + 'T12:00:00').toISOString() : undefined,
                                                                        });
                                                                        if (ok) { toast.success('Расход обновлён'); setEditingExpenseId(null); }
                                                                        else toast.error('Ошибка обновления');
                                                                    }} className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors" title="Сохранить">
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button onClick={() => setEditingExpenseId(null)}
                                                                        className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors" title="Отмена">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className={`px-4 py-1.5 pl-8 text-sm ${t.textMuted}`}>{item.description}</td>
                                                            <td className={`px-4 py-1.5 text-sm font-mono ${t.textMuted}`}>{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                                                            <td className={`px-4 py-1.5 text-right text-sm font-mono ${t.text}`}>{fmtFull(item.amount)}</td>
                                                            {(onUpdateExpense || onDeleteExpense) && (
                                                                <td className="px-4 py-1.5 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {onUpdateExpense && (
                                                                            <button onClick={() => {
                                                                                setEditingExpenseId(item.id);
                                                                                setEditForm({
                                                                                    description: item.description,
                                                                                    amount: String(item.originalAmount),
                                                                                    date: item.date.split('T')[0],
                                                                                });
                                                                            }} className={`p-1 ${t.textMuted} hover:text-blue-400 hover:bg-blue-500/20 rounded transition-colors`} title="Редактировать">
                                                                                <Pencil size={14} />
                                                                            </button>
                                                                        )}
                                                                        {onDeleteExpense && (
                                                                            deletingId === item.id ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <button onClick={async () => {
                                                                                        const ok = await onDeleteExpense(item.id);
                                                                                        if (ok) toast.success('Расход удалён');
                                                                                        else toast.error('Ошибка удаления');
                                                                                        setDeletingId(null);
                                                                                    }} className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors" title="Подтвердить">
                                                                                        <Check size={14} />
                                                                                    </button>
                                                                                    <button onClick={() => setDeletingId(null)}
                                                                                        className={`p-1 ${t.textMuted} hover:bg-slate-500/20 rounded transition-colors`} title="Отмена">
                                                                                        <X size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <button onClick={() => setDeletingId(item.id)}
                                                                                    className={`p-1 ${t.textMuted} hover:text-red-400 hover:bg-red-500/20 rounded transition-colors`} title="Удалить">
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {/* Grand total */}
                                    <tr className={`${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'} border-t-2 ${theme === 'dark' ? 'border-red-500/30' : 'border-red-200'}`}>
                                        <td colSpan={onUpdateExpense || onDeleteExpense ? 3 : 2} className={`px-4 py-3 font-bold text-sm ${t.text}`}>ИТОГО РАСХОДЫ</td>
                                        <td className={`px-4 py-3 text-right font-bold text-sm font-mono text-red-500`}>{fmtFull(totals.opexTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Detailed COGS Breakdown */}
            {cogsBreakdown.length > 0 && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} shadow-lg overflow-hidden print:bg-white print:border-gray-300`}>
                    <button
                        onClick={() => setShowCogsDetails(!showCogsDetails)}
                        className={`w-full flex items-center justify-between p-4 ${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}
                    >
                        <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                            {showCogsDetails ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            Детальная расшифровка себестоимости (COGS)
                        </h3>
                        <span className={`text-sm ${t.textMuted}`}>{cogsBreakdown.length} заказов • {fmtFull(totals.cogs)}</span>
                    </button>

                    {showCogsDetails && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className={`${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-50'} border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                                        <th className={`px-4 py-2 text-left text-xs font-bold ${t.textMuted} uppercase`}>Заказ / Товар</th>
                                        <th className={`px-4 py-2 text-left text-xs font-bold ${t.textMuted} uppercase`}>Дата / Клиент</th>
                                        <th className={`px-4 py-2 text-right text-xs font-bold ${t.textMuted} uppercase`}>Кол-во</th>
                                        <th className={`px-4 py-2 text-right text-xs font-bold ${t.textMuted} uppercase`}>Себестоимость (USD)</th>
                                        <th className={`px-4 py-2 text-right text-xs font-bold ${t.textMuted} uppercase`}>Итого (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cogsBreakdown.map(order => (
                                        <React.Fragment key={order.id}>
                                            {/* Order header */}
                                            <tr className={`${theme === 'dark' ? 'bg-slate-700/20' : 'bg-slate-100/70'} border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                                                <td className={`px-4 py-2 font-bold text-sm ${t.text}`}>
                                                    Заказ #{order.reportNo || order.id.slice(-6)}
                                                </td>
                                                <td className={`px-4 py-2 text-sm ${t.textMuted}`}>
                                                    {new Date(order.date).toLocaleDateString('ru-RU')} • {order.customerName}
                                                </td>
                                                <td className={`px-4 py-2 text-sm ${t.textMuted}`}>{order.items.length} товаров</td>
                                                <td className={`px-4 py-2 text-sm ${t.textMuted}`}>—</td>
                                                <td className={`px-4 py-2 text-right font-bold text-sm font-mono text-orange-400`}>{fmtFull(order.total)}</td>
                                            </tr>
                                            {/* Order items */}
                                            {order.items.map((item, idx) => (
                                                <tr key={idx} className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} ${theme === 'dark' ? 'hover:bg-slate-700/10' : 'hover:bg-slate-50'}`}>
                                                    <td className={`px-4 py-1.5 pl-8 text-sm ${t.textMuted}`}>{item.productName}</td>
                                                    <td className={`px-4 py-1.5 text-sm ${t.textMuted}`}>—</td>
                                                    <td className={`px-4 py-1.5 text-right text-sm font-mono ${t.textMuted}`}>{item.quantity}</td>
                                                    <td className={`px-4 py-1.5 text-right text-sm font-mono ${t.textMuted}`}>{fmtFull(item.costAtSale)}</td>
                                                    <td className={`px-4 py-1.5 text-right text-sm font-mono ${t.text}`}>{fmtFull(item.total)}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {/* Grand total */}
                                    <tr className={`${theme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-50'} border-t-2 ${theme === 'dark' ? 'border-orange-500/30' : 'border-orange-200'}`}>
                                        <td colSpan={4} className={`px-4 py-3 font-bold text-sm ${t.text}`}>ИТОГО СЕБЕСТОИМОСТЬ</td>
                                        <td className={`px-4 py-3 text-right font-bold text-sm font-mono text-orange-500`}>{fmtFull(totals.cogs)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Summary cards below table */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`text-xs ${t.textMuted} uppercase`}>Выручка за {selectedYear}</p>
                    <p className="text-xl font-bold text-blue-500 font-mono mt-1">{fmtFull(totals.revenue)}</p>
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`text-xs ${t.textMuted} uppercase`}>Валовая прибыль</p>
                    <p className="text-xl font-bold text-purple-500 font-mono mt-1">{fmtFull(totals.grossProfit)}</p>
                    {totals.revenue > 0 && <p className={`text-xs ${t.textMuted}`}>{(totals.grossProfit / totals.revenue * 100).toFixed(1)}% маржа</p>}
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`text-xs ${t.textMuted} uppercase`}>Расходы (OPEX)</p>
                    <p className="text-xl font-bold text-red-500 font-mono mt-1">{fmtFull(totals.opexTotal)}</p>
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`text-xs ${t.textMuted} uppercase`}>Чистая прибыль</p>
                    <p className={`text-xl font-bold font-mono mt-1 ${totals.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmtFull(totals.netProfit)}</p>
                    {totals.revenue > 0 && <p className={`text-xs ${t.textMuted}`}>{(totals.netProfit / totals.revenue * 100).toFixed(1)}% маржа</p>}
                </div>
            </div>
        </div>
    );
};