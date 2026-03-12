import React, { useMemo, useState } from 'react';
import { Client, Order, Transaction, Purchase } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { orderMatchesClient } from '../../hooks/useCRMDebt';
import {
    ArrowLeft, Phone, Mail, MapPin, Building2, ShoppingCart, DollarSign,
    ArrowDownCircle, ArrowUpCircle, Calendar, FileText, CreditCard, Banknote,
    TrendingUp, TrendingDown, Wallet, Clock, Package, Truck
} from 'lucide-react';

interface ClientDetailViewProps {
    client: Client;
    orders: Order[];
    transactions: Transaction[];
    purchases: Purchase[];
    calculateClientDebt: (client: Client) => number;
    calculateClientPurchases: (client: Client) => number;
    onBack: () => void;
    onRepay: (client: Client) => void;
}

type TabType = 'all' | 'sales' | 'procurements' | 'payments_in' | 'payments_out' | 'supplier_payments';

interface TimelineEntry {
    id: string;
    date: string;
    type: 'sale' | 'procurement' | 'payment_in' | 'payment_out' | 'debt_obligation' | 'supplier_payment';
    title: string;
    description: string;
    amount: number;
    amountUSD: number;
    currency: string;
    method?: string;
    balanceAfter: number;
    items?: { name: string; qty: number; price: number }[];
    reportNo?: number;
}

const txToUSD = (tx: Transaction): number => {
    if (tx.currency === 'UZS' && tx.exchangeRate && tx.exchangeRate > 0) {
        return tx.amount / tx.exchangeRate;
    }
    return tx.amount || 0;
};

const formatDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
};

const formatMoney = (v: number, currency = 'USD') => {
    if (currency === 'UZS') return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сум`;
    return `$${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
};

const methodLabel = (m?: string) => {
    switch (m) {
        case 'cash': return 'Наличные';
        case 'bank': return 'Перечисление';
        case 'card': return 'Карта';
        case 'debt': return 'Долг';
        case 'mixed': return 'Микс';
        default: return m || '—';
    }
};

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
    client, orders, transactions, purchases, calculateClientDebt, calculateClientPurchases, onBack, onRepay
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const isDark = theme !== 'light';
    const [activeTab, setActiveTab] = useState<TabType>('all');

    // Helper: does this purchase match the client as supplier?
    const purchaseMatchesClient = (purchase: Purchase): boolean => {
        if (purchase.clientId === client.id) return true;
        const name = client.name?.toLowerCase();
        const companyName = client.companyName?.toLowerCase();
        const supplierName = purchase.supplierName?.toLowerCase();
        if (!supplierName) return false;
        if (name && supplierName === name) return true;
        if (companyName && supplierName === companyName) return true;
        return false;
    };

    // --- Build unified timeline ---
    const timeline = useMemo(() => {
        const entries: TimelineEntry[] = [];

        // 1. Sales TO this client (orders)
        orders.forEach(order => {
            if (!orderMatchesClient(order, client)) return;
            if (order.status === 'cancelled') return;

            entries.push({
                id: order.id,
                date: order.date,
                type: 'sale',
                title: order.reportNo ? `Продажа №${order.reportNo}` : `Продажа #${order.id.slice(-6)}`,
                description: (order.items || []).map(it => it.productName).slice(0, 3).join(', ') +
                    (order.items && order.items.length > 3 ? '...' : ''),
                amount: order.totalAmount || 0,
                amountUSD: order.totalAmount || 0,
                currency: 'USD',
                method: order.paymentMethod,
                balanceAfter: 0,
                items: (order.items || []).map(it => ({
                    name: it.productName, qty: it.quantity, price: it.priceAtSale
                })),
                reportNo: order.reportNo,
            });
        });

        // 2. Purchases FROM this client (when client is a supplier)
        purchases.forEach(purchase => {
            if (!purchaseMatchesClient(purchase)) return;

            entries.push({
                id: purchase.id,
                date: purchase.date,
                type: 'procurement',
                title: `Закупка #${purchase.id.slice(-6)}`,
                description: (purchase.items || []).map(it => it.productName).slice(0, 3).join(', ') +
                    (purchase.items && purchase.items.length > 3 ? '...' : ''),
                amount: purchase.totalLandedAmount || purchase.totalInvoiceAmount || 0,
                amountUSD: purchase.totalLandedAmount || purchase.totalInvoiceAmount || 0,
                currency: 'USD',
                method: purchase.paymentMethod,
                balanceAfter: 0,
                items: (purchase.items || []).map(it => ({
                    name: it.productName, qty: it.quantity, price: it.landedCost || it.invoicePrice
                })),
            });
        });

        // 3. Payments from client to us (client_payment)
        transactions.forEach(tx => {
            if (tx.type !== 'client_payment') return;

            const clientOrderIds = new Set(
                orders.filter(o => orderMatchesClient(o, client)).map(o => o.id)
            );
            const matches = tx.relatedId === client.id ||
                (tx.relatedId && clientOrderIds.has(tx.relatedId));
            if (!matches) return;

            entries.push({
                id: tx.id,
                date: tx.date,
                type: 'payment_in',
                title: 'Оплата от клиента',
                description: tx.description || '',
                amount: tx.amount || 0,
                amountUSD: txToUSD(tx),
                currency: tx.currency || 'USD',
                method: tx.method,
                balanceAfter: 0,
            });
        });

        // 4. Our payments to client/supplier (supplier_payment)
        transactions.forEach(tx => {
            if (tx.type !== 'supplier_payment') return;
            // Match by clientId field, or by supplier/related ID, or by name in description
            const matchByClientId = tx.clientId === client.id;
            const matchById = tx.relatedId === client.id || tx.supplierId === client.id;
            const matchByName = tx.description && (
                tx.description.toLowerCase().includes(client.name?.toLowerCase() || '___') ||
                (client.companyName && tx.description.toLowerCase().includes(client.companyName.toLowerCase()))
            );
            // Match by purchase IDs of this client
            const clientPurchaseIds = new Set(
                purchases.filter(p => purchaseMatchesClient(p)).map(p => p.id)
            );
            const matchByPurchase = tx.relatedId && clientPurchaseIds.has(tx.relatedId);

            if (!matchByClientId && !matchById && !matchByName && !matchByPurchase) return;

            entries.push({
                id: tx.id,
                date: tx.date,
                type: 'supplier_payment',
                title: 'Наша оплата поставщику',
                description: tx.description || '',
                amount: tx.amount || 0,
                amountUSD: txToUSD(tx),
                currency: tx.currency || 'USD',
                method: tx.method,
                balanceAfter: 0,
            });
        });

        // 5. Our payments to client (client_return / client_refund)
        transactions.forEach(tx => {
            if (tx.type !== 'client_return' && tx.type !== 'client_refund') return;
            if (tx.relatedId !== client.id) return;

            entries.push({
                id: tx.id,
                date: tx.date,
                type: 'payment_out',
                title: tx.type === 'client_return' ? 'Возврат клиенту' : 'Возврат средств',
                description: tx.description || '',
                amount: tx.amount || 0,
                amountUSD: txToUSD(tx),
                currency: tx.currency || 'USD',
                method: tx.method,
                balanceAfter: 0,
            });
        });

        // 6. Debt obligations
        transactions.forEach(tx => {
            if (tx.type !== 'debt_obligation') return;
            if (tx.relatedId !== client.id) return;
            if (entries.some(e => e.id === tx.id)) return;

            entries.push({
                id: tx.id,
                date: tx.date,
                type: 'debt_obligation',
                title: 'Долговое обязательство',
                description: tx.description || '',
                amount: tx.amount || 0,
                amountUSD: txToUSD(tx),
                currency: tx.currency || 'USD',
                balanceAfter: 0,
            });
        });

        // Sort chronologically
        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate running balance (client's debt to us)
        let runningBalance = 0;
        entries.forEach(entry => {
            if (entry.type === 'sale') {
                const order = orders.find(o => o.id === entry.id);
                if (order && (order.paymentMethod === 'debt' || order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial')) {
                    runningBalance += entry.amountUSD;
                }
            } else if (entry.type === 'debt_obligation') {
                runningBalance += entry.amountUSD;
            } else if (entry.type === 'payment_in') {
                runningBalance -= entry.amountUSD;
            } else if (entry.type === 'payment_out') {
                runningBalance += entry.amountUSD;
            }
            entry.balanceAfter = Math.max(0, runningBalance);
        });

        return entries.reverse(); // newest first
    }, [client, orders, transactions, purchases]);

    // Filter by tab
    const filteredTimeline = useMemo(() => {
        if (activeTab === 'all') return timeline;
        if (activeTab === 'sales') return timeline.filter(e => e.type === 'sale');
        if (activeTab === 'procurements') return timeline.filter(e => e.type === 'procurement');
        if (activeTab === 'payments_in') return timeline.filter(e => e.type === 'payment_in');
        if (activeTab === 'payments_out') return timeline.filter(e => e.type === 'payment_out' || e.type === 'debt_obligation');
        if (activeTab === 'supplier_payments') return timeline.filter(e => e.type === 'supplier_payment');
        return timeline;
    }, [timeline, activeTab]);

    // Summary stats
    const stats = useMemo(() => {
        const totalSales = timeline.filter(e => e.type === 'sale').reduce((s, e) => s + e.amountUSD, 0);
        const totalProcurements = timeline.filter(e => e.type === 'procurement').reduce((s, e) => s + e.amountUSD, 0);
        const currentDebt = calculateClientDebt(client);
        const totalPaymentsIn = timeline.filter(e => e.type === 'payment_in').reduce((s, e) => s + e.amountUSD, 0);
        const totalSupplierPayments = timeline.filter(e => e.type === 'supplier_payment').reduce((s, e) => s + e.amountUSD, 0);
        const salesCount = timeline.filter(e => e.type === 'sale').length;
        const procurementCount = timeline.filter(e => e.type === 'procurement').length;
        const hasProcurements = procurementCount > 0;

        return { totalSales, totalProcurements, currentDebt, totalPaymentsIn, totalSupplierPayments, salesCount, procurementCount, hasProcurements };
    }, [timeline, client, calculateClientDebt]);

    const isLegal = client.type === 'legal';

    const typeColors = (entry: TimelineEntry) => {
        switch (entry.type) {
            case 'sale': return { bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', border: 'border-blue-500/30', icon: <ShoppingCart size={18} className="text-blue-500" />, label: 'Продажа', color: 'text-blue-500' };
            case 'procurement': return { bg: isDark ? 'bg-purple-500/10' : 'bg-purple-50', border: 'border-purple-500/30', icon: <Truck size={18} className="text-purple-500" />, label: 'Закупка', color: 'text-purple-500' };
            case 'payment_in': return { bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', border: 'border-emerald-500/30', icon: <ArrowDownCircle size={18} className="text-emerald-500" />, label: 'Оплата от клиента', color: 'text-emerald-500' };
            case 'payment_out': return { bg: isDark ? 'bg-red-500/10' : 'bg-red-50', border: 'border-red-500/30', icon: <ArrowUpCircle size={18} className="text-red-500" />, label: 'Возврат', color: 'text-red-500' };
            case 'supplier_payment': return { bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50', border: 'border-amber-500/30', icon: <DollarSign size={18} className="text-amber-500" />, label: 'Наша оплата', color: 'text-amber-500' };
            case 'debt_obligation': return { bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', border: 'border-orange-500/30', icon: <FileText size={18} className="text-orange-500" />, label: 'Долг', color: 'text-orange-500' };
        }
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
        { key: 'all', label: 'Все', icon: <Clock size={16} />, count: timeline.length },
        { key: 'sales', label: 'Мы продали', icon: <ShoppingCart size={16} />, count: timeline.filter(e => e.type === 'sale').length },
        { key: 'procurements', label: 'Мы купили', icon: <Truck size={16} />, count: timeline.filter(e => e.type === 'procurement').length },
        { key: 'payments_in', label: 'Клиент платит', icon: <ArrowDownCircle size={16} />, count: timeline.filter(e => e.type === 'payment_in').length },
        { key: 'supplier_payments', label: 'Мы платим', icon: <DollarSign size={16} />, count: timeline.filter(e => e.type === 'supplier_payment').length },
    ];

    return (
        <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} transition-colors`}
                >
                    <ArrowLeft size={22} className={t.text} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${isLegal ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                            {isLegal ? '🏢' : client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className={`text-xl sm:text-2xl font-bold ${t.text} truncate`}>
                                {isLegal && client.companyName ? client.companyName : client.name}
                            </h2>
                            <div className="flex items-center gap-3 flex-wrap">
                                {isLegal && client.companyName && (
                                    <span className={`text-sm ${t.textMuted}`}>Контакт: {client.name}</span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isLegal ? 'bg-blue-500/20 text-blue-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                    {isLegal ? '🏢 Юр. лицо' : '👤 Физ. лицо'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => onRepay(client)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                        <Wallet size={16} /> <span className="hidden sm:inline">Провести оплату</span><span className="sm:hidden">Оплата</span>
                    </button>
                </div>
            </div>

            {/* Client Info Bar */}
            <div className={`${t.bgCard} border ${t.border} rounded-xl p-4 flex flex-wrap gap-4 text-sm`}>
                {client.phone && (
                    <div className={`flex items-center gap-2 ${t.textMuted}`}>
                        <Phone size={14} /> {client.phone}
                    </div>
                )}
                {client.email && (
                    <div className={`flex items-center gap-2 ${t.textMuted}`}>
                        <Mail size={14} /> {client.email}
                    </div>
                )}
                {client.address && (
                    <div className={`flex items-center gap-2 ${t.textMuted}`}>
                        <MapPin size={14} /> {client.address}
                    </div>
                )}
                {isLegal && client.inn && (
                    <div className={`flex items-center gap-2 ${t.textMuted}`}>
                        <Building2 size={14} /> ИНН: {client.inn}
                    </div>
                )}
                {isLegal && client.bankName && (
                    <div className={`flex items-center gap-2 ${t.textMuted}`}>
                        <CreditCard size={14} /> {client.bankName}
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className={`grid grid-cols-2 ${stats.hasProcurements ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>
                {/* Sales TO client (Мы продали) */}
                <div className={`${t.bgCard} border ${t.border} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                            <ShoppingCart size={18} className="text-blue-500" />
                        </div>
                        <span className={`text-xs ${t.textMuted} uppercase font-semibold`}>Мы продали</span>
                    </div>
                    <p className="text-xl font-bold text-blue-500 font-mono">
                        ${stats.totalSales.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs ${t.textMuted} mt-1`}>{stats.salesCount} заказов</p>
                </div>

                {/* Purchases FROM client (Мы купили) */}
                {stats.hasProcurements && (
                    <div className={`${t.bgCard} border border-purple-500/30 rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                                <Truck size={18} className="text-purple-500" />
                            </div>
                            <span className={`text-xs ${t.textMuted} uppercase font-semibold`}>Мы купили</span>
                        </div>
                        <p className="text-xl font-bold text-purple-500 font-mono">
                            ${stats.totalProcurements.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-xs ${t.textMuted} mt-1`}>{stats.procurementCount} закупок</p>
                    </div>
                )}

                {/* Client Payments to us */}
                <div className={`${t.bgCard} border ${t.border} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                            <TrendingUp size={18} className="text-emerald-500" />
                        </div>
                        <span className={`text-xs ${t.textMuted} uppercase font-semibold`}>Клиент оплатил</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-500 font-mono">
                        ${stats.totalPaymentsIn.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs ${t.textMuted} mt-1`}>
                        {timeline.filter(e => e.type === 'payment_in').length} платежей
                    </p>
                </div>

                {/* Our payments to supplier */}
                {stats.hasProcurements && (
                    <div className={`${t.bgCard} border ${t.border} rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                                <DollarSign size={18} className="text-amber-500" />
                            </div>
                            <span className={`text-xs ${t.textMuted} uppercase font-semibold`}>Мы оплатили</span>
                        </div>
                        <p className="text-xl font-bold text-amber-500 font-mono">
                            ${stats.totalSupplierPayments.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-xs ${t.textMuted} mt-1`}>
                            {timeline.filter(e => e.type === 'supplier_payment').length} платежей
                        </p>
                    </div>
                )}

                {/* Current Debt */}
                <div className={`${t.bgCard} border ${stats.currentDebt > 0 ? 'border-red-500/50' : t.border} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${stats.currentDebt > 0 ? (isDark ? 'bg-red-500/20' : 'bg-red-100') : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
                            <Banknote size={18} className={stats.currentDebt > 0 ? 'text-red-500' : t.textMuted} />
                        </div>
                        <span className={`text-xs ${t.textMuted} uppercase font-semibold`}>Долг клиента</span>
                    </div>
                    <p className={`text-xl font-bold font-mono ${stats.currentDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        ${stats.currentDebt.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                    </p>
                    {stats.currentDebt === 0 && (
                        <p className={`text-xs text-emerald-500 mt-1`}>Без задолженности</p>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className={`flex gap-1 ${t.bgCard} border ${t.border} rounded-xl p-1 overflow-x-auto`}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === tab.key
                                ? (isDark ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm')
                                : `${t.textMuted} hover:${t.text}`
                        }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeTab === tab.key
                                ? (isDark ? 'bg-slate-600' : 'bg-slate-200')
                                : (isDark ? 'bg-slate-700' : 'bg-slate-100')
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-4">
                {filteredTimeline.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-16 ${t.textMuted}`}>
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium mb-1">Нет записей</p>
                        <p className="text-sm">Транзакции по данному клиенту отсутствуют</p>
                    </div>
                ) : (
                    filteredTimeline.map((entry) => {
                        const style = typeColors(entry);
                        return (
                            <div
                                key={entry.id}
                                className={`${t.bgCard} border ${t.border} rounded-xl p-4 hover:${isDark ? 'border-slate-600' : 'border-slate-300'} transition-colors`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className={`p-2 rounded-lg ${style.bg} border ${style.border} flex-shrink-0 mt-0.5`}>
                                        {style.icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`font-semibold ${t.text} text-sm truncate`}>{entry.title}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${style.bg} ${style.color}`}>
                                                    {style.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`text-xs ${t.textMuted} flex items-center gap-1`}>
                                                    <Calendar size={12} /> {formatDate(entry.date)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {entry.description && (
                                            <p className={`text-xs ${t.textMuted} mb-2 truncate`}>{entry.description}</p>
                                        )}

                                        {/* Order items detail */}
                                        {(entry.type === 'sale' || entry.type === 'procurement') && entry.items && entry.items.length > 0 && (
                                            <div className={`text-xs ${t.textMuted} space-y-0.5 mb-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'} rounded-lg p-2`}>
                                                {entry.items.slice(0, 5).map((item, idx) => (
                                                    <div key={idx} className="flex justify-between">
                                                        <span className="truncate flex-1">{item.name}</span>
                                                        <span className="ml-2 font-mono whitespace-nowrap">
                                                            {item.qty} × ${item.price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                                {entry.items.length > 5 && (
                                                    <div className="text-center opacity-50">...ещё {entry.items.length - 5}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Amount + method + balance */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`font-bold font-mono text-sm ${
                                                    entry.type === 'payment_in' ? 'text-emerald-500' :
                                                    entry.type === 'payment_out' ? 'text-red-500' :
                                                    entry.type === 'sale' ? 'text-blue-500' :
                                                    entry.type === 'procurement' ? 'text-purple-500' :
                                                    entry.type === 'supplier_payment' ? 'text-amber-500' : 'text-orange-500'
                                                }`}>
                                                    {entry.type === 'payment_in' ? '+' : entry.type === 'supplier_payment' ? '-' : entry.type === 'payment_out' ? '-' : ''}
                                                    {formatMoney(entry.amount, entry.currency)}
                                                </span>
                                                {entry.currency === 'UZS' && entry.amountUSD !== entry.amount && (
                                                    <span className={`text-xs ${t.textMuted} font-mono`}>
                                                        ≈ ${entry.amountUSD.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                                {entry.method && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-100'} ${t.textMuted}`}>
                                                        {methodLabel(entry.method)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-xs font-mono ${t.textMuted}`}>
                                                Баланс: <span className={entry.balanceAfter > 0 ? 'text-red-500 font-bold' : 'text-emerald-500'}>
                                                    ${entry.balanceAfter.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
