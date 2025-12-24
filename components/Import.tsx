import React, { useState, useMemo } from 'react';
import {
    Purchase, Product, Transaction, ProductType, Unit,
    PurchaseItem, PurchaseOverheads, AppSettings
} from '../types';
import { Plus, Trash2, Save, Calculator, Container, DollarSign, AlertTriangle, Truck, Scale, FileText, History, Wallet, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { PaymentSplitModal, PaymentDistribution } from './Sales/PaymentSplitModal';

interface ImportProps {
    products: Product[];
    setProducts: (products: Product[]) => void;
    settings: AppSettings;
    purchases: Purchase[];
    onSavePurchases: (purchases: Purchase[]) => void;
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
}

export const Import: React.FC<ImportProps> = ({ products, setProducts, settings, purchases, onSavePurchases, transactions, setTransactions }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Payment Logic
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'debt' | 'mixed'>('cash');
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [amountPaid, setAmountPaid] = useState<number>(0);

    // Cart logic
    const [selectedProductId, setSelectedProductId] = useState('');
    const [inputProductName, setInputProductName] = useState(''); // For manual product name input
    const [inputQty, setInputQty] = useState<number>(0);
    const [inputInvoicePrice, setInputInvoicePrice] = useState<number>(0);
    const [inputUnit, setInputUnit] = useState<Unit>(Unit.PIECE); // Unit for new products

    const [cart, setCart] = useState<PurchaseItem[]>([]);

    // Overheads
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
    const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

    // --- Logic to Add Item ---
    const handleAddItem = () => {
        // Check if we have product ID or product name
        if ((!selectedProductId && !inputProductName.trim()) || inputQty <= 0 || inputInvoicePrice <= 0) {
            toast.warning('Заполните название товара, количество и цену');
            return;
        }

        let product: Product | undefined;
        let productId: string;

        // Try to find product by ID first
        if (selectedProductId) {
            product = products.find(p => p.id === selectedProductId);
            productId = selectedProductId;
        } else {
            // Try to find by name
            product = products.find(p => p.name.toLowerCase().trim() === inputProductName.toLowerCase().trim());
            if (product) {
                productId = product.id;
            } else {
                // Auto-create product if not found
                const newProduct: Product = {
                    id: `PROD-${Date.now()}`,
                    name: inputProductName.trim(),
                    type: ProductType.OTHER,
                    dimensions: '-',
                    steelGrade: 'Ст3',
                    quantity: 0,
                    unit: inputUnit,
                    pricePerUnit: 0,
                    costPrice: 0,
                    minStockLevel: 0,
                    origin: 'import'
                };
                setProducts([...products, newProduct]);
                product = newProduct;
                productId = newProduct.id;
                toast.success(`Товар "${newProduct.name}" автоматически создан и добавлен в список`);
            }
        }

        if (!product) {
            toast.error('Ошибка при создании товара');
            return;
        }

        // Check if product already in cart
        if (cart.some(i => i.productId === productId)) {
            toast.warning('Этот товар уже добавлен в список. Удалите его, чтобы добавить заново с новыми параметрами.');
            return;
        }

        const newItem: PurchaseItem = {
            productId: productId,
            productName: product.name,
            quantity: inputQty,
            unit: product.unit,
            invoicePrice: inputInvoicePrice,
            landedCost: inputInvoicePrice, // Placeholder, updated dynamically
            totalLineCost: inputQty * inputInvoicePrice
        };

        setCart([...cart, newItem]);

        // Reset inputs
        setSelectedProductId('');
        setInputProductName('');
        setInputQty(0);
        setInputInvoicePrice(0);
        setInputUnit(Unit.PIECE);
    };

    const removeItem = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    // --- Calculation Logic ---
    const totals = useMemo(() => {
        const totalInvoiceValue = cart.reduce((sum, item) => sum + (item.quantity * item.invoicePrice), 0);

        // Modified: Exclude Customs Duty and Import VAT from Landed Cost calculation
        // They are treated as separate tax/expense items, not part of the product cost.
        const totalOverheads = overheads.logistics + overheads.other;

        // For display purposes, we might want to show the total "out of pocket" including taxes,
        // but for Landed Cost (Cost Price), we only use logistics + other.
        const totalTaxes = overheads.customsDuty + overheads.importVat;
        const totalLandedValue = totalInvoiceValue + totalOverheads;

        const itemsWithLandedCost = cart.map(item => {
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

        return {
            totalInvoiceValue,
            totalOverheads,
            totalTaxes,
            totalLandedValue,
            itemsWithLandedCost
        };
    }, [cart, overheads]);

    // Update amountPaid when totals change if method is not debt
    React.useEffect(() => {
        if (paymentMethod === 'cash' || paymentMethod === 'bank') {
            setAmountPaid(totals.totalInvoiceValue); // Usually we pay invoice amount to supplier
        } else if (paymentMethod === 'debt') {
            setAmountPaid(0);
        }
    }, [totals.totalInvoiceValue, paymentMethod]);


    const finalizePurchase = (distribution?: PaymentDistribution) => {
        if (!supplierName || cart.length === 0) return;

        const totalToPayUSD = totals.totalInvoiceValue;
        const paidUSD = distribution ? totalToPayUSD - distribution.remainingUSD : (paymentMethod === 'debt' ? 0 : totalToPayUSD);
        const status = distribution ? (distribution.isPaid ? 'paid' : (paidUSD > 0 ? 'partial' : 'unpaid')) : (paymentMethod === 'debt' ? 'unpaid' : 'paid');

        const purchase: Purchase = {
            id: `PUR-${Date.now()}`,
            date: new Date(date).toISOString(),
            supplierName,
            status: 'completed',
            items: totals.itemsWithLandedCost,
            overheads,
            totalInvoiceAmount: totals.totalInvoiceValue,
            totalLandedAmount: totals.totalLandedValue,
            paymentMethod: distribution ? 'mixed' : paymentMethod,
            paymentStatus: status as 'paid' | 'unpaid' | 'partial',
            amountPaid: paidUSD
        };

        // 1. Save Purchase
        onSavePurchases([...purchases, purchase]);

        // 2. Create Transactions
        const newTransactions: Transaction[] = [];
        const baseTrx = {
            date: new Date().toISOString(),
            type: 'supplier_payment' as const,
            relatedId: purchase.id,
        };

        if (distribution) {
            if (distribution.cashUSD > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: `TRX-CUSD-${Date.now()}-1`,
                    amount: distribution.cashUSD,
                    currency: 'USD',
                    method: 'cash',
                    description: `Оплата поставщику (USD Cash): ${supplierName} (Закупка #${purchase.id})`
                });
            }
            if (distribution.cashUZS > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: `TRX-CUZS-${Date.now()}-2`,
                    amount: distribution.cashUZS,
                    currency: 'UZS',
                    method: 'cash',
                    description: `Оплата поставщику (UZS Cash): ${supplierName} (Закупка #${purchase.id})`
                });
            }
            if (distribution.cardUZS > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: `TRX-CARD-${Date.now()}-3`,
                    amount: distribution.cardUZS,
                    currency: 'UZS',
                    method: 'card',
                    description: `Оплата поставщику (UZS Card): ${supplierName} (Закупка #${purchase.id})`
                });
            }
            if (distribution.bankUZS > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: `TRX-BANK-${Date.now()}-4`,
                    amount: distribution.bankUZS,
                    currency: 'UZS',
                    method: 'bank',
                    description: `Оплата поставщику (UZS Bank): ${supplierName} (Закупка #${purchase.id})`
                });
            }
        } else if (paymentMethod !== 'debt') {
            newTransactions.push({
                ...baseTrx,
                id: `TRX-${Date.now()}`,
                amount: totals.totalInvoiceValue,
                currency: 'USD',
                method: paymentMethod as 'cash' | 'bank',
                description: `Оплата поставщику: ${supplierName} (Закупка #${purchase.id})`
            });
        }

        if (newTransactions.length > 0) {
            setTransactions([...transactions, ...newTransactions]);
        }

        // 3. Update Product Stock & Cost
        const nextProducts = [...products];
        const existingById = new Map<string, Product>(products.map(p => [p.id, p]));

        totals.itemsWithLandedCost.forEach(item => {
            const existing = existingById.get(item.productId);
            if (existing) {
                const newQuantity = existing.quantity + item.quantity;
                const oldValue = existing.quantity * (existing.costPrice || 0);
                const newValue = item.quantity * item.landedCost;
                const newCost = newQuantity > 0 ? (oldValue + newValue) / newQuantity : item.landedCost;

                const index = nextProducts.findIndex(p => p.id === existing.id);
                if (index >= 0) {
                    nextProducts[index] = { ...existing, quantity: newQuantity, costPrice: newCost };
                }
            } else {
                nextProducts.push({
                    id: item.productId,
                    name: item.productName,
                    type: ProductType.OTHER,
                    dimensions: '-',
                    steelGrade: 'Ст3',
                    quantity: item.quantity,
                    unit: item.unit,
                    pricePerUnit: 0,
                    costPrice: item.landedCost,
                    minStockLevel: 0,
                    origin: 'import'
                });
            }
        });

        setProducts(nextProducts);

        // Reset
        setCart([]);
        setSupplierName('');
        setOverheads({ logistics: 0, customsDuty: 0, importVat: 0, other: 0 });
        setPaymentMethod('cash');
        toast.success('Закупка успешно проведена!');
    };

    const handleComplete = () => {
        if (!supplierName || cart.length === 0) {
            toast.warning('Заполните данные поставщика и добавьте товары');
            return;
        }

        if (paymentMethod === 'mixed') {
            setIsSplitModalOpen(true);
        } else {
            finalizePurchase();
        }
    };

    const handleOpenRepayModal = (purchase: Purchase) => {
        setSelectedPurchaseForRepayment(purchase);
        setRepaymentAmount(purchase.totalInvoiceAmount - purchase.amountPaid);
        setIsRepayModalOpen(true);
    };

    const handleRepayDebt = () => {
        if (!selectedPurchaseForRepayment || repaymentAmount <= 0) return;

        // 1. Create Transaction
        const newTransaction: Transaction = {
            id: `TRX - ${Date.now()} `,
            date: new Date().toISOString(),
            type: 'supplier_payment',
            amount: repaymentAmount,
            currency: 'USD',
            method: 'cash', // Default
            description: `Погашение долга поставщику: ${selectedPurchaseForRepayment.supplierName} (Закупка #${selectedPurchaseForRepayment.id})`,
            relatedId: selectedPurchaseForRepayment.id
        };
        setTransactions([...transactions, newTransaction]);

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

    const toggleExpand = (purchaseId: string) => {
        const next = new Set(expandedPurchases);
        if (next.has(purchaseId)) next.delete(purchaseId);
        else next.add(purchaseId);
        setExpandedPurchases(next);
    };

    const getPurchaseTransactions = (purchaseId: string) => {
        return transactions.filter(t => t.relatedId === purchaseId);
    };

    // Filter unpaid purchases
    const unpaidPurchases = purchases.filter(p => p.paymentStatus !== 'paid');

    // Quick Product Create State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState<Partial<Product>>({
        name: '', type: 'Прочее' as ProductType, unit: 'шт' as Unit, dimensions: '-', steelGrade: '-', origin: 'import'
    });

    const handleCreateProduct = () => {
        if (!newProduct.name) {
            toast.warning('Введите название товара');
            return;
        }

        const product: Product = {
            id: `PROD - ${Date.now()} `,
            name: newProduct.name!,
            type: newProduct.type || 'Прочее' as ProductType,
            dimensions: newProduct.dimensions || '-',
            steelGrade: newProduct.steelGrade || '-',
            quantity: 0,
            unit: newProduct.unit || 'шт' as Unit,
            pricePerUnit: 0,
            costPrice: 0,
            minStockLevel: 10,
            origin: newProduct.origin || 'import'
        };

        setProducts([...products, product]);
        setSelectedProductId(product.id);
        setIsProductModalOpen(false);
        setNewProduct({ name: '', type: 'Прочее' as ProductType, unit: 'шт' as Unit, dimensions: '-', steelGrade: '-', origin: 'import' });
        toast.success(`Товар "${product.name}" создан!`);
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Импорт и Закупка</h2>
                    <p className="text-slate-400 mt-1">Оформление прихода и расчеты с поставщиками</p>
                </div>
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`px - 4 py - 2 rounded - md text - sm font - medium transition - all ${activeTab === 'new' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'} `}
                    >
                        Новая закупка
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px - 4 py - 2 rounded - md text - sm font - medium transition - all ${activeTab === 'history' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'} `}
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
                                <FileText size={18} className="text-primary-500" /> Основное
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
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`px - 2 py - 2 rounded - lg text - xs font - bold border transition - all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'} `}
                                    >
                                        Наличные
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('bank')}
                                        className={`px - 2 py - 2 rounded - lg text - xs font - bold border transition - all ${paymentMethod === 'bank' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-600 text-slate-400'} `}
                                    >
                                        Перечисление
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('debt')}
                                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        В долг
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('mixed')}
                                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all col-span-3 ${paymentMethod === 'mixed' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        Смешанная оплата (Частично)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Add Item Form with Quick Create */}
                        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Plus size={18} className="text-emerald-500" /> Добавить товар
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Товар</label>
                                <div className="space-y-2">
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={selectedProductId}
                                        onChange={e => {
                                            setSelectedProductId(e.target.value);
                                            if (e.target.value) {
                                                setInputProductName('');
                                            }
                                        }}
                                    >
                                        <option value="">-- Выберите товар из списка --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.dimensions}) {p.origin === 'import' ? '[Imp]' : '[Loc]'}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="text-xs text-slate-500 text-center">или</div>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Введите название нового товара (создастся автоматически)"
                                        value={inputProductName}
                                        onChange={e => {
                                            setInputProductName(e.target.value);
                                            if (e.target.value) {
                                                setSelectedProductId('');
                                            }
                                        }}
                                    />
                                    {inputProductName && (
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={inputUnit}
                                                onChange={e => setInputUnit(e.target.value as Unit)}
                                            >
                                                <option value={Unit.METER}>м (метр)</option>
                                                <option value={Unit.TON}>т (тонна)</option>
                                                <option value={Unit.PIECE}>шт (штука)</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsProductModalOpen(true)}
                                    className="w-full bg-slate-700 hover:bg-emerald-600 text-white py-2 rounded-lg transition-colors border border-slate-600 text-sm flex items-center justify-center gap-2"
                                    title="Создать новый товар с полными параметрами"
                                >
                                    <Plus size={16} /> Создать товар с параметрами
                                </button>
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
                                    <label className="text-xs font-medium text-slate-400">Цена Invoice (USD)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="0.00"
                                        value={inputInvoicePrice || ''}
                                        onChange={e => setInputInvoicePrice(Number(e.target.value))}
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

                        {/* Overheads Form */}
                        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg relative overflow-hidden">
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
                                        <th className="px-4 py-3 text-right">Цена (Inv.)</th>
                                        <th className="px-4 py-3 text-right bg-amber-500/5 text-amber-200">Себест. (Landed)</th>
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
                                            <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 bg-amber-500/5">${item.landedCost.toFixed(2)}</td>
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
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                Список пуст. Добавьте товары слева.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Summary */}
                        <div className="bg-slate-900 p-6 border-t border-slate-700">
                            <div className="grid grid-cols-4 gap-8 mb-6">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Сумма по Инвойсу</p>
                                    <p className="text-xl font-mono font-bold text-slate-300">${totals.totalInvoiceValue.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Накладные (Логистика+)</p>
                                    <p className="text-xl font-mono font-bold text-amber-400">+${totals.totalOverheads.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Налоги (Пошлина+НДС)</p>
                                    <p className="text-xl font-mono font-bold text-blue-400">+${totals.totalTaxes.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Итого Себестоимость</p>
                                    <p className="text-2xl font-mono font-bold text-white border-b-2 border-primary-500 inline-block">
                                        ${totals.totalLandedValue.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">(Без учета налогов)</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                                <p className="text-xs text-amber-200/80">
                                    При проведении документа остатки товаров увеличатся, а их учетная цена (Cost Price) будет пересчитана по методу <strong>средневзвешенной</strong> стоимости с учетом всех расходов.
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
                                    <th className="px-6 py-4 text-center">Метод</th>
                                    <th className="px-6 py-4 text-center">Статус</th>
                                    <th className="px-6 py-4 text-right">Оплачено</th>
                                    <th className="px-6 py-4 text-right">Долг</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {purchases.slice().reverse().map(purchase => {
                                    const debt = purchase.totalInvoiceAmount - purchase.amountPaid;
                                    const isMixed = purchase.paymentMethod === 'mixed';
                                    const isExpanded = expandedPurchases.has(purchase.id);
                                    const purchaseTrx = isMixed && isExpanded ? getPurchaseTransactions(purchase.id) : [];

                                    return (
                                        <React.Fragment key={purchase.id}>
                                            <tr className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 text-slate-300">{new Date(purchase.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 font-medium text-white">{purchase.supplierName}</td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-300">${purchase.totalInvoiceAmount.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        disabled={!isMixed}
                                                        onClick={() => isMixed && toggleExpand(purchase.id)}
                                                        className={`flex items-center gap-1 mx-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${purchase.paymentMethod === 'cash' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            purchase.paymentMethod === 'bank' ? 'bg-blue-500/20 text-blue-400' :
                                                                purchase.paymentMethod === 'mixed' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 cursor-pointer' :
                                                                    'bg-red-500/20 text-red-400'
                                                            }`}
                                                    >
                                                        {purchase.paymentMethod === 'cash' ? 'Наличные' :
                                                            purchase.paymentMethod === 'bank' ? 'Банк' :
                                                                purchase.paymentMethod === 'mixed' ? 'МИКС' : 'Долг'}
                                                        {isMixed && (isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${purchase.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
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
                                            {/* Details row */}
                                            {isExpanded && isMixed && (
                                                <tr className="bg-slate-800/50">
                                                    <td colSpan={8} className="px-6 py-3">
                                                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 ml-10">
                                                            <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Детализация оплаты (МИКС)</div>
                                                            {purchaseTrx.length === 0 ? (
                                                                <div className="text-xs text-red-400">Транзакции не найдены</div>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-4">
                                                                    {purchaseTrx.map(t => (
                                                                        <div key={t.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                                                                            <div className="text-[10px] text-slate-500 uppercase">{t.method === 'cash' ? 'Наличные' : t.method === 'card' ? 'Карта' : 'Банк'}</div>
                                                                            <div className={`text-sm font-mono font-bold ${t.method === 'cash' && t.currency === 'USD' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                                                {t.currency === 'UZS' ? `${t.amount.toLocaleString()} UZS` : `$${t.amount.toFixed(2)}`}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
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

            {/* Quick Product Create Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus className="text-emerald-500" /> Создать новый товар
                            </h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Название товара *</label>
                                <input
                                    type="text"
                                    placeholder="Например: Труба 80x80x3"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newProduct.name || ''}
                                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Тип</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={newProduct.type || 'Прочее'}
                                        onChange={e => setNewProduct({ ...newProduct, type: e.target.value as ProductType })}
                                    >
                                        <option value="Труба">Труба</option>
                                        <option value="Профиль">Профиль</option>
                                        <option value="Лист">Лист</option>
                                        <option value="Балка">Балка</option>
                                        <option value="Прочее">Прочее</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Ед. измерения</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={newProduct.unit || 'шт'}
                                        onChange={e => setNewProduct({ ...newProduct, unit: e.target.value as Unit })}
                                    >
                                        <option value="м">метр</option>
                                        <option value="т">тонна</option>
                                        <option value="шт">шт</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Размеры</label>
                                    <input
                                        type="text"
                                        placeholder="50x50"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={newProduct.dimensions || ''}
                                        onChange={e => setNewProduct({ ...newProduct, dimensions: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Марка стали</label>
                                    <input
                                        type="text"
                                        placeholder="St3sp"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={newProduct.steelGrade || ''}
                                        onChange={e => setNewProduct({ ...newProduct, steelGrade: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Происхождение</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={newProduct.origin || 'import'}
                                        onChange={e => setNewProduct({ ...newProduct, origin: e.target.value as 'import' | 'local' })}
                                    >
                                        <option value="import">Импорт</option>
                                        <option value="local">Местный</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleCreateProduct}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all"
                            >
                                Создать Товар
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Mixed Payment Modal */}
            <PaymentSplitModal
                isOpen={isSplitModalOpen}
                onClose={() => setIsSplitModalOpen(false)}
                totalAmountUSD={totals.totalInvoiceValue}
                totalAmountUZS={totals.totalInvoiceValue * settings.exchangeRate}
                exchangeRate={settings.exchangeRate}
                onConfirm={finalizePurchase}
            />
        </div>
    );
};
