
import React from 'react';
import { Product, Order, Expense, FixedAsset, AppSettings, Transaction, Client } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShieldCheck, Wallet, Building2, Scale, Landmark } from 'lucide-react';

interface BalanceProps {
    products: Product[];
    orders: Order[];
    expenses: Expense[];
    fixedAssets: FixedAsset[];
    settings: AppSettings;
    transactions: Transaction[];
    clients: Client[];
}

export const Balance: React.FC<BalanceProps> = ({ products, orders, expenses, fixedAssets, settings, transactions, clients }) => {
    // Safety checks - ensure arrays are defined
    const safeProducts = products || [];
    const safeOrders = orders || [];
    const safeExpenses = expenses || [];
    const safeFixedAssets = fixedAssets || [];
    const safeTransactions = transactions || [];
    const safeClients = clients || [];

    // --- ASSETS (АКТИВЫ) ---

    // 1. Inventory Value (USD) - Stock on hand
    const inventoryValue = safeProducts.reduce((sum, p) => sum + ((p.quantity || 0) * (p.pricePerUnit || 0)), 0);

    // 2. Cash Breakdown
    // Initial Sales Cash (Direct Sales)
    const cashSales = safeOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.amountPaid || 0), 0);
    const bankSales = safeOrders.filter(o => o.paymentMethod === 'bank').reduce((sum, o) => sum + (o.amountPaid || 0), 0);
    const cardSales = safeOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + (o.amountPaid || 0), 0);

    // Add Client Repayments (Inflow)
    const clientRepaymentsCash = safeTransactions
        .filter(t => t && t.type === 'client_payment' && t.method === 'cash')
        .reduce((sum, t) => {
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? (t.amount || 0) / t.exchangeRate
                : (t.amount || 0);
            return sum + amountUSD;
        }, 0);
    const clientRepaymentsBank = safeTransactions
        .filter(t => t && t.type === 'client_payment' && t.method === 'bank')
        .reduce((sum, t) => {
            // Bank is always UZS, but let's be safe and check currency or assume UZS if rate exists
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? (t.amount || 0) / t.exchangeRate
                : (t.amount || 0);
            return sum + amountUSD;
        }, 0);
    const clientRepaymentsCard = safeTransactions
        .filter(t => t && t.type === 'client_payment' && t.method === 'card')
        .reduce((sum, t) => {
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? (t.amount || 0) / t.exchangeRate
                : (t.amount || 0);
            return sum + amountUSD;
        }, 0);

    // Subtract Client Returns (Outflow - Refund)
    const clientReturnsCash = safeTransactions
        .filter(t => t && t.type === 'client_return' && t.method === 'cash')
        .reduce((sum, t) => {
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? (t.amount || 0) / t.exchangeRate
                : (t.amount || 0);
            return sum + amountUSD;
        }, 0);

    // Subtract Supplier Payments (Outflow)
    const supplierPaymentsCash = safeTransactions
        .filter(t => t && t.type === 'supplier_payment' && t.method === 'cash')
        .reduce((sum, t) => sum + (t.amount || 0), 0); // Assuming supplier payments are currently just USD or handled simply. 
    // TODO: If supplier payments become multi-currency, update here too. For now, Import.tsx handles debt in USD.
    const supplierPaymentsBank = safeTransactions
        .filter(t => t && t.type === 'supplier_payment' && t.method === 'bank')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Subtract Expenses (Outflow)
    const expensesCash = safeExpenses.filter(e => e && e.paymentMethod === 'cash').reduce((sum, e) => sum + (e.amount || 0), 0);
    const expensesBank = safeExpenses.filter(e => e && e.paymentMethod === 'bank').reduce((sum, e) => sum + (e.amount || 0), 0);
    const expensesCard = safeExpenses.filter(e => e && e.paymentMethod === 'card').reduce((sum, e) => sum + (e.amount || 0), 0); // Assuming card expenses reduce card balance

    // Net Cash Positions
    const netCash = Math.max(0, cashSales + clientRepaymentsCash - supplierPaymentsCash - expensesCash - clientReturnsCash);
    const netBank = Math.max(0, bankSales + clientRepaymentsBank - supplierPaymentsBank - expensesBank);
    const netCard = Math.max(0, cardSales + clientRepaymentsCard - expensesCard);

    // 3. Fixed Assets Value
    const fixedAssetsValue = safeFixedAssets.reduce((sum, asset) => sum + ((asset.currentValue || 0)), 0);

    // 4. Accounts Receivable (Дебиторская задолженность)
    // Use totalDebt from clients - this is the most accurate source
    const accountsReceivable = safeClients.reduce((sum, client) => sum + (client.totalDebt || 0), 0);

    // Total Expenses (already subtracted from cash, but needed for net profit calc)
    const totalExpensesAll = safeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Liquid Assets (Net)
    const totalLiquidAssets = netCash + netBank + netCard;

    const totalAssets = inventoryValue + totalLiquidAssets + accountsReceivable + fixedAssetsValue;

    // --- PASSIVES (ПАССИВЫ) ---

    // 1. VAT Liability (Owed to Government)
    const vatLiability = safeOrders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);

    // 2. Equity / Capital (Initial Investment in Inventory)
    // This represents the initial capital invested to purchase inventory
    const equity = inventoryValue;

    // 3. Fixed Assets Fund (Capital invested in Fixed Assets)
    const fixedAssetsFund = fixedAssetsValue;

    // 4. Net Profit (for display purposes - from PnL)
    // Revenue (excluding VAT)
    const revenue = safeOrders.reduce((sum, o) => sum + (o.subtotalAmount || 0), 0);

    // COGS (Cost of Goods Sold)
    const cogs = safeOrders.reduce((sumOrder, order) => {
        if (!order.items || !Array.isArray(order.items)) return sumOrder;
        const orderCost = order.items.reduce((sumItem, item) => {
            return sumItem + ((item.quantity || 0) * (item.costAtSale || 0));
        }, 0);
        return sumOrder + orderCost;
    }, 0);

    // Gross Profit
    const grossProfit = revenue - cogs;

    // Net Profit = Gross Profit - Operating Expenses
    const netProfit = grossProfit - totalExpensesAll;

    // 5. Retained Earnings (Balancing Item)
    // This is what makes Assets = Liabilities + Equity
    // Retained Earnings = Total Assets - (Equity + Fixed Assets Fund + VAT Liability)
    const retainedEarnings = totalAssets - equity - fixedAssetsFund - vatLiability;

    const totalPassives = equity + fixedAssetsFund + retainedEarnings + vatLiability;

    // Chart Data
    const assetsData = [
        { name: 'Осн. Средства', value: fixedAssetsValue, color: '#0ea5e9' }, // Sky blue
        { name: 'Товар', value: inventoryValue, color: '#3b82f6' },
        { name: 'Касса (Нал)', value: netCash, color: '#10b981' },
        { name: 'Р/С (Банк)', value: netBank, color: '#8b5cf6' },
        { name: 'Дебиторка', value: accountsReceivable, color: '#f59e0b' },
    ].filter(item => item.value > 0);

    const passivesData = [
        { name: 'Товарный капитал', value: equity, color: '#8b5cf6' },
        { name: 'Фонд ОС', value: fixedAssetsFund, color: '#0ea5e9' },
        { name: 'Нераспр. прибыль', value: retainedEarnings > 0 ? retainedEarnings : 0, color: '#f59e0b' },
        { name: 'Обязательства по НДС', value: vatLiability, color: '#ef4444' },
    ].filter(item => item.value > 0);

    const formatCurrency = (val: number) =>
        `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="p-6 space-y-8 animate-fade-in pb-20">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Управленческий Баланс</h2>
                    <p className="text-slate-400 mt-1">Активы и Пассивы компании (USD)</p>
                </div>
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-3">
                    <Scale className="text-primary-500" size={24} />
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-bold">Валюта баланса</p>
                        <p className="text-xl font-mono font-bold text-white">{formatCurrency(totalAssets)}</p>
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets Card */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border-t-4 border-t-emerald-500 border-x border-b border-slate-700 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="text-emerald-500" /> АКТИВ
                            </h3>
                            <p className="text-slate-400 text-sm">Куда вложены средства</p>
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-mono">
                            {formatCurrency(totalAssets)}
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-sky-500 rounded-full"></div>
                                <span className="text-slate-300">Основные средства</span>
                            </div>
                            <span className="font-mono text-sky-400">{formatCurrency(fixedAssetsValue)}</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                <span className="text-slate-300">Товарные запасы</span>
                            </div>
                            <span className="font-mono text-blue-400">{formatCurrency(inventoryValue)}</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                                <span className="text-slate-300">Касса (Наличные)</span>
                            </div>
                            <span className="font-mono text-emerald-400">{formatCurrency(netCash)}</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                                <span className="text-slate-300">Расчетный счет</span>
                            </div>
                            <span className="font-mono text-purple-400">{formatCurrency(netBank)}</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-indigo-400 rounded-full"></div>
                                <span className="text-slate-300">Терминал / Карта</span>
                            </div>
                            <span className="font-mono text-indigo-400">{formatCurrency(netCard)}</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
                                <span className="text-slate-300">Дебиторская задолженность</span>
                            </div>
                            <span className="font-mono text-amber-400">{formatCurrency(accountsReceivable)}</span>
                        </div>
                    </div>
                </div>

                {/* Passives Card */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border-t-4 border-t-indigo-500 border-x border-b border-slate-700 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Building2 className="text-indigo-500" /> ПАССИВ
                            </h3>
                            <p className="text-slate-400 text-sm">Источники средств</p>
                        </div>
                        <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-sm font-mono">
                            {formatCurrency(totalPassives)}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-indigo-500 rounded-full"></div>
                                <div>
                                    <p className="text-white font-medium">Собственный капитал</p>
                                    <p className="text-xs text-slate-500">Инвестиции в товар</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-indigo-400">{formatCurrency(equity)}</p>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-sky-500 rounded-full"></div>
                                <div>
                                    <p className="text-white font-medium">Фонд основных средств</p>
                                    <p className="text-xs text-slate-500">Инвестиции в ОС</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-sky-400">{formatCurrency(fixedAssetsFund)}</p>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-amber-500 rounded-full"></div>
                                <div>
                                    <p className="text-white font-medium">Нераспределенная прибыль</p>
                                    <p className="text-xs text-slate-500">Retained Earnings</p>
                                </div>
                            </div>
                            <p className={`font-mono text-lg ${retainedEarnings >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                {formatCurrency(retainedEarnings)}
                            </p>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-red-500 rounded-full"></div>
                                <div>
                                    <p className="text-white font-medium">Обязательства по НДС</p>
                                    <p className="text-xs text-slate-500">Подлежит уплате в бюджет</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-red-400">{formatCurrency(vatLiability)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h4 className="text-lg font-bold text-white mb-4 text-center">Структура Пассивов</h4>
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
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col justify-center items-center text-center space-y-6">
                    <div className="p-4 bg-emerald-500/10 rounded-full">
                        <Landmark size={48} className="text-emerald-500" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white">Финансовая сводка</h4>
                        <p className="text-slate-400 max-w-md mx-auto mt-2">
                            Текущий денежный поток позволяет покрыть налоговые обязательства. Зарезервировано <span className="text-white font-bold">{formatCurrency(vatLiability)}</span> на НДС.
                        </p>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-lg p-4 grid grid-cols-2 gap-4 divide-x divide-slate-600">
                        <div>
                            <p className="text-xs text-slate-500">Чистая Прибыль</p>
                            <p className={`font-bold ${netProfit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                {formatCurrency(netProfit)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Расходы</p>
                            <p className="text-red-400 font-bold">{formatCurrency(totalExpensesAll)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
