import React, { useState, useMemo } from 'react';
import { Product, Purchase, PurchaseItem, PurchaseOverheads, Transaction, AppSettings } from '../types';
import { Plus, Trash2, Save, Calculator, Container, DollarSign, AlertTriangle, Truck, Scale, FileText, History, Wallet, CheckCircle, Globe, MapPin } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface ProcurementProps {
    products: Product[];
    setProducts: (products: Product[]) => void;
    settings: AppSettings;
    purchases: Purchase[];
    onSavePurchases: (purchases: Purchase[]) => void;
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
    onSaveProducts?: (products: Product[]) => Promise<void>;
    onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
}

export const Procurement: React.FC<ProcurementProps> = ({ products, setProducts, settings, purchases, onSavePurchases, transactions, setTransactions, onSaveProducts, onSaveTransactions }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [procurementType, setProcurementType] = useState<'local' | 'import'>('local'); // Main switch
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Payment Logic
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'debt'>('cash');
    const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'UZS'>('USD'); // Currency for cash/bank payments
    const [amountPaid, setAmountPaid] = useState<number>(0);

    // Cart logic
    const [selectedProductId, setSelectedProductId] = useState('');
    const [inputQty, setInputQty] = useState<number>(0);
    const [inputPrice, setInputPrice] = useState<number>(0); // Invoice Price for Import, Purchase Price for Local

    const [cart, setCart] = useState<PurchaseItem[]>([]);

    // Overheads (Only for Import)
    const [overheads, setOverheads] = useState<PurchaseOverheads>({
        logistics: 0,
        customsDuty: 0,
        importVat: 0,
        other: 0
    });

    // Repayment Modal
    const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
    const [selectedPurchaseForRepayment, setSelectedPurchaseForRepayment] = useState<Purchase | null>(null);
    const [repaymentAmount, setRepaymentAmount] = useState<number>(0);

    // --- Logic to Add Item ---
    const handleAddItem = () => {
        if (!selectedProductId || inputQty <= 0 || inputPrice <= 0) return;

        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        if (cart.some(i => i.productId === product.id)) {
            toast.warning('Этот товар уже добавлен в список. Удалите его, чтобы добавить заново с новыми параметрами.');
            return;
        }

        const newItem: PurchaseItem = {
            productId: product.id,
            productName: product.name,
            quantity: inputQty,
            unit: product.unit,
            invoicePrice: inputPrice,
            landedCost: inputPrice, // Will be updated dynamically for Import, same as price for Local
            totalLineCost: inputQty * inputPrice
        };

        setCart([...cart, newItem]);

        // Reset inputs
        setSelectedProductId('');
        setInputQty(0);
        setInputPrice(0);
    };

    const removeItem = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    // --- Calculation Logic ---
    const totals = useMemo(() => {
        const totalInvoiceValue = cart.reduce((sum, item) => sum + (item.quantity * item.invoicePrice), 0);

        let totalOverheads = 0;
        let totalLandedValue = totalInvoiceValue;
        let itemsWithLandedCost = cart;

        if (procurementType === 'import') {
            totalOverheads = overheads.logistics + overheads.customsDuty + overheads.importVat + overheads.other;
            totalLandedValue = totalInvoiceValue + totalOverheads;

            itemsWithLandedCost = cart.map(item => {
                if (totalInvoiceValue === 0) return item;

                const lineValue = item.quantity * item.invoicePrice;
                const proportion = lineValue / totalInvoiceValue;
                const allocatedOverhead = totalOverheads * proportion;
                const landedCostPerUnit = item.invoicePrice + (allocatedOverhead / item.quantity);

                return {
                    ...item,
                    landedCost: landedCostPerUnit,
                    totalLineCost: (landedCostPerUnit * item.quantity)
                };
            });
        } else {
            // Local: Landed Cost = Invoice Price
            itemsWithLandedCost = cart.map(item => ({
                ...item,
                landedCost: item.invoicePrice,
                totalLineCost: item.quantity * item.invoicePrice
            }));
        }

        return {
            totalInvoiceValue,
            totalOverheads,
            totalLandedValue,
            itemsWithLandedCost
        };
    }, [cart, overheads, procurementType]);

    // Update amountPaid when totals change if method is not debt
    React.useEffect(() => {
        if (paymentMethod !== 'debt') {
            setAmountPaid(totals.totalInvoiceValue); // Usually we pay invoice amount to supplier
        } else {
            setAmountPaid(0);
        }
    }, [totals.totalInvoiceValue, paymentMethod]);

    const handleComplete = () => {
        if (!supplierName || cart.length === 0) return;

        const purchase: Purchase = {
            id: `PUR-${Date.now()}`,
            date: new Date(date).toISOString(),
            supplierName,
            status: 'completed',
            items: totals.itemsWithLandedCost,
            overheads: procurementType === 'import' ? overheads : { logistics: 0, customsDuty: 0, importVat: 0, other: 0 },
            totalInvoiceAmount: totals.totalInvoiceValue,
            totalLandedAmount: totals.totalLandedValue,
            paymentMethod,
            paymentStatus: paymentMethod === 'debt' ? 'unpaid' : 'paid',
            amountPaid: paymentMethod === 'debt' ? 0 : totals.totalInvoiceValue
        };

        // 1. Save Purchase
        onSavePurchases([...purchases, purchase]);

        // 2. If paid immediately, record Transaction (Expense)
        if (paymentMethod !== 'debt') {
            // Calculate amount in the payment currency
            // If paying in UZS, convert USD amount to UZS
            const transactionAmount = paymentCurrency === 'UZS' 
                ? totals.totalInvoiceValue * settings.defaultExchangeRate
                : totals.totalInvoiceValue;
            
            const newTransaction: Transaction = {
                id: `TRX-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'supplier_payment',
                amount: transactionAmount,
                currency: paymentCurrency,
                exchangeRate: paymentCurrency === 'UZS' ? settings.defaultExchangeRate : undefined,
                method: paymentMethod as 'cash' | 'bank',
                description: `Оплата поставщику (${procurementType === 'local' ? 'Местный' : 'Импорт'}): ${supplierName} (Закупка #${purchase.id})`,
                relatedId: purchase.id
            };
            const updatedTransactions = [...transactions, newTransaction];
            setTransactions(updatedTransactions);
            if (onSaveTransactions) {
                onSaveTransactions(updatedTransactions);
            }
        }

        // 3. Update Product Stock & Cost
        const updatedProducts = products.map(p => {
            const item = totals.itemsWithLandedCost.find(i => i.productId === p.id);
            if (item) {
                const newQuantity = p.quantity + item.quantity;
                // Weighted Average Cost
                const oldValue = p.quantity * p.costPrice;
                const newValue = item.quantity * item.landedCost;
                const newCost = (oldValue + newValue) / newQuantity;

                return {
                    ...p,
                    quantity: newQuantity,
                    costPrice: newCost
                };
            }
            return p;
        });
        setProducts(updatedProducts);
        if (onSaveProducts) {
            onSaveProducts(updatedProducts);
        }

        // Reset
        setCart([]);
        setSupplierName('');
        setOverheads({ logistics: 0, customsDuty: 0, importVat: 0, other: 0 });
        setPaymentMethod('cash');
        setPaymentCurrency('USD');
        toast.success('Закупка успешно проведена! Остатки и себестоимость обновлены.');
    };

    // ...

    const handleOpenRepayModal = (purchase: Purchase) => {
        setSelectedPurchaseForRepayment(purchase);
        setRepaymentAmount(purchase.totalInvoiceAmount - purchase.amountPaid);
        setIsRepayModalOpen(true);
    };

    const handleRepayDebt = () => {
        if (!selectedPurchaseForRepayment || repaymentAmount <= 0) return;

        // 1. Create Transaction
        const newTransaction: Transaction = {
            id: `TRX-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'supplier_payment',
            amount: repaymentAmount,
            currency: 'USD',
            exchangeRate: settings.defaultExchangeRate, // Store exchange rate for proper conversion
            method: 'cash', // Default
            description: `Погашение долга поставщику: ${selectedPurchaseForRepayment.supplierName} (Закупка #${selectedPurchaseForRepayment.id})`,
            relatedId: selectedPurchaseForRepayment.id
        };
        const updatedTransactions = [...transactions, newTransaction];
        setTransactions(updatedTransactions);
        if (onSaveTransactions) {
            onSaveTransactions(updatedTransactions);
        }

        // 2. Update Purchase
        const updatedPurchases = purchases.map(p => {
            if (p.id === selectedPurchaseForRepayment.id) {
                const newAmountPaid = p.amountPaid + repaymentAmount;
                return {
                    ...p,
                    amountPaid: newAmountPaid,
                    paymentStatus: newAmountPaid >= p.totalInvoiceAmount ? 'paid' : 'partial'
                } as Purchase;
            }
            return p;
        });
        onSavePurchases(updatedPurchases);

        setIsRepayModalOpen(false);
        toast.success('Оплата поставщику проведена успешно!');
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Закуп и Импорт</h2>
                    <p className="text-slate-400 mt-1">Управление поставками и расчетами</p>
                </div>

                {/* Main Mode Switcher */}
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mr-auto ml-8">
                    <button
                        onClick={() => setProcurementType('local')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${procurementType === 'local' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <MapPin size={16} /> Местный Закуп
                    </button>
                    <button
                        onClick={() => setProcurementType('import')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${procurementType === 'import' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Globe size={16} /> Импорт
                    </button>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'new' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Новая закупка
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        История и Долги
                    </button>
                </div>
            </div>

            {activeTab === 'new' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                    {/* Left: Inputs & Overheads */}
                    <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-20">
                        {/* Document Info */}
                        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <FileText size={18} className="text-primary-500" /> Основное ({procurementType === 'local' ? 'Местный' : 'Импорт'})
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Поставщик</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Название поставщика"
                                    value={supplierName}
                                    onChange={e => setSupplierName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Дата прихода</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Оплата</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => {
                                            setPaymentMethod('cash');
                                            // Keep current currency for cash
                                        }}
                                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        Наличные
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPaymentMethod('bank');
                                            setPaymentCurrency('UZS'); // Bank transfers are always in UZS
                                        }}
                                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'bank' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        Перечисление
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('debt')}
                                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        В долг
                                    </button>
                                </div>
                                {/* Currency Selection - Only for cash, not for bank (always UZS) or debt */}
                                {paymentMethod === 'cash' && (
                                    <div className="mt-2">
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Валюта оплаты</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setPaymentCurrency('USD')}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${paymentCurrency === 'USD' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                            >
                                                💵 USD
                                            </button>
                                            <button
                                                onClick={() => setPaymentCurrency('UZS')}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${paymentCurrency === 'UZS' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                            >
                                                💰 UZS
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* Show currency info for bank (always UZS) */}
                                {paymentMethod === 'bank' && (
                                    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <p className="text-xs text-blue-400">💰 Перечисление всегда в UZS</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add Item Form */}
                        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Plus size={18} className="text-emerald-500" /> Добавить товар
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Товар</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={selectedProductId}
                                    onChange={e => setSelectedProductId(e.target.value)}
                                >
                                    <option value="">-- Выберите товар --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.dimensions})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Кол-во</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="0"
                                        value={inputQty || ''}
                                        onChange={e => setInputQty(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">
                                        {procurementType === 'import' ? 'Цена Invoice (USD)' : 'Цена закупки (USD)'}
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="0.00"
                                        value={inputPrice || ''}
                                        onChange={e => setInputPrice(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAddItem}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20"
                            >
                                Добавить в список
                            </button>
                        </div>

                        {/* Overheads Form - ONLY FOR IMPORT */}
                        {procurementType === 'import' && (
                            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg relative overflow-hidden animate-fade-in">
                                <div className="absolute -right-6 -top-6 text-slate-700 opacity-20">
                                    <Container size={100} />
                                </div>
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <Truck size={18} className="text-amber-500" /> Накладные расходы (USD)
                                </h3>
                                <p className="text-xs text-slate-500">Распределяются на себестоимость пропорционально сумме.</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Логистика</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                            value={overheads.logistics || ''}
                                            onChange={e => setOverheads({ ...overheads, logistics: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Тамож. Пошлина</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                            value={overheads.customsDuty || ''}
                                            onChange={e => setOverheads({ ...overheads, customsDuty: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Тамож. НДС</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                            value={overheads.importVat || ''}
                                            onChange={e => setOverheads({ ...overheads, importVat: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Прочее</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                            value={overheads.other || ''}
                                            onChange={e => setOverheads({ ...overheads, other: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Items Table & Summary */}
                    <div className="lg:col-span-2 flex flex-col h-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Scale className="text-blue-500" /> Список товаров к приходу
                            </h3>
                            <div className="bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                                <span className="text-xs text-blue-300">Позиций: </span>
                                <span className="font-mono font-bold text-white">{cart.length}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-medium sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Товар</th>
                                        <th className="px-4 py-3 text-right">Кол-во</th>
                                        <th className="px-4 py-3 text-right">Цена</th>
                                        {procurementType === 'import' && (
                                            <th className="px-4 py-3 text-right bg-amber-500/5 text-amber-200">Себест. (Landed)</th>
                                        )}
                                        <th className="px-4 py-3 text-right">Сумма</th>
                                        <th className="px-4 py-3 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {totals.itemsWithLandedCost.map((item) => (
                                        <tr key={item.productId} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-3 font-medium text-slate-200">{item.productName}</td>
                                            <td className="px-4 py-3 text-right font-mono">{item.quantity} <span className="text-xs text-slate-500">{item.unit}</span></td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-400">${item.invoicePrice.toFixed(2)}</td>
                                            {procurementType === 'import' && (
                                                <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 bg-amber-500/5">${item.landedCost.toFixed(2)}</td>
                                            )}
                                            <td className="px-4 py-3 text-right font-mono text-slate-200">${item.totalLineCost.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => removeItem(item.productId)} className="text-slate-600 hover:text-red-400 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {cart.length === 0 && (
                                        <tr>
                                            <td colSpan={procurementType === 'import' ? 6 : 5} className="px-6 py-12 text-center text-slate-500">
                                                Список пуст. Добавьте товары слева.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Summary */}
                        <div className="bg-slate-900 p-6 border-t border-slate-700">
                            <div className="grid grid-cols-3 gap-8 mb-6">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Сумма закупки</p>
                                    <p className="text-xl font-mono font-bold text-slate-300">${totals.totalInvoiceValue.toFixed(2)}</p>
                                </div>
                                {procurementType === 'import' && (
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase">Накладные расходы</p>
                                        <p className="text-xl font-mono font-bold text-amber-400">+${totals.totalOverheads.toFixed(2)}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Итого Себестоимость</p>
                                    <p className="text-2xl font-mono font-bold text-white border-b-2 border-primary-500 inline-block">
                                        ${totals.totalLandedValue.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Payment Info */}
                            {paymentMethod !== 'debt' && (
                                <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                                    <p className="text-xs text-slate-400 mb-1">Оплата будет списана:</p>
                                    <p className="text-sm font-mono text-white">
                                        {paymentMethod === 'cash' ? '💵 Касса' : '🏦 Расчетный счет'} - {
                                            paymentCurrency === 'USD' 
                                                ? `$${totals.totalInvoiceValue.toFixed(2)}`
                                                : `${(totals.totalInvoiceValue * settings.defaultExchangeRate).toLocaleString()} сўм`
                                        }
                                    </p>
                                </div>
                            )}
                            
                            {paymentMethod === 'debt' && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <p className="text-xs text-red-400 mb-1">⚠️ Закупка будет оформлена в долг</p>
                                    <p className="text-sm font-mono text-red-300">
                                        Долг: ${totals.totalInvoiceValue.toFixed(2)} USD
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                                <p className="text-xs text-amber-200/80">
                                    При проведении документа остатки товаров увеличатся, а их учетная цена (Cost Price) будет пересчитана по методу <strong>средневзвешенной</strong> стоимости.
                                </p>
                            </div>

                            <button
                                onClick={handleComplete}
                                disabled={cart.length === 0 || !supplierName}
                                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-600/20"
                            >
                                <Save size={22} /> Провести закупку
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <History size={18} className="text-slate-400" /> История закупок и Долги
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 text-xs uppercase text-slate-400 font-medium sticky top-0">
                                <tr>
                                    <th className="px-6 py-4">Дата</th>
                                    <th className="px-6 py-4">Поставщик</th>
                                    <th className="px-6 py-4 text-right">Сумма (Inv.)</th>
                                    <th className="px-6 py-4 text-center">Статус оплаты</th>
                                    <th className="px-6 py-4 text-right">Оплачено</th>
                                    <th className="px-6 py-4 text-right">Долг</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {purchases.slice().reverse().map(purchase => {
                                    const debt = purchase.totalInvoiceAmount - purchase.amountPaid;
                                    return (
                                        <tr key={purchase.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4 text-slate-300">{new Date(purchase.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-medium text-white">{purchase.supplierName}</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-300">${purchase.totalInvoiceAmount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${purchase.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    purchase.paymentStatus === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {purchase.paymentStatus === 'paid' ? 'Оплачено' :
                                                        purchase.paymentStatus === 'partial' ? 'Частично' : 'Не оплачено'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-emerald-400">${purchase.amountPaid.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-red-400 font-bold">
                                                {debt > 0 ? `$${debt.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {debt > 0 && (
                                                    <button
                                                        onClick={() => handleOpenRepayModal(purchase)}
                                                        className="text-xs bg-slate-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1 ml-auto"
                                                    >
                                                        <Wallet size={14} /> Оплатить
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {purchases.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                            История закупок пуста.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Repayment Modal */}
            {isRepayModalOpen && selectedPurchaseForRepayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="text-emerald-500" /> Оплата поставщику
                            </h3>
                            <button onClick={() => setIsRepayModalOpen(false)} className="text-slate-400 hover:text-white">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <p className="text-sm text-slate-400 mb-1">Поставщик</p>
                                <p className="text-lg font-bold text-white">{selectedPurchaseForRepayment.supplierName}</p>
                                <div className="mt-3 flex justify-between items-end">
                                    <span className="text-sm text-slate-500">Остаток долга:</span>
                                    <span className="text-xl font-mono font-bold text-red-400">
                                        ${(selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Сумма оплаты ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={repaymentAmount || ''}
                                        onChange={e => setRepaymentAmount(Number(e.target.value))}
                                        max={selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleRepayDebt}
                                disabled={repaymentAmount <= 0}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
                            >
                                Подтвердить оплату
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
