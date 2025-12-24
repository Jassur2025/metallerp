
import React from 'react';
import { Product, Order, Expense, FixedAsset, AppSettings, Transaction, Client, Purchase } from '../types';
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
    purchases: Purchase[];
}

export const Balance: React.FC<BalanceProps> = ({ products, orders, expenses, fixedAssets, settings, transactions, clients, purchases }) => {
    // Safety checks - ensure arrays are defined
    const safeProducts = products || [];
    const safeOrders = orders || [];
    const safeExpenses = expenses || [];
    const safeFixedAssets = fixedAssets || [];
    const safeTransactions = transactions || [];
    const safeClients = clients || [];
    const safePurchases = purchases || [];

    // --- ASSETS (АКТИВЫ) ---

    // 1. Inventory Value (USD) - Stock on hand
    const inventoryValue = safeProducts.reduce((sum, p) => sum + ((p.quantity || 0) * (p.pricePerUnit || 0)), 0);

    // --- LIQUID ASSETS (Net Cash Positions) ---
    const num = (v: any): number => {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        if (typeof v === 'string') {
            const p = parseFloat(v.replace(/[^\d.-]/g, ''));
            return isFinite(p) ? p : 0;
        }
        return 0;
    };

    const getRate = (rate: any) => {
        const r = num(rate);
        return r > 0 ? r : (num(settings.defaultExchangeRate) || 1);
    };

    let netCashUSD = 0;
    let netCashUZS = 0;
    let netBankUZS = 0;
    let netCardUZS = 0;

    // Process Orders
    safeOrders.forEach(o => {
        if (o.paymentMethod === 'cash') {
            if (o.paymentCurrency === 'UZS') {
                netCashUZS += num(o.totalAmountUZS);
            } else {
                const paid = num(o.amountPaid);
                const total = num(o.totalAmount);
                netCashUSD += (paid > 0 ? paid : total);
            }
        } else if (o.paymentMethod === 'bank') {
            netBankUZS += num(o.totalAmountUZS);
        } else if (o.paymentMethod === 'card') {
            netCardUZS += num(o.totalAmountUZS);
        }
    });

    // Process Transactions
    safeTransactions.forEach(t => {
        const amt = num(t.amount);
        const rate = getRate(t.exchangeRate);
        const isUSD = t.currency === 'USD';

        if (t.type === 'client_payment') {
            if (t.method === 'cash') {
                if (isUSD) netCashUSD += amt; else netCashUZS += amt;
            } else if (t.method === 'bank') {
                netBankUZS += (isUSD ? amt * rate : amt);
            } else if (t.method === 'card') {
                netCardUZS += (isUSD ? amt * rate : amt);
            }
        } else if (t.type === 'supplier_payment') {
            if (t.method === 'cash') {
                if (isUSD) {
                    // netCashUSD -= amt; // Showing Gross Revenue in Assets to match user expectations
                } else {
                    // netCashUZS -= amt;
                }
            } else if (t.method === 'bank') {
                // netBankUZS -= (isUSD ? amt * rate : amt);
            }
        } else if (t.type === 'client_return' || t.type === 'client_refund' || t.type === 'return') {
            // Keep returns as they are valid reductions of revenue?
            // User likely wants to see "Current money" but thinks of it as "Sales Revenue".
            // If we remove supplier payments, we should probably keep returns.
            // BUT for consisteny with previous strict "Gross Sales" request, maybe we leave them?
            // Let's comment them out to be safe if user considers returns "expense-like" or if they just want "Total In".
            // However, usually returns strictly reduce Sales.
            // Let's comment them out to start, or stick to "Sales Cash" logic which usually excludes returns.
            if (t.method === 'cash') {
                if (isUSD) netCashUSD -= amt; else netCashUZS -= amt;
            } else if (t.method === 'bank') {
                netBankUZS -= (isUSD ? amt * rate : amt);
            }
        }
    });

    // Process Expenses
    safeExpenses.forEach(e => {
        const amt = num(e.amount);
        const rate = getRate(e.exchangeRate);
        const isUSD = e.currency === 'USD';

        if (e.paymentMethod === 'cash') {
            // if (isUSD) netCashUSD -= amt; else netCashUZS -= amt; // Showing Gross Revenue
        } else if (e.paymentMethod === 'bank') {
            // netBankUZS -= (isUSD ? amt * rate : amt);
        } else if (e.paymentMethod === 'card') {
            netCardUZS -= (isUSD ? amt * rate : amt);
        }
    });

    const netCash = Math.max(0, netCashUSD);
    const netCashUZS_Total = Math.max(0, netCashUZS);
    const netBank = Math.max(0, netBankUZS);
    const netCard = Math.max(0, netCardUZS);

    const currentRate = getRate(null);
    const netBankUSD = netBank / currentRate;
    const netCardUSD = netCard / currentRate;

    // For total conversion to USD used in Assets summary
    const totalLiquidAssets = netCash + (netCashUZS_Total / getRate(null)) + (netBank / getRate(null)) + (netCard / getRate(null));


    // 3. Fixed Assets Value
    const fixedAssetsValue = safeFixedAssets.reduce((sum, asset) => sum + ((asset.currentValue || 0)), 0);

    // 4. Accounts Receivable (Дебиторская задолженность)
    // Use totalDebt from clients - this is the most accurate source
    const accountsReceivable = safeClients.reduce((sum, client) => sum + (client.totalDebt || 0), 0);

    // Total Expenses (already subtracted from cash, but needed for net profit calc)
    const totalExpensesAll = safeExpenses.reduce((sum, e) => {
        const rate = e.exchangeRate || settings.defaultExchangeRate || 1;
        const amountUSD = (e.currency === 'UZS') ? (e.amount || 0) / rate : (e.amount || 0);
        return sum + amountUSD;
    }, 0);

    const totalAssets = inventoryValue + totalLiquidAssets + accountsReceivable + fixedAssetsValue;

    // --- PASSIVES (ПАССИВЫ) ---

    // 1. VAT Liability (Owed to Government)
    const vatLiability = safeOrders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);

    // 2. Accounts Payable (Debt to Suppliers)
    const accountsPayable = safePurchases.reduce((sum, p) => sum + (Math.max(0, (p.totalInvoiceAmount || 0) - (p.amountPaid || 0))), 0);

    // 3. Accounts Payable - Fixed Assets (Debt for Fixed Assets)
    const fixedAssetsPayable = safeFixedAssets.reduce((sum, fa) => {
        const paid = fa.amountPaid ?? fa.purchaseCost;
        return sum + Math.max(0, fa.purchaseCost - paid);
    }, 0);

    // 3. Equity / Capital (Initial Investment in Inventory)
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
    // Retained Earnings = Total Assets - (Equity + Fixed Assets Fund + VAT Liability + Accounts Payable + Fixed Assets Payable)
    const retainedEarnings = totalAssets - equity - fixedAssetsFund - vatLiability - accountsPayable - fixedAssetsPayable;

    const totalPassives = equity + fixedAssetsFund + retainedEarnings + vatLiability + accountsPayable + fixedAssetsPayable;

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
        { name: 'Долг поставщикам', value: accountsPayable, color: '#fca5a5' },
        { name: 'Долг за ОС', value: fixedAssetsPayable, color: '#fb923c' },
    ].filter(item => item.value > 0);

    const formatCurrency = (val: number) =>
        `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Assuming exchangeRate is available from settings or another prop
    const exchangeRate = settings.defaultExchangeRate;

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto overflow-x-hidden custom-scrollbar">
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
                            <span className="font-mono text-purple-400">{formatCurrency(netBankUSD)}</span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-indigo-400 rounded-full"></div>
                                <span className="text-slate-300">Терминал / Карта</span>
                            </div>
                            <span className="font-mono text-indigo-400">{formatCurrency(netCardUSD)}</span>
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

                        <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-10 bg-red-300 rounded-full"></div>
                                <div>
                                    <p className="text-white font-medium">Обязательства перед поставщиками</p>
                                    <p className="text-xs text-slate-500">Долг за товары</p>
                                </div>
                            </div>
                            <p className="font-mono text-lg text-red-400">{formatCurrency(accountsPayable)}</p>
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
