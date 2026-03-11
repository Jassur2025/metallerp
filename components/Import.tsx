import React, { useState, useMemo, useEffect } from 'react';
import {
    Purchase, Product, Transaction, ProductType, Unit,
    PurchaseItem, PurchaseOverheads, AppSettings, Supplier
} from '../types';
import { DEFAULT_EXCHANGE_RATE } from '../constants';
import { IdGenerator } from '../utils/idGenerator';
import { Plus, Minus, Trash2, Save, Calculator, Container, DollarSign, AlertTriangle, Truck, Scale, FileText, Users, Search, Package, X, Check, ShoppingCart } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
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
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const isDark = theme !== 'light';
    
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

    // Product grid state
    const [productSearch, setProductSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const IMPORT_CATEGORIES = useMemo(() => {
        const types = new Set(products.map(p => p.type));
        const all = [{ key: 'all', label: 'Все' }];
        if (types.has(ProductType.PIPE)) all.push({ key: ProductType.PIPE, label: 'Трубы' });
        if (types.has(ProductType.PROFILE)) all.push({ key: ProductType.PROFILE, label: 'Профили' });
        if (types.has(ProductType.SHEET)) all.push({ key: ProductType.SHEET, label: 'Листы' });
        if (types.has(ProductType.BEAM)) all.push({ key: ProductType.BEAM, label: 'Балки' });
        if (types.has(ProductType.OTHER)) all.push({ key: ProductType.OTHER, label: 'Прочее' });
        return all;
    }, [products]);

    const filteredGridProducts = useMemo(() => {
        return products
            .filter(p => {
                const q = productSearch.toLowerCase();
                const matchSearch = !q || p.name.toLowerCase().includes(q) || p.dimensions?.toLowerCase().includes(q);
                const matchCat = activeCategory === 'all' || p.type === activeCategory;
                return matchSearch && matchCat;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, productSearch, activeCategory]);

    const cartProductIds = useMemo(() => new Set(cart.map(c => c.productId)), [cart]);

    // Total weight calculation
    const totalWeightKg = useMemo(() => {
        return cart.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return sum;
            if (product.unit === 'т') return sum + item.quantity * 1000;
            if (product.weightPerMeter) return sum + item.quantity * product.weightPerMeter;
            return sum;
        }, 0);
    }, [cart, products]);

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

    // Quick-add from product grid
    const quickAddImportProduct = (product: Product) => {
        if (cart.some(i => i.productId === product.id)) {
            toast.warning('Этот товар уже в списке');
            return;
        }
        const vatRate = settings.vatRate || 12;
        const price = product.costPrice || product.pricePerUnit || 0;
        const newItem: PurchaseItem = {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unit: product.unit,
            invoicePrice: price,
            invoicePriceWithoutVat: price / (1 + vatRate / 100),
            vatAmount: price - (price / (1 + vatRate / 100)),
            landedCost: price,
            totalLineCost: price,
            totalLineCostUZS: price
        };
        setCart(prev => [...prev, newItem]);
    };

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
        <div className={`p-6 space-y-5 animate-fade-in h-[calc(100vh-2rem)] flex flex-col`}>
            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`text-2xl font-bold ${t.text} tracking-tight`}>Импорт и Закупка</h2>
                    <p className={`${t.textMuted} text-sm mt-1`}>Оформление прихода и расчеты с поставщиками</p>
                </div>
                <div className={`flex ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} p-1 rounded-xl border`}>
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'new'
                            ? (isDark ? 'bg-primary-600 text-white shadow-lg' : 'bg-blue-500 text-white shadow-md')
                            : `${t.textMuted} hover:${isDark ? 'text-white' : 'text-slate-700'}`}`}
                    >
                        Новая закупка
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'history'
                            ? (isDark ? 'bg-primary-600 text-white shadow-lg' : 'bg-blue-500 text-white shadow-md')
                            : `${t.textMuted} hover:${isDark ? 'text-white' : 'text-slate-700'}`}`}
                    >
                        История и Долги
                    </button>
                </div>
            </div>

            {activeTab === 'new' ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 overflow-hidden">
                    {/* Left: Settings + Product Grid */}
                    <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-1 custom-scrollbar pb-20">
                        {/* Document Info */}
                        <div className={`${isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/60' : 'bg-white'} p-5 rounded-2xl border ${t.border} space-y-4 shadow-sm`}>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                    <FileText size={16} className="text-blue-500" />
                                </div>
                                <h3 className={`${t.text} font-bold text-sm`}>Основное (Импорт)</h3>
                            </div>
                            <div className="space-y-1.5">
                                <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider flex items-center gap-1.5`}>
                                    <Users size={12} /> Поставщик
                                    {suppliersLoading && <span className="text-primary-400 text-[10px]">(загрузка...)</span>}
                                </label>
                                <div className="relative">
                                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
                                    <input
                                        type="text"
                                        list="suppliers-list"
                                        className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'} border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all`}
                                        placeholder="Поиск поставщика..."
                                        value={supplierName}
                                        onChange={e => {
                                            setSupplierName(e.target.value);
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
                            </div>
                            <div className="space-y-1.5">
                                <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Дата прихода</label>
                                <input
                                    type="date"
                                    className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all`}
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Оплата</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { key: 'cash' as const, label: 'Наличные', active: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm' },
                                        { key: 'bank' as const, label: 'Перечисление', active: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm' },
                                        { key: 'debt' as const, label: 'В долг', active: 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm' },
                                    ] as const).map(pm => (
                                        <button
                                            key={pm.key}
                                            onClick={() => setPaymentMethod(pm.key)}
                                            className={`px-2 py-2 rounded-xl text-xs font-bold border transition-all ${paymentMethod === pm.key
                                                ? pm.active
                                                : `${isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}`}
                                        >
                                            {pm.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setPaymentMethod('mixed')}
                                    className={`w-full px-2 py-2 rounded-xl text-xs font-bold border transition-all ${paymentMethod === 'mixed'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                                        : `${isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}`}
                                >
                                    Смешанная оплата
                                </button>
                            </div>
                        </div>

                        {/* Product Selection Grid */}
                        <div className={`${isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/60' : 'bg-white'} p-4 rounded-2xl border ${t.border} shadow-sm flex flex-col`} style={{ maxHeight: '55vh' }}>
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                        <ShoppingCart size={14} className="text-emerald-500" />
                                    </div>
                                    <h3 className={`${t.text} font-bold text-sm`}>Товары</h3>
                                    <span className={`text-xs ${t.textMuted}`}>({filteredGridProducts.length})</span>
                                </div>
                                <button
                                    onClick={() => setIsProductModalOpen(true)}
                                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-[11px] font-bold transition-all shadow-sm"
                                >
                                    + Новый
                                </button>
                            </div>

                            <div className="relative mb-2 flex-shrink-0">
                                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
                                <input
                                    type="text"
                                    placeholder="Поиск товара..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'} border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 ${isDark ? 'focus:ring-blue-500/30' : 'focus:ring-blue-500/30'} transition-all`}
                                />
                                {productSearch && (
                                    <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <X size={14} className={`${t.textMuted} hover:text-red-400`} />
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-1 mb-2 flex-shrink-0 flex-wrap">
                                {IMPORT_CATEGORIES.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveCategory(tab.key)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                                            activeCategory === tab.key
                                                ? (isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-blue-500 text-white border-blue-500')
                                                : (isDark ? `bg-slate-800/40 ${t.textMuted} border-transparent hover:border-slate-600` : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200')}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {filteredGridProducts.length === 0 ? (
                                    <div className={`flex flex-col items-center justify-center py-8 ${t.textMuted}`}>
                                        <Package size={32} className="opacity-20 mb-2" />
                                        <p className="text-xs">Товары не найдены</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {filteredGridProducts.slice(0, 80).map(p => {
                                            const inCart = cartProductIds.has(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => !inCart && quickAddImportProduct(p)}
                                                    disabled={inCart}
                                                    className={`text-left p-2.5 rounded-xl border transition-all duration-150 group relative overflow-hidden
                                                        ${inCart
                                                            ? (isDark ? 'bg-blue-500/10 border-blue-500/30 opacity-60' : 'bg-blue-50 border-blue-300 opacity-60')
                                                            : (isDark
                                                                ? 'bg-slate-800/50 border-slate-700/60 hover:border-blue-500/60 hover:bg-slate-800/90 active:bg-slate-700'
                                                                : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm')
                                                        } ${inCart ? 'cursor-default' : 'active:scale-[0.97] cursor-pointer'}`}
                                                >
                                                    <div className={`font-bold text-[12px] leading-snug ${t.text} truncate mb-0.5`}>{p.name}</div>
                                                    <div className="flex items-center gap-1 mb-1.5">
                                                        <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-300 bg-slate-700/60' : 'text-slate-700 bg-slate-100'} px-1.5 py-0.5 rounded`}>
                                                            {p.dimensions}
                                                        </span>
                                                        {p.origin === 'import' && (
                                                            <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>IMP</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                            ${p.pricePerUnit.toFixed(2)}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            {p.weightPerMeter ? (
                                                                <span className={`text-[9px] font-mono ${isDark ? 'text-blue-400/80' : 'text-blue-600/80'}`}>{p.weightPerMeter}кг/м</span>
                                                            ) : null}
                                                            <span className={`text-[10px] ${t.textMuted}`}>{p.quantity} {p.unit}</span>
                                                        </div>
                                                    </div>
                                                    {inCart && (
                                                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-500/30' : 'bg-blue-100'}`}>
                                                            <Check size={10} className={`${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                                        </div>
                                                    )}
                                                    {!inCart && (
                                                        <div className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100
                                                            ${isDark ? 'ring-1 ring-blue-500/30' : 'ring-1 ring-blue-400/40'}`} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Overheads Form */}
                        <div className={`${isDark ? 'bg-gradient-to-br from-slate-800/90 to-amber-900/10' : 'bg-gradient-to-br from-white to-amber-50'} p-5 rounded-2xl border ${t.border} space-y-4 shadow-sm relative overflow-hidden`}>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="p-2 rounded-lg bg-amber-500/10">
                                    <Truck size={16} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className={`${t.text} font-bold text-sm`}>Накладные расходы (USD)</h3>
                                    <p className={`text-[11px] ${t.textMuted} mt-0.5`}>Распределяются пропорционально сумме</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Логистика', key: 'logistics' as const, icon: '🚚' },
                                    { label: 'Тамож. пошлина', key: 'customsDuty' as const, icon: '📋' },
                                    { label: 'Тамож. НДС', key: 'importVat' as const, icon: '🏛️' },
                                    { label: 'Прочее', key: 'other' as const, icon: '📦' },
                                ].map(({ label, key, icon }) => (
                                    <div key={key} className="space-y-1">
                                        <label className={`text-xs ${t.textMuted} flex items-center gap-1`}>{icon} {label}</label>
                                        <input
                                            type="number"
                                            className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500/30 transition-all`}
                                            value={overheads[key] || ''}
                                            onChange={e => setOverheads({ ...overheads, [key]: Number(e.target.value) })}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border`}>
                                <span className={`text-xs font-medium ${t.textMuted}`}>Итого накладные:</span>
                                <span className="text-sm font-mono font-bold text-amber-500">
                                    ${(overheads.logistics + overheads.customsDuty + overheads.importVat + overheads.other).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Items Table & Summary */}
                    <div className={`lg:col-span-2 flex flex-col h-full ${isDark ? 'bg-slate-800/80' : 'bg-white'} border ${t.border} rounded-2xl shadow-lg overflow-hidden min-w-0`}>
                        <div className={`px-4 py-3 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b flex justify-between items-center`}>
                            <div className="flex items-center gap-2">
                                <Scale className="text-blue-500" size={15} />
                                <h3 className={`text-sm font-bold ${t.text}`}>Корзина</h3>
                            </div>
                            <div className={`${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} px-2.5 py-1 rounded-full border`}>
                                <span className={`font-mono font-bold text-xs ${t.text}`}>{cart.length}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className={`${isDark ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-500'} text-[10px] uppercase font-medium sticky top-0`}>
                                    <tr>
                                        <th className="px-3 py-2.5">Товар</th>
                                        <th className="px-2 py-2.5 text-right">Кол.</th>
                                        <th className={`px-2 py-2.5 text-right ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Вес</th>
                                        <th className="px-2 py-2.5 text-right">Inv.</th>
                                        <th className={`px-2 py-2.5 text-right ${isDark ? 'bg-amber-500/5 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>Себ.</th>
                                        <th className="px-2 py-2.5 text-right">Сумма</th>
                                        <th className="px-1 py-2.5 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
                                    {totals.itemsWithLandedCost.map((item) => (
                                        <tr key={item.productId} className={`${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors group`}>
                                            <td className={`px-3 py-2 font-medium ${t.text} text-xs`}>{item.productName}</td>
                                            <td className="px-2 py-2 text-right">
                                                <div className="flex items-center justify-end gap-0.5">
                                                    <button
                                                        onClick={() => {
                                                            const newQty = Math.max(1, item.quantity - 1);
                                                            setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: newQty } : c));
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center rounded-md ${isDark ? 'bg-slate-700/60 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} transition-colors`}
                                                    >
                                                        <Minus size={10} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className={`w-10 ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'} text-center font-mono outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const newQty = Number(e.target.value);
                                                            setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: newQty } : c));
                                                        }}
                                                        min={1}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c));
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center rounded-md ${isDark ? 'bg-slate-700/60 hover:bg-emerald-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-emerald-500 text-slate-600 hover:text-white'} transition-colors`}
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-right">
                                                {(() => {
                                                    const prod = products.find(p => p.id === item.productId);
                                                    if (!prod) return <span className={`text-[10px] ${t.textMuted}`}>—</span>;
                                                    if (prod.unit === 'т') return <span className={`text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{(item.quantity * 1000).toFixed(0)} кг</span>;
                                                    if (!prod.weightPerMeter) return <span className={`text-[10px] ${t.textMuted}`}>—</span>;
                                                    const wKg = item.quantity * prod.weightPerMeter;
                                                    return <span className={`text-xs font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{wKg >= 1000 ? `${(wKg / 1000).toFixed(2)} т` : `${wKg.toFixed(0)} кг`}</span>;
                                                })()}
                                            </td>
                                            <td className={`px-2 py-2 text-right font-mono text-xs ${t.textMuted}`}>${item.invoicePrice.toFixed(2)}</td>
                                            <td className={`px-2 py-2 text-right font-mono text-xs font-bold text-amber-500 ${isDark ? 'bg-amber-500/5' : 'bg-amber-50/50'}`}>${item.landedCost.toFixed(2)}</td>
                                            <td className={`px-2 py-2 text-right font-mono text-xs ${t.text}`}>${item.totalLineCost.toFixed(2)}</td>
                                            <td className="px-1 py-2 text-center">
                                                <button onClick={() => removeItem(item.productId)} className={`opacity-0 group-hover:opacity-100 ${t.textMuted} hover:text-red-500 transition-all`}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {cart.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className={`px-6 py-16 text-center ${t.textMuted}`}>
                                                <div className="flex flex-col items-center gap-2">
                                                    <Package size={36} className="opacity-20" />
                                                    <p className="text-sm">Нажмите на товар слева чтобы добавить</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Summary */}
                        <div className={`${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-50 border-slate-200'} p-4 border-t`}>
                            {/* Total Weight */}
                            {totalWeightKg > 0 && (
                                <div className={`flex items-center gap-2 mb-3 p-2 rounded-xl ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} border`}>
                                    <Scale size={14} className="text-blue-500" />
                                    <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Общий вес:</span>
                                    <span className={`text-sm font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                        {totalWeightKg >= 1000 ? `${(totalWeightKg / 1000).toFixed(3)} т` : `${totalWeightKg.toFixed(1)} кг`}
                                    </span>
                                    {totalWeightKg >= 1000 && (
                                        <span className={`text-[10px] ${t.textMuted}`}>({totalWeightKg.toFixed(0)} кг)</span>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-2.5 mb-3">
                                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'} border`}>
                                    <p className={`text-[10px] ${t.textMuted} uppercase font-semibold`}>Инвойс</p>
                                    <p className={`text-sm font-mono font-bold ${t.text}`}>${totals.totalInvoiceValue.toFixed(2)}</p>
                                </div>
                                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border`}>
                                    <p className={`text-[10px] text-amber-500 uppercase font-semibold`}>Накладные</p>
                                    <p className="text-sm font-mono font-bold text-amber-500">+${totals.totalOverheads.toFixed(2)}</p>
                                </div>
                                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'} border`}>
                                    <p className={`text-[10px] text-blue-500 uppercase font-semibold`}>Налоги</p>
                                    <p className="text-sm font-mono font-bold text-blue-500">+${totals.totalTaxes.toFixed(2)}</p>
                                </div>
                                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} border`}>
                                    <p className={`text-[10px] text-emerald-500 uppercase font-semibold`}>Себестоимость</p>
                                    <p className="text-lg font-mono font-bold text-emerald-500">${totals.totalLandedValue.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 p-2.5 ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border rounded-xl mb-3`}>
                                <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                                <p className={`text-[10px] ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>
                                    Cost Price — <strong>средневзвешенная</strong>.
                                </p>
                            </div>

                            <button
                                onClick={handleComplete}
                                disabled={cart.length === 0 || !supplierName}
                                className={`w-full ${isDark ? 'bg-primary-600 hover:bg-primary-500 disabled:bg-slate-800 disabled:text-slate-600' : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400'} disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${isDark ? 'shadow-primary-600/20' : 'shadow-blue-500/20'}`}
                            >
                                <Save size={16} /> Провести
                                {cart.length > 0 && <span className="text-xs font-normal opacity-80">({cart.length})</span>}
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
