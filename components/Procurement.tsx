import React, { useState, useMemo } from 'react';
import { Product, Purchase, PurchaseItem, PurchaseOverheads, Transaction, WorkflowOrder, OrderItem, ProductType, Unit } from '../types';
import { Plus, DollarSign, Wallet, CreditCard, Building2, Banknote } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { PaymentSplitModal, PaymentDistribution } from './Sales/PaymentSplitModal';

import type { ProcurementProps, ProcurementTab, ProcurementType, PaymentMethod, PaymentCurrency, Totals } from './Procurement/types';
import { TopBar } from './Procurement/TopBar';
import { NewPurchaseView } from './Procurement/NewPurchaseView';
import { WorkflowTab } from './Procurement/WorkflowTab';
import { HistoryTab } from './Procurement/HistoryTab';

const isDev = import.meta.env.DEV;
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };

export const Procurement: React.FC<ProcurementProps> = ({ products, setProducts, settings, purchases, onSavePurchases, transactions, setTransactions, workflowOrders, onSaveWorkflowOrders, onSaveProducts, onSaveTransactions }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<ProcurementTab>(() => {
        const saved = localStorage.getItem('procurement_active_tab');
        return (saved === 'workflow' || saved === 'history' || saved === 'new') ? saved : 'new';
    });
    const [procurementType, setProcurementType] = useState<ProcurementType>('local'); // Main switch
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Payment Logic
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('USD'); // Currency for cash/bank payments
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
    const [repaymentMethod, setRepaymentMethod] = useState<PaymentMethod>('cash');
    const [repaymentCurrency, setRepaymentCurrency] = useState<PaymentCurrency>('USD');

    // Expanded purchase rows in history
    const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<Set<string>>(new Set());
    const togglePurchaseExpand = (id: string) => {
        setExpandedPurchaseIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // New Product Modal (allow adding products directly from procurement)
    const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
    const [newProductData, setNewProductData] = useState<Partial<Product>>({
        name: '',
        type: ProductType.PIPE,
        dimensions: '',
        steelGrade: 'Ст3',
        unit: Unit.METER,
        pricePerUnit: 0,
        costPrice: 0,
        minStockLevel: 0,
        origin: 'local'
    });

    React.useEffect(() => {
        localStorage.setItem('procurement_active_tab', activeTab);
    }, [activeTab]);

    const getMissingItems = (items: OrderItem[]) => {
        const missing: { item: OrderItem; available: number; missingQty: number }[] = [];
        items.forEach(it => {
            const p = products.find(pp => pp.id === it.productId);
            const available = p?.quantity ?? 0;
            const need = it.quantity;
            const missingQty = Math.max(0, need - available);
            if (!p || missingQty > 0) {
                missing.push({ item: it, available, missingQty });
            }
        });
        return missing;
    };

    const isFullyInStock = (wf: WorkflowOrder) => getMissingItems(wf.items).length === 0;

    const workflowQueue = useMemo(() => {
        return workflowOrders
            .filter(o => o.status === 'sent_to_procurement')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [workflowOrders]);

    const createDraftPurchaseFromWorkflow = (wf: WorkflowOrder) => {
        const missing = getMissingItems(wf.items);
        if (missing.length === 0) {
            toast.info('Все позиции уже есть в остатках. Можно отправить заявку в кассу.');
            return;
        }
        setProcurementType('local');
        setActiveTab('new');
        setSupplierName(`Workflow: ${wf.customerName} (${wf.id})`);
        setDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('debt');
        setPaymentCurrency('USD');
        setCart(missing.map(m => {
            const p = products.find(pp => pp.id === m.item.productId);
            return {
                productId: m.item.productId,
                productName: m.item.productName,
                quantity: m.missingQty,
                unit: p?.unit || m.item.unit,
                invoicePrice: 0,
                landedCost: 0,
                totalLineCost: 0
            } as PurchaseItem;
        }));
        toast.success('Черновик закупки создан. Укажите цены и проведите закупку.');
    };

    const sendWorkflowToCash = async (wf: WorkflowOrder) => {
        if (!isFullyInStock(wf)) {
            toast.warning('Остатков всё ещё недостаточно по этой заявке.');
            return;
        }
        const next = workflowOrders.map(o => o.id === wf.id ? { ...o, status: 'sent_to_cash' as const } : o);
        await onSaveWorkflowOrders(next);
        toast.success('Заявка отправлена в кассу.');
    };

    const openNewProductModal = () => {
        setNewProductData({
            name: '',
            type: ProductType.PIPE,
            dimensions: '',
            steelGrade: 'Ст3',
            unit: Unit.METER,
            pricePerUnit: 0,
            costPrice: 0,
            minStockLevel: 0,
            origin: procurementType === 'import' ? 'import' : 'local'
        });
        setIsNewProductModalOpen(true);
    };

    const handleCreateNewProduct = async () => {
        if (!newProductData.name || !newProductData.name.trim()) {
            toast.warning('Введите название товара');
            return;
        }
        if (!newProductData.dimensions || !newProductData.dimensions.trim()) {
            toast.warning('Введите размеры (например: 50x50x3)');
            return;
        }

        const product: Product = {
            id: Date.now().toString(),
            name: newProductData.name.trim(),
            type: (newProductData.type as ProductType) || ProductType.OTHER,
            dimensions: newProductData.dimensions.trim(),
            steelGrade: (newProductData.steelGrade || 'Ст3').trim(),
            quantity: 0,
            unit: (newProductData.unit as Unit) || Unit.METER,
            pricePerUnit: Number(newProductData.pricePerUnit) || 0,
            costPrice: Number(newProductData.costPrice) || 0,
            minStockLevel: Number(newProductData.minStockLevel) || 0,
            origin: newProductData.origin || 'local'
        };

        const updated = [...products, product];
        setProducts(updated);
        await onSaveProducts?.(updated);
        setSelectedProductId(product.id);
        setIsNewProductModalOpen(false);
        toast.success('Товар добавлен. Теперь можно добавить его в закупку.');
    };

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
    const totals: Totals = useMemo(() => {
        const totalInvoiceValue = cart.reduce((sum, item) => sum + (item.quantity * item.invoicePrice), 0);

        let totalOverheads = 0;
        let totalLandedValue = totalInvoiceValue;
        let itemsWithLandedCost = cart;

        if (procurementType === 'import') {
            totalOverheads = overheads.logistics + overheads.customsDuty + overheads.other;
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

    const finalizeProcurement = async (distribution?: PaymentDistribution) => {
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
            overheads: procurementType === 'import' ? overheads : { logistics: 0, customsDuty: 0, importVat: 0, other: 0 },
            totalInvoiceAmount: totals.totalInvoiceValue,
            totalLandedAmount: totals.totalLandedValue,
            paymentMethod: distribution ? 'mixed' : paymentMethod,
            paymentStatus: status as 'paid' | 'unpaid' | 'partial',
            amountPaid: paidUSD
        };

        // 1. Save Purchase
        onSavePurchases([...purchases, purchase]);

        // 2. Record Transactions
        const newTransactions: Transaction[] = [];
        const baseTrx = {
            date: new Date().toISOString(),
            type: 'supplier_payment' as const,
            relatedId: purchase.id
        };

        if (distribution) {
            if (distribution.cashUSD > 0) {
                newTransactions.push({ ...baseTrx, id: `TRX-CUSD-${Date.now()}`, amount: distribution.cashUSD, currency: 'USD', method: 'cash', description: `Оплата поставщику (USD Cash): ${supplierName} (Закупка #${purchase.id})` });
            }
            if (distribution.cashUZS > 0) {
                newTransactions.push({ ...baseTrx, id: `TRX-CUZS-${Date.now()}`, amount: distribution.cashUZS, currency: 'UZS', exchangeRate: settings.defaultExchangeRate, method: 'cash', description: `Оплата поставщику (UZS Cash): ${supplierName} (Закупка #${purchase.id})` });
            }
            if (distribution.cardUZS > 0) {
                newTransactions.push({ ...baseTrx, id: `TRX-CARD-${Date.now()}`, amount: distribution.cardUZS, currency: 'UZS', exchangeRate: settings.defaultExchangeRate, method: 'card', description: `Оплата поставщику (UZS Card): ${supplierName} (Закупка #${purchase.id})` });
            }
            if (distribution.bankUZS > 0) {
                newTransactions.push({ ...baseTrx, id: `TRX-BANK-${Date.now()}`, amount: distribution.bankUZS, currency: 'UZS', exchangeRate: settings.defaultExchangeRate, method: 'bank', description: `Оплата поставщику (UZS Bank): ${supplierName} (Закупка #${purchase.id})` });
            }
        } else if (paymentMethod !== 'debt') {
            const transactionAmount = paymentCurrency === 'UZS'
                ? totals.totalInvoiceValue * settings.defaultExchangeRate
                : totals.totalInvoiceValue;

            newTransactions.push({
                ...baseTrx,
                id: `TRX-${Date.now()}`,
                amount: transactionAmount,
                currency: paymentCurrency,
                exchangeRate: paymentCurrency === 'UZS' ? settings.defaultExchangeRate : undefined,
                method: paymentMethod as 'cash' | 'bank',
                description: `Оплата поставщику (${procurementType === 'local' ? 'Местный' : 'Импорт'}): ${supplierName} (Закупка #${purchase.id})`
            });
        }

        if (newTransactions.length > 0) {
            const updatedTransactions = [...transactions, ...newTransactions];
            setTransactions(updatedTransactions);
            if (onSaveTransactions) await onSaveTransactions(updatedTransactions);
        }

        // 3. Update Product Stock & Cost
        const nextProducts = [...products];
        const existingById = new Map<string, Product>(products.map(p => [p.id, p]));

        totals.itemsWithLandedCost.forEach(item => {
            const existing = existingById.get(item.productId);
            if (existing) {
                const newQuantity = (existing.quantity || 0) + item.quantity;
                const oldValue = (existing.quantity || 0) * (existing.costPrice || 0);
                const newValue = item.quantity * (item.landedCost || 0);
                const newCost = newQuantity > 0 ? (oldValue + newValue) / newQuantity : (existing.costPrice || 0);

                const idx = nextProducts.findIndex(p => p.id === existing.id);
                if (idx !== -1) nextProducts[idx] = { ...existing, quantity: newQuantity, costPrice: newCost };
            } else {
                nextProducts.push({
                    id: item.productId || Date.now().toString(),
                    name: item.productName || 'Новый товар',
                    type: ProductType.OTHER,
                    dimensions: '-',
                    steelGrade: 'Ст3',
                    quantity: item.quantity,
                    unit: item.unit,
                    pricePerUnit: item.invoicePrice || 0,
                    costPrice: item.landedCost || item.invoicePrice || 0,
                    minStockLevel: 0,
                    origin: procurementType === 'import' ? 'import' : 'local'
                });
            }
        });

        setProducts(nextProducts);
        if (onSaveProducts) await onSaveProducts(nextProducts);

        // Reset
        setCart([]);
        setSupplierName('');
        setOverheads({ logistics: 0, customsDuty: 0, importVat: 0, other: 0 });
        setPaymentMethod('cash');
        setPaymentCurrency('USD');
        toast.success(`Закупка проведена!`);
    };

    const handleComplete = async () => {
        if (!supplierName || cart.length === 0) {
            toast.warning('Заполните данные поставщика и добавьте товары');
            return;
        }

        if (paymentMethod === 'mixed') {
            setIsSplitModalOpen(true);
        } else {
            finalizeProcurement();
        }
    };

    // ...

    const handleOpenRepayModal = (purchase: Purchase) => {
        setSelectedPurchaseForRepayment(purchase);
        setRepaymentAmount(purchase.totalInvoiceAmount - purchase.amountPaid);
        setRepaymentMethod('cash');
        setRepaymentCurrency('USD');
        setIsRepayModalOpen(true);
    };

    const handleRepayDebt = () => {
        if (!selectedPurchaseForRepayment || repaymentAmount <= 0) return;

        // Calculate USD Equivalent for Purchase update
        let amountUSD = repaymentAmount;
        if (repaymentCurrency === 'UZS') {
            amountUSD = repaymentAmount / settings.defaultExchangeRate;
        }

        // Validate if trying to pay more than debt
        const remainingDebt = selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid;
        // Allow small rounding error margin (0.01)
        if (amountUSD > remainingDebt + 0.1) {
            toast.warning(`Сумма превышает остаток долга! (Макс: $${remainingDebt.toFixed(2)})`);
            return;
        }

        // 1. Create Transaction
        const newTransaction: Transaction = {
            id: `TRX-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'supplier_payment',
            amount: repaymentAmount, // Amount in ACTUAL currency
            currency: repaymentCurrency,
            exchangeRate: repaymentCurrency === 'UZS' ? settings.defaultExchangeRate : undefined,
            method: repaymentMethod,
            description: `Погашение долга поставщику: ${selectedPurchaseForRepayment.supplierName} (Закупка #${selectedPurchaseForRepayment.id})`,
            relatedId: selectedPurchaseForRepayment.id
        };
        const updatedTransactions = [...transactions, newTransaction];
        setTransactions(updatedTransactions);
        if (onSaveTransactions) {
            onSaveTransactions(updatedTransactions);
        }

        // 2. Update Purchase (Always in USD)
        const updatedPurchases = purchases.map(p => {
            if (p.id === selectedPurchaseForRepayment.id) {
                const newAmountPaid = p.amountPaid + amountUSD;
                return {
                    ...p,
                    amountPaid: newAmountPaid,
                    paymentStatus: newAmountPaid >= p.totalInvoiceAmount - 0.1 ? 'paid' : 'partial'
                } as Purchase;
            }
            return p;
        });
        onSavePurchases(updatedPurchases);

        setIsRepayModalOpen(false);
        toast.success(`Оплата поставщику проведена: ${repaymentAmount.toLocaleString()} ${repaymentCurrency}`);
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
            <TopBar
                procurementType={procurementType}
                setProcurementType={setProcurementType}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            {activeTab === 'new' ? (
                <NewPurchaseView
                    procurementType={procurementType}
                    supplierName={supplierName}
                    setSupplierName={setSupplierName}
                    date={date}
                    setDate={setDate}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    paymentCurrency={paymentCurrency}
                    setPaymentCurrency={setPaymentCurrency}
                    products={products}
                    selectedProductId={selectedProductId}
                    setSelectedProductId={setSelectedProductId}
                    inputQty={inputQty}
                    setInputQty={setInputQty}
                    inputPrice={inputPrice}
                    setInputPrice={setInputPrice}
                    openNewProductModal={openNewProductModal}
                    handleAddItem={handleAddItem}
                    removeItem={removeItem}
                    overheads={overheads}
                    setOverheads={setOverheads}
                    totals={totals}
                    cart={cart}
                    settings={settings}
                    handleComplete={handleComplete}
                />
            ) : activeTab === 'workflow' ? (
                <WorkflowTab
                    workflowQueue={workflowQueue}
                    products={products}
                    getMissingItems={getMissingItems}
                    createDraftPurchaseFromWorkflow={createDraftPurchaseFromWorkflow}
                    sendWorkflowToCash={sendWorkflowToCash}
                />
            ) : (
                <HistoryTab
                    purchases={purchases}
                    products={products}
                    transactions={transactions}
                    expandedPurchaseIds={expandedPurchaseIds}
                    togglePurchaseExpand={togglePurchaseExpand}
                    handleOpenRepayModal={handleOpenRepayModal}
                />
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
                                        ${(selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Payment Method Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Способ оплаты</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('cash');
                                            // Cash supports USD and UZS, keeping current if valid, else default USD
                                        }}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'cash'
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        <Banknote size={20} />
                                        <span className="text-xs font-bold">Наличные</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('card');
                                            setRepaymentCurrency('UZS'); // Card - Only Sum
                                        }}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'card'
                                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        <CreditCard size={20} />
                                        <span className="text-xs font-bold">Карта</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('bank');
                                            setRepaymentCurrency('UZS'); // Cashless - Only Sum
                                        }}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'bank'
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        <Building2 size={20} />
                                        <span className="text-xs font-bold">Безнал</span>
                                    </button>
                                </div>
                            </div>

                            {/* Currency Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Валюта</label>
                                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                                    {repaymentMethod === 'cash' ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setRepaymentCurrency('USD');
                                                    // Auto-convert amount for convenience? Maybe cleaner to just reset or let user type.
                                                    // Let's reset to full debt in USD for convenience
                                                    setRepaymentAmount(selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid);
                                                }}
                                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${repaymentCurrency === 'USD' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                                                    }`}
                                            >
                                                USD ($)
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRepaymentCurrency('UZS');
                                                    // Auto-convert full debt to UZS
                                                    const debtUSD = selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid;
                                                    setRepaymentAmount(Math.round(debtUSD * settings.defaultExchangeRate));
                                                }}
                                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${repaymentCurrency === 'UZS' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                                                    }`}
                                            >
                                                UZS (сум)
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="flex-1 py-1.5 rounded-md text-sm font-bold bg-slate-700 text-white shadow cursor-not-allowed opacity-50"
                                            disabled
                                        >
                                            UZS (сум) — Только сумы
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-sm font-medium text-slate-400">Сумма оплаты ({repaymentCurrency})</label>
                                    {repaymentCurrency === 'UZS' && (
                                        <span className="text-xs text-slate-500 self-center">
                                            Курс: {settings.defaultExchangeRate.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    {repaymentCurrency === 'USD' ? (
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    ) : (
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">UZS</span>
                                    )}
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-12 pr-4 py-3 text-white text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={repaymentAmount || ''}
                                        onChange={e => setRepaymentAmount(Number(e.target.value))}
                                    />
                                </div>
                                {repaymentCurrency === 'UZS' && repaymentAmount > 0 && (
                                    <p className="text-xs text-right text-emerald-400">
                                        ≈ ${(repaymentAmount / settings.defaultExchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                                    </p>
                                )}
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

            {/* New Product Modal */}
            {isNewProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h3 className="text-xl font-bold text-white">Новый товар</h3>
                            <button onClick={() => setIsNewProductModalOpen(false)} className="text-slate-400 hover:text-white">
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-medium text-slate-400">Название *</label>
                                    <input
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newProductData.name || ''}
                                        onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                                        placeholder="Например: Труба"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Тип</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none"
                                        value={newProductData.type}
                                        onChange={(e) => setNewProductData({ ...newProductData, type: e.target.value as ProductType })}
                                    >
                                        {Object.values(ProductType).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Ед. изм.</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none"
                                        value={newProductData.unit}
                                        onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value as Unit })}
                                    >
                                        {Object.values(Unit).map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Размеры *</label>
                                    <input
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newProductData.dimensions || ''}
                                        onChange={(e) => setNewProductData({ ...newProductData, dimensions: e.target.value })}
                                        placeholder="50x50x3"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Марка стали</label>
                                    <input
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newProductData.steelGrade || ''}
                                        onChange={(e) => setNewProductData({ ...newProductData, steelGrade: e.target.value })}
                                        placeholder="Ст3"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Цена продажи (USD)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                        value={newProductData.pricePerUnit ?? 0}
                                        onChange={(e) => setNewProductData({ ...newProductData, pricePerUnit: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Минимальный остаток</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                        value={newProductData.minStockLevel ?? 0}
                                        onChange={(e) => setNewProductData({ ...newProductData, minStockLevel: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Происхождение</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none"
                                        value={newProductData.origin || 'local'}
                                        onChange={(e) => setNewProductData({ ...newProductData, origin: e.target.value as 'import' | 'local' })}
                                    >
                                        <option value="local">Местный</option>
                                        <option value="import">Импорт</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50">
                            <button
                                onClick={() => setIsNewProductModalOpen(false)}
                                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleCreateNewProduct}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-600/20"
                            >
                                Сохранить
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
                totalAmountUZS={totals.totalInvoiceValue * settings.defaultExchangeRate}
                exchangeRate={settings.defaultExchangeRate}
                onConfirm={finalizeProcurement}
            />
        </div>
    );
};
