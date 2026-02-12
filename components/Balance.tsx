
import React from 'react';
import { Product, Order, Expense, FixedAsset, AppSettings, Transaction, Client, Purchase, WarehouseType, WarehouseLabels } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShieldCheck, Wallet, Building2, Scale, Landmark, AlertTriangle, CheckCircle, Warehouse } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../contexts/ThemeContext';
import { calculateBaseTotals } from '../utils/finance';

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
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    // Safety checks - ensure arrays are defined
    const safeProducts = products || [];
    const safeOrders = orders || [];
    const safeExpenses = expenses || [];
    const safeFixedAssets = fixedAssets || [];
    const safeTransactions = transactions || [];
    const safeClients = clients || [];
    const safePurchases = purchases || [];

    // --- ASSETS (АКТИВЫ) ---

    // 1. Inventory Value (USD) - Stock on hand по СЕБЕСТОИМОСТИ (costPrice)
    // Рассчитываем по складам (без НДС, так как costPrice уже без НДС)
    const inventoryByWarehouse = {
        main: safeProducts
            .filter(p => (p.warehouse || WarehouseType.MAIN) === WarehouseType.MAIN)
            .reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0),
        cloud: safeProducts
            .filter(p => p.warehouse === WarehouseType.CLOUD)
            .reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0)
    };
    const inventoryValue = inventoryByWarehouse.main + inventoryByWarehouse.cloud;

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
        // Курс должен быть реалистичным (например ~12000-13000 UZS за 1 USD)
        // Если курс меньше 100, считаем его некорректным и используем дефолтный
        const defaultRate = num(settings.defaultExchangeRate);
        const safeDefault = defaultRate > 100 ? defaultRate : 12800;
        return r > 100 ? r : safeDefault;
    };

    // Use centralized logic for calculating balances
    const { cashUSD: netCashUSD, cashUZS: netCashUZS, bankUZS: netBankUZS, cardUZS: netCardUZS, corrections } = calculateBaseTotals(
        safeOrders,
        safeTransactions,
        safeExpenses,
        settings.defaultExchangeRate
    );






    const currentRate = getRate(null);
    const totalCashUSD = netCashUSD + (netCashUZS / currentRate);
    const netBankUSD = netBankUZS / currentRate;
    const netCardUSD = netCardUZS / currentRate;

    // For total conversion to USD used in Assets summary
    const totalLiquidAssets = totalCashUSD + netBankUSD + netCardUSD;


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
    // НДС исходящий (с продаж)
    const vatOutput = safeOrders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);
    // НДС входящий (с закупок) — к зачёту
    const vatInput = safePurchases.reduce((sum, p) => {
        // totalVatAmountUZS хранится в сумах, конвертируем в USD
        if (p.totalVatAmountUZS && p.totalVatAmountUZS > 0) {
            const purchaseRate = p.exchangeRate || settings.defaultExchangeRate || currentRate;
            return sum + (p.totalVatAmountUZS / purchaseRate);
        }
        // Legacy: суммируем НДС из позиций (уже в UZS), конвертируем
        if (p.items && Array.isArray(p.items)) {
            const itemsVatUZS = p.items.reduce((s, item) => s + (item.vatAmount || 0), 0);
            if (itemsVatUZS > 0) {
                const purchaseRate = p.exchangeRate || settings.defaultExchangeRate || currentRate;
                return sum + (itemsVatUZS / purchaseRate);
            }
        }
        return sum;
    }, 0);
    // Чистый НДС к уплате = исходящий - входящий (не может быть < 0 для баланса)
    const vatLiability = Math.max(0, vatOutput - vatInput);

    // 2. Accounts Payable (Debt to Suppliers) - Кредиторка в USD
    // Если есть новые поля (totalInvoiceAmountUZS), используем их, иначе legacy
    const accountsPayable = safePurchases.reduce((sum, p) => {
        const purchaseRate = p.exchangeRate || settings.defaultExchangeRate || currentRate;

        // Новая логика: долг в UZS с НДС (только если сумма в сумах > 0)
        if (p.totalInvoiceAmountUZS && p.totalInvoiceAmountUZS > 0) {
            const totalDebtUZS = (p.totalInvoiceAmountUZS || 0) - (p.amountPaid || 0);
            return sum + Math.max(0, totalDebtUZS / purchaseRate);
        }

        // Legacy: долг в USD
        // amountPaidUSD — всегда в USD; amountPaid может быть UZS в новой схеме
        // Используем amountPaidUSD если определён, иначе amountPaid (только для legacy, где amountPaid был в USD)
        const amountPaidUSD = (p.amountPaidUSD !== undefined && p.amountPaidUSD !== null)
            ? p.amountPaidUSD
            : (p.amountPaid || 0);
        return sum + Math.max(0, (p.totalInvoiceAmount || 0) - amountPaidUSD);
    }, 0);

    // 3. Accounts Payable - Fixed Assets (Debt for Fixed Assets)
    const fixedAssetsPayable = safeFixedAssets.reduce((sum, fa) => {
        const paid = fa.amountPaid ?? fa.purchaseCost;
        return sum + Math.max(0, fa.purchaseCost - paid);
    }, 0);

    // 3. Equity / Capital (Собственный капитал)
    // Собственный капитал = Активы - Обязательства
    // Но для баланса: если товар куплен в долг, то собственный капитал = 0
    // Если товар оплачен, то собственный капитал = стоимость оплаченного товара
    const paidForInventory = safePurchases.reduce((sum, p) => {
        // Используем amountPaidUSD если есть, иначе конвертируем amountPaid
        if (p.amountPaidUSD !== undefined) {
            return sum + (p.amountPaidUSD || 0);
        }
        // Legacy: amountPaid уже в USD
        return sum + (p.amountPaid || 0);
    }, 0);
    const equity = paidForInventory;

    // 3. Fixed Assets Fund (Capital invested in Fixed Assets)
    // Equity in FA = Total Book Value - Remaining Debt
    const fixedAssetsFund = Math.max(0, fixedAssetsValue - fixedAssetsPayable);

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

    const formatCurrency = (val: number) =>
        `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Assuming exchangeRate is available from settings or another prop
    const exchangeRate = settings.defaultExchangeRate;

    // --- AUDIT SECTION (Finding major errors) ---
    const suspiciousThreshold = 1000000; // $1M
    const largeOrders = safeOrders.filter(o => (o.totalAmount || 0) > suspiciousThreshold);
    const largeTransactions = safeTransactions.filter(t => {
        const rate = getRate(t.exchangeRate);
        const amountUSD = t.currency === 'UZS' ? (num(t.amount) / rate) : num(t.amount);
        return amountUSD > suspiciousThreshold;
    });
    const largeExpenses = safeExpenses.filter(e => {
        const rate = getRate(e.exchangeRate);
        const amountUSD = e.currency === 'UZS' ? (num(e.amount) / rate) : num(e.amount);
        return amountUSD > suspiciousThreshold;
    });

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
                            <p className="text-red-500 font-bold">{formatCurrency(totalExpensesAll)}</p>
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

            {/* Audit Section - Only shown if huge amounts exist */}
            {(largeOrders.length > 0 || largeTransactions.length > 0 || largeExpenses.length > 0) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                        <Scale className="text-red-500" /> ВНИМАНИЕ: Ошибки в данных
                    </h3>
                    <p className={`${t.textMuted} text-sm mb-4`}>
                        Найдены записи с аномально большими суммами (более $1 000 000). Проверьте их в истории:
                    </p>
                    <div className="space-y-2">
                        {largeOrders.map(o => (
                            <div key={o.id} className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} p-3 rounded-xl flex justify-between items-center border border-red-500/20`}>
                                <div>
                                    <p className={`${t.text} font-mono text-sm`}>Заказ: {o.id}</p>
                                    <p className={`text-xs ${t.textMuted}`}>{o.date} • {o.customerName}</p>
                                </div>
                                <span className="text-red-500 font-bold font-mono">{formatCurrency(o.totalAmount)}</span>
                            </div>
                        ))}
                        {largeTransactions.map(tx => (
                            <div key={tx.id} className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} p-3 rounded-xl flex justify-between items-center border border-red-500/20`}>
                                <div>
                                    <p className={`${t.text} font-mono text-sm`}>Транзакция: {tx.id} ({tx.type})</p>
                                    <p className={`text-xs ${t.textMuted}`}>{tx.date} • {tx.description}</p>
                                </div>
                                <span className="text-red-500 font-bold font-mono">
                                    {formatCurrency(tx.currency === 'UZS' ? num(tx.amount) / getRate(tx.exchangeRate) : num(tx.amount))}
                                </span>
                            </div>
                        ))}
                        {largeExpenses.map(e => (
                            <div key={e.id} className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} p-3 rounded-xl flex justify-between items-center border border-red-500/20`}>
                                <div>
                                    <p className={`${t.text} font-mono text-sm`}>Расход: {e.id}</p>
                                    <p className={`text-xs ${t.textMuted}`}>{e.date} • {e.description}</p>
                                </div>
                                <span className="text-red-500 font-bold font-mono">
                                    {formatCurrency(e.currency === 'UZS' ? num(e.amount) / getRate(e.exchangeRate) : num(e.amount))}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
