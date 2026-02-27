import React, { useState, useMemo, useEffect } from 'react';
import {
    Purchase, Product, Transaction, ProductType, Unit,
    PurchaseItem, PurchaseOverheads, AppSettings, Supplier
} from '../types';
import { DEFAULT_EXCHANGE_RATE } from '../constants';
import { IdGenerator } from '../utils/idGenerator';
import { Plus, Trash2, Save, Calculator, Container, DollarSign, AlertTriangle, Truck, Scale, FileText, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { PaymentSplitModal, PaymentDistribution } from './Sales/PaymentSplitModal';
import { useSuppliers } from '../hooks/useSuppliers';
import { usePurchases } from '../hooks/usePurchases';
import { logger } from '../utils/logger';
import { PurchaseHistoryTab } from './Import/PurchaseHistoryTab';
import { ImportRepaymentModal } from './Import/ImportRepaymentModal';
import { ProductCreateModal } from './Import/ProductCreateModal';

interface ImportProps {
    products: Product[];
    setProducts: (products: Product[]) => void;
    settings: AppSettings;
    purchases: Purchase[];
    onSavePurchases: (purchases: Purchase[]) => void;
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
}

export const Import: React.FC<ImportProps> = ({ products, setProducts, settings, transactions, setTransactions }) => {
    const toast = useToast();
    
    // Firebase hook for purchases
    const {
        purchases,
        loading: purchasesLoading,
        addPurchase,
        updatePurchase
    } = usePurchases({ realtime: true });
    
    // Firebase hook for suppliers
    const { 
        suppliers, 
        loading: suppliersLoading, 
        addSupplier, 
        updateSupplier,
        getOrCreateSupplier
    } = useSuppliers({ realtime: true });
    
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [supplierName, setSupplierName] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
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
                    id: IdGenerator.product(),
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

        const vatRate = settings.vatRate || 12;

        const newItem: PurchaseItem = {
            productId: productId,
            productName: product.name,
            quantity: inputQty,
            unit: product.unit,
            invoicePrice: inputInvoicePrice,
            invoicePriceWithoutVat: inputInvoicePrice / (1 + vatRate / 100),
            vatAmount: inputInvoicePrice - (inputInvoicePrice / (1 + vatRate / 100)),
            landedCost: inputInvoicePrice, // Placeholder, updated dynamically
            totalLineCost: inputQty * inputInvoicePrice,
            totalLineCostUZS: inputQty * inputInvoicePrice
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


    const finalizePurchase = async (distribution?: PaymentDistribution) => {
        if (!supplierName || cart.length === 0) return;

        const totalToPayUSD = totals.totalInvoiceValue;
        const paidUSD = distribution ? totalToPayUSD - distribution.remainingUSD : (paymentMethod === 'debt' ? 0 : totalToPayUSD);
        const status = distribution ? (distribution.isPaid ? 'paid' : (paidUSD > 0 ? 'partial' : 'unpaid')) : (paymentMethod === 'debt' ? 'unpaid' : 'paid');
        const remainingDebt = totalToPayUSD - paidUSD;

        // Get or create supplier in Firebase
        let supplierId = selectedSupplierId;
        try {
            logger.debug('Import', 'Creating supplier:', supplierName);
            const supplier = await getOrCreateSupplier(supplierName);
            supplierId = supplier.id;
            logger.debug('Import', 'Supplier created/found:', supplier);
            
            // Update supplier stats
            await updateSupplier(supplier.id, {
                totalPurchases: (supplier.totalPurchases || 0) + totalToPayUSD,
                totalDebt: (supplier.totalDebt || 0) + remainingDebt
            });
            toast.success(`Поставщик "${supplierName}" сохранён в Firebase`);
        } catch (err) {
            logger.error('Import', 'Error updating supplier:', err);
            toast.error(`Ошибка сохранения поставщика: ${err}`);
        }

        const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;

        const purchase: Purchase = {
            id: IdGenerator.purchase(),
            date: new Date(date).toISOString(),
            supplierName,
            status: 'completed',
            items: totals.itemsWithLandedCost,
            overheads,
            totalInvoiceAmountUZS: totals.totalInvoiceValue * rate,
            totalVatAmountUZS: (totals.totalInvoiceValue * rate) - ((totals.totalInvoiceValue * rate) / (1 + (settings.vatRate || 12) / 100)),
            totalWithoutVatUZS: (totals.totalInvoiceValue * rate) / (1 + (settings.vatRate || 12) / 100),
            totalInvoiceAmount: totals.totalInvoiceValue,
            totalLandedAmount: totals.totalLandedValue,
            exchangeRate: rate,
            paymentMethod: distribution ? 'mixed' : paymentMethod,
            paymentStatus: status as 'paid' | 'unpaid' | 'partial',
            amountPaid: paidUSD * rate,
            amountPaidUSD: paidUSD
        };

        // 1. Save Purchase to Firebase
        try {
            await addPurchase(purchase);
            logger.debug('Import', 'Purchase saved to Firebase:', purchase.id);
        } catch (err) {
            logger.error('Import', 'Error saving purchase to Firebase:', err);
            toast.error('Ошибка сохранения закупки');
            return;
        }

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
                    id: IdGenerator.transaction(),
                    amount: distribution.cashUSD,
                    currency: 'USD',
                    method: 'cash',
                    description: `Оплата поставщику (USD Cash): ${supplierName} (Закупка #${purchase.id})`
                });
            }
            if (distribution.cashUZS > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: IdGenerator.transaction(),
                    amount: distribution.cashUZS,
                    currency: 'UZS',
                    method: 'cash',
                    description: `Оплата поставщику (UZS Cash): ${supplierName} (Закупка #${purchase.id})`
                });
            }
            if (distribution.cardUZS > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: IdGenerator.transaction(),
                    amount: distribution.cardUZS,
                    currency: 'UZS',
                    method: 'card',
                    description: `Оплата поставщику (UZS Card): ${supplierName} (Закупка #${purchase.id})`
                });
            }
            if (distribution.bankUZS > 0) {
                newTransactions.push({
                    ...baseTrx,
                    id: IdGenerator.transaction(),
                    amount: distribution.bankUZS,
                    currency: 'UZS',
                    method: 'bank',
                    description: `Оплата поставщику (UZS Bank): ${supplierName} (Закупка #${purchase.id})`
                });
            }
        } else if (paymentMethod !== 'debt') {
            newTransactions.push({
                ...baseTrx,
                id: IdGenerator.transaction(),
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
        setSelectedSupplierId('');
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
        setIsRepayModalOpen(true);
    };

    const handleRepayDebt = async (repaymentAmount: number) => {
        if (!selectedPurchaseForRepayment || repaymentAmount <= 0) return;

        // 1. Create Transaction
        const newTransaction: Transaction = {
            id: IdGenerator.transaction(),
            date: new Date().toISOString(),
            type: 'supplier_payment',
            amount: repaymentAmount,
            currency: 'USD',
            method: 'cash',
            description: `Погашение долга поставщику: ${selectedPurchaseForRepayment.supplierName} (Закупка #${selectedPurchaseForRepayment.id})`,
            relatedId: selectedPurchaseForRepayment.id
        };
        setTransactions([...transactions, newTransaction]);
        
        // 2. Update Purchase in Firebase
        const newAmountPaid = selectedPurchaseForRepayment.amountPaid + repaymentAmount;
        const newStatus = newAmountPaid >= selectedPurchaseForRepayment.totalInvoiceAmount ? 'paid' : 'partial';
        try {
            await updatePurchase(selectedPurchaseForRepayment.id, {
                amountPaid: newAmountPaid,
                paymentStatus: newStatus
            });
        } catch (err) {
            logger.error('Import', 'Error updating purchase:', err);
        }

        // 3. Update supplier debt in Firebase
        try {
            const supplier = suppliers.find(s => 
                s.name.toLowerCase() === selectedPurchaseForRepayment.supplierName.toLowerCase()
            );
            if (supplier) {
                await updateSupplier(supplier.id, {
                    totalDebt: Math.max(0, (supplier.totalDebt || 0) - repaymentAmount)
                });
            }
        } catch (err) {
            logger.error('Import', 'Error updating supplier debt:', err);
        }

        setIsRepayModalOpen(false);
        toast.success('Оплата поставщику проведена успешно!');
    };

    // Quick Product Create State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);

    const handleCreateProduct = (newProduct: Partial<Product>) => {
        if (!newProduct.name) {
            toast.warning('Введите название товара');
            return;
        }

        const product: Product = {
            id: IdGenerator.product(),
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
                                <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                                    <Users size={14} /> Поставщик
                                    {suppliersLoading && <span className="text-primary-400 text-xs">(загрузка...)</span>}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        list="suppliers-list"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="Выберите или введите поставщика"
                                        value={supplierName}
                                        onChange={e => {
                                            setSupplierName(e.target.value);
                                            // Find matching supplier
                                            const found = suppliers.find(s => 
                                                s.name.toLowerCase() === e.target.value.toLowerCase()
                                            );
                                            setSelectedSupplierId(found?.id || '');
                                        }}
                                    />
                                    <datalist id="suppliers-list">
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.name}>
                                                {s.companyName || s.name}
                                            </option>
                                        ))}
                                    </datalist>
                                </div>
                                {suppliers.length > 0 && (
                                    <p className="text-xs text-slate-500">
                                        {suppliers.length} поставщиков в базе
                                    </p>
                                )}
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
                <PurchaseHistoryTab
                    purchases={purchases}
                    purchasesLoading={purchasesLoading}
                    transactions={transactions}
                    onOpenRepayModal={handleOpenRepayModal}
                />
            )}

            {/* Repayment Modal */}
            {isRepayModalOpen && selectedPurchaseForRepayment && (
                <ImportRepaymentModal
                    purchase={selectedPurchaseForRepayment}
                    onClose={() => setIsRepayModalOpen(false)}
                    onRepay={handleRepayDebt}
                />
            )}

            {/* Quick Product Create Modal */}
            {isProductModalOpen && (
                <ProductCreateModal
                    onClose={() => setIsProductModalOpen(false)}
                    onCreate={handleCreateProduct}
                />
            )}

            {/* Mixed Payment Modal */}
            <PaymentSplitModal
                isOpen={isSplitModalOpen}
                onClose={() => setIsSplitModalOpen(false)}
                totalAmountUSD={totals.totalInvoiceValue}
                totalAmountUZS={totals.totalInvoiceValue * (settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE)}
                exchangeRate={settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE}
                onConfirm={finalizePurchase}
            />
        </div>
    );
};
