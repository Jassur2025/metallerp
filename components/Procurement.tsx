import React, { useState, useMemo } from 'react';
import { Product, Purchase, PurchaseItem, PurchaseOverheads, Transaction, WorkflowOrder, OrderItem, ProductType, Unit, WarehouseType } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { Plus, DollarSign, Wallet, CreditCard, Building2, Banknote, AlertTriangle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { PaymentSplitModal, PaymentDistribution } from './Sales/PaymentSplitModal';

import type { ProcurementProps, ProcurementTab, ProcurementType, PaymentMethod, PaymentCurrency, Totals, Balances } from './Procurement/types';
import { TopBar } from './Procurement/TopBar';
import { NewPurchaseView } from './Procurement/NewPurchaseView';
import { WorkflowTab } from './Procurement/WorkflowTab';
import { HistoryTab } from './Procurement/HistoryTab';

const isDev = import.meta.env.DEV;
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };

export const Procurement: React.FC<ProcurementProps> = ({ products, setProducts, settings, purchases, onSavePurchases, transactions, setTransactions, workflowOrders, onSaveWorkflowOrders, onSaveProducts, onSaveTransactions, balances }) => {
    const toast = useToast();
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
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

    // Warehouse selection
    const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseType>(WarehouseType.MAIN);

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
    const [isRepaymentSplitModalOpen, setIsRepaymentSplitModalOpen] = useState(false);

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

    // Workflow Cancel Modal
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [workflowToCancel, setWorkflowToCancel] = useState<WorkflowOrder | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const openCancelModal = (wf: WorkflowOrder) => {
        setWorkflowToCancel(wf);
        setCancelReason('');
        setIsCancelModalOpen(true);
    };

    const confirmCancelWorkflow = async () => {
        if (!workflowToCancel) return;
        if (!cancelReason.trim()) {
            toast.warning('Укажите причину аннулирования');
            return;
        }

        const updated = workflowOrders.map(o =>
            o.id === workflowToCancel.id
                ? {
                      ...o,
                      status: 'cancelled' as const,
                      cancellationReason: cancelReason.trim(),
                      cancelledBy: 'Закуп',
                      cancelledAt: new Date().toISOString()
                  }
                : o
        );

        await onSaveWorkflowOrders(updated);
        toast.success('Заказ аннулирован');
        setIsCancelModalOpen(false);
        setWorkflowToCancel(null);
        setCancelReason('');
    };

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
                totalLineCost: 0,
                dimensions: p?.dimensions || m.item.dimensions || ''
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
            id: IdGenerator.product(),
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
        // CRITICAL: Save to Sheets FIRST, then update state
        await onSaveProducts?.(updated);
        setProducts(updated);
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
            dimensions: product.dimensions, // Добавляем размер
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

    // Функции редактирования количества и цены в cart
    const updateCartItemQty = (productId: string, qty: number) => {
        setCart(cart.map(item => {
            if (item.productId !== productId) return item;
            const validQty = Math.max(0, qty);
            return {
                ...item,
                quantity: validQty,
                totalLineCost: validQty * item.invoicePrice
            };
        }));
    };

    const updateCartItemPrice = (productId: string, price: number) => {
        setCart(cart.map(item => {
            if (item.productId !== productId) return item;
            const validPrice = Math.max(0, price);
            const vatRate = settings.vatRate || 12;
            const priceWithoutVat = validPrice / (1 + vatRate / 100);
            const vatAmount = validPrice - priceWithoutVat;
            return {
                ...item,
                invoicePrice: validPrice, // UZS с НДС
                invoicePriceWithoutVat: priceWithoutVat, // UZS без НДС
                vatAmount: vatAmount, // НДС в UZS
                landedCost: validPrice, // будет пересчитано
                totalLineCost: item.quantity * validPrice,
                totalLineCostUZS: item.quantity * validPrice
            };
        }));
    };

    // --- Calculation Logic ---
    // Закупка в UZS с НДС, в ТМЦ приходит без НДС
    const totals: Totals = useMemo(() => {
        const rate = settings.defaultExchangeRate || 12800;
        const vatRate = settings.vatRate || 12;
        
        // Сумма в UZS (с НДС) - для кредиторки поставщику
        const totalInvoiceValueUZS = cart.reduce((sum, item) => sum + (item.quantity * item.invoicePrice), 0);
        
        // Сумма НДС в UZS
        const totalVatAmountUZS = totalInvoiceValueUZS - (totalInvoiceValueUZS / (1 + vatRate / 100));
        
        // Сумма без НДС в UZS
        const totalWithoutVatUZS = totalInvoiceValueUZS - totalVatAmountUZS;
        
        // Сумма без НДС в USD - для приходования в ТМЦ
        const totalInvoiceValue = totalWithoutVatUZS / rate;

        let totalOverheads = 0;
        let totalLandedValue = totalInvoiceValue;
        let itemsWithLandedCost: PurchaseItem[] = [];

        if (procurementType === 'import') {
            totalOverheads = overheads.logistics + overheads.customsDuty + overheads.other;
            totalLandedValue = totalInvoiceValue + totalOverheads;

            itemsWithLandedCost = cart.map(item => {
                if (totalInvoiceValueUZS === 0) return item as PurchaseItem;

                const lineValueUZS = item.quantity * item.invoicePrice;
                const lineVat = lineValueUZS - (lineValueUZS / (1 + vatRate / 100));
                const lineWithoutVat = lineValueUZS - lineVat;
                const lineWithoutVatUSD = lineWithoutVat / rate;
                
                const proportion = lineWithoutVatUSD / totalInvoiceValue;
                const allocatedOverhead = totalOverheads * proportion;
                const landedCostPerUnit = (lineWithoutVatUSD + allocatedOverhead) / item.quantity;

                return {
                    ...item,
                    invoicePriceWithoutVat: (item.invoicePrice / (1 + vatRate / 100)),
                    vatAmount: item.invoicePrice - (item.invoicePrice / (1 + vatRate / 100)),
                    landedCost: landedCostPerUnit, // USD без НДС
                    totalLineCost: landedCostPerUnit * item.quantity, // USD
                    totalLineCostUZS: lineValueUZS // UZS с НДС
                };
            });
        } else {
            // Local: себестоимость = цена без НДС в USD
            itemsWithLandedCost = cart.map(item => {
                const priceWithoutVat = item.invoicePrice / (1 + vatRate / 100);
                const vatAmount = item.invoicePrice - priceWithoutVat;
                const landedCostUSD = priceWithoutVat / rate;
                
                return {
                    ...item,
                    invoicePriceWithoutVat: priceWithoutVat,
                    vatAmount: vatAmount,
                    landedCost: landedCostUSD, // USD без НДС
                    totalLineCost: item.quantity * landedCostUSD, // USD
                    totalLineCostUZS: item.quantity * item.invoicePrice // UZS с НДС
                };
            });
        }

        return {
            totalInvoiceValue, // USD без НДС (legacy)
            totalInvoiceValueUZS, // UZS с НДС
            totalVatAmountUZS,
            totalWithoutVatUZS,
            totalOverheads,
            totalLandedValue, // USD без НДС
            itemsWithLandedCost
        };
    }, [cart, overheads, procurementType, settings.defaultExchangeRate, settings.vatRate]);

    // Update amountPaid when totals change if method is not debt
    React.useEffect(() => {
        if (paymentMethod !== 'debt') {
            // Оплата поставщику в UZS (с НДС)
            setAmountPaid(totals.totalInvoiceValueUZS);
        } else {
            setAmountPaid(0);
        }
    }, [totals.totalInvoiceValueUZS, paymentMethod]);

    // Проверка достаточности средств на кассе (теперь в UZS)
    const checkBalance = (method: PaymentMethod, currency: PaymentCurrency, amountUZS: number): { ok: boolean; message: string } => {
        if (!balances) return { ok: true, message: '' }; // Если балансы не переданы, пропускаем проверку
        
        const rate = settings.defaultExchangeRate || 12900;
        
        if (method === 'cash') {
            if (currency === 'USD') {
                const amountUSD = amountUZS / rate;
                if (balances.cashUSD < amountUSD) {
                    return { ok: false, message: `Недостаточно USD в кассе. Доступно: $${balances.cashUSD.toFixed(2)}, нужно: $${amountUSD.toFixed(2)}` };
                }
            } else {
                if (balances.cashUZS < amountUZS) {
                    return { ok: false, message: `Недостаточно сум в кассе. Доступно: ${balances.cashUZS.toLocaleString()} сум, нужно: ${amountUZS.toLocaleString()} сум` };
                }
            }
        } else if (method === 'bank') {
            if (balances.bankUZS < amountUZS) {
                return { ok: false, message: `Недостаточно средств на Р/С. Доступно: ${balances.bankUZS.toLocaleString()} сум, нужно: ${amountUZS.toLocaleString()} сум` };
            }
        } else if (method === 'card') {
            if (balances.cardUZS < amountUZS) {
                return { ok: false, message: `Недостаточно средств на карте. Доступно: ${balances.cardUZS.toLocaleString()} сум, нужно: ${amountUZS.toLocaleString()} сум` };
            }
        }
        
        return { ok: true, message: '' };
    };

    const finalizeProcurement = async (distribution?: PaymentDistribution) => {
        if (!supplierName || cart.length === 0) return;

        const rate = settings.defaultExchangeRate || 12800;
        const totalToPayUZS = totals.totalInvoiceValueUZS; // Оплата в UZS с НДС
        
        // Проверка баланса перед оплатой (если не в долг и не смешанная)
        if (paymentMethod !== 'debt' && paymentMethod !== 'mixed' && !distribution) {
            const balanceCheck = checkBalance(paymentMethod, paymentCurrency, totalToPayUZS);
            if (!balanceCheck.ok) {
                toast.error(balanceCheck.message);
                // Предложить записать в долг
                const confirmDebt = window.confirm(`${balanceCheck.message}\n\nЗаписать закупку в долг поставщику?`);
                if (confirmDebt) {
                    setPaymentMethod('debt');
                    toast.info('Закупка будет записана в долг. Нажмите "Провести" ещё раз.');
                }
                return;
            }
        }

        // Оплачено в UZS
        const paidUZS = distribution 
            ? (distribution.cashUZS + distribution.cardUZS + distribution.bankUZS + (distribution.cashUSD * rate))
            : (paymentMethod === 'debt' ? 0 : totalToPayUZS);
        const paidUSD = paidUZS / rate;
        
        const status = distribution 
            ? (distribution.isPaid ? 'paid' : (paidUZS > 0 ? 'partial' : 'unpaid')) 
            : (paymentMethod === 'debt' ? 'unpaid' : 'paid');

        const purchase: Purchase = {
            id: IdGenerator.purchase(),
            date: new Date(date).toISOString(),
            supplierName,
            status: 'completed',
            items: totals.itemsWithLandedCost.map(item => ({ ...item, warehouse: selectedWarehouse })),
            overheads: procurementType === 'import' ? overheads : { logistics: 0, customsDuty: 0, importVat: 0, other: 0 },
            
            // Суммы в UZS (с НДС) - для кредиторки
            totalInvoiceAmountUZS: totals.totalInvoiceValueUZS,
            totalVatAmountUZS: totals.totalVatAmountUZS,
            totalWithoutVatUZS: totals.totalWithoutVatUZS,
            
            // Суммы в USD (без НДС) - для ТМЦ
            totalInvoiceAmount: totals.totalInvoiceValue, // legacy
            totalLandedAmount: totals.totalLandedValue,
            
            exchangeRate: rate,
            paymentMethod: distribution ? 'mixed' : paymentMethod,
            paymentCurrency: paymentMethod === 'cash' ? paymentCurrency : 'UZS',
            paymentStatus: status as 'paid' | 'unpaid' | 'partial',
            amountPaid: paidUZS, // Теперь в UZS
            amountPaidUSD: paidUSD,
            warehouse: selectedWarehouse
        };

        // 1. Save Purchase
        onSavePurchases([...purchases, purchase]);

        // 2. Record Transactions (все в UZS кроме наличных USD)
        const newTransactions: Transaction[] = [];
        const baseTrx = {
            date: new Date().toISOString(),
            type: 'supplier_payment' as const,
            relatedId: purchase.id
        };

        if (distribution) {
            if (distribution.cashUSD > 0) {
                newTransactions.push({ ...baseTrx, id: IdGenerator.transaction(), amount: distribution.cashUSD, currency: 'USD', method: 'cash', description: `Оплата поставщику (USD Cash): ${supplierName} (Закупка #${purchase.id})` });
            }
            if (distribution.cashUZS > 0) {
                newTransactions.push({ ...baseTrx, id: IdGenerator.transaction(), amount: distribution.cashUZS, currency: 'UZS', exchangeRate: rate, method: 'cash', description: `Оплата поставщику (UZS Cash): ${supplierName} (Закупка #${purchase.id})` });
            }
            if (distribution.cardUZS > 0) {
                newTransactions.push({ ...baseTrx, id: IdGenerator.transaction(), amount: distribution.cardUZS, currency: 'UZS', exchangeRate: rate, method: 'card', description: `Оплата поставщику (UZS Card): ${supplierName} (Закупка #${purchase.id})` });
            }
            if (distribution.bankUZS > 0) {
                newTransactions.push({ ...baseTrx, id: IdGenerator.transaction(), amount: distribution.bankUZS, currency: 'UZS', exchangeRate: rate, method: 'bank', description: `Оплата поставщику (UZS Bank): ${supplierName} (Закупка #${purchase.id})` });
            }
        } else if (paymentMethod !== 'debt') {
            // Все оплаты теперь в UZS (кроме наличных USD)
            const isCardOrBank = paymentMethod === 'card' || paymentMethod === 'bank';
            const currency = isCardOrBank ? 'UZS' : paymentCurrency;
            // Сумма оплаты в UZS (с НДС)
            const transactionAmount = currency === 'UZS'
                ? totalToPayUZS
                : totalToPayUZS / rate; // Если USD - конвертируем

            newTransactions.push({
                ...baseTrx,
                id: IdGenerator.transaction(),
                amount: transactionAmount,
                currency: currency,
                exchangeRate: currency === 'UZS' ? rate : undefined,
                method: paymentMethod as 'cash' | 'bank' | 'card',
                description: `Оплата поставщику (${paymentMethod === 'cash' ? (paymentCurrency === 'USD' ? 'Нал USD' : 'Нал UZS') : paymentMethod === 'card' ? 'Карта' : 'Р/С'}): ${supplierName}`
            });
        }

        if (newTransactions.length > 0) {
            const updatedTransactions = [...transactions, ...newTransactions];
            // CRITICAL: Save to Sheets FIRST, then update state
            if (onSaveTransactions) await onSaveTransactions(updatedTransactions);
            setTransactions(updatedTransactions);
        }

        // 3. Update Product Stock & Cost (с учётом склада)
        const nextProducts = [...products];
        // Ключ: productId + warehouse для уникальной идентификации
        const getProductKey = (productId: string, warehouse: WarehouseType) => `${productId}_${warehouse}`;
        const existingByKey = new Map<string, { product: Product; index: number }>();
        products.forEach((p, idx) => {
            const key = getProductKey(p.id, p.warehouse || WarehouseType.MAIN);
            existingByKey.set(key, { product: p, index: idx });
        });

        totals.itemsWithLandedCost.forEach(item => {
            const itemWarehouse = selectedWarehouse;
            const key = getProductKey(item.productId, itemWarehouse);
            const existingEntry = existingByKey.get(key);
            
            // Также ищем товар с тем же ID но без привязки к складу (для обратной совместимости)
            const existingWithoutWarehouse = products.find(p => p.id === item.productId && !p.warehouse);
            
            if (existingEntry) {
                // Товар уже есть на этом складе - обновляем количество и средневзвешенную себестоимость
                const existing = existingEntry.product;
                const newQuantity = (existing.quantity || 0) + item.quantity;
                const oldValue = (existing.quantity || 0) * (existing.costPrice || 0);
                const newValue = item.quantity * (item.landedCost || 0);
                const newCost = newQuantity > 0 ? (oldValue + newValue) / newQuantity : (existing.costPrice || 0);

                const idx = existingEntry.index;
                if (idx !== -1) nextProducts[idx] = { ...existing, quantity: newQuantity, costPrice: newCost, warehouse: itemWarehouse };
            } else if (existingWithoutWarehouse) {
                // Товар существует, но без склада - обновляем и добавляем склад
                const idx = nextProducts.findIndex(p => p.id === item.productId && !p.warehouse);
                if (idx !== -1) {
                    const existing = nextProducts[idx];
                    const newQuantity = (existing.quantity || 0) + item.quantity;
                    const oldValue = (existing.quantity || 0) * (existing.costPrice || 0);
                    const newValue = item.quantity * (item.landedCost || 0);
                    const newCost = newQuantity > 0 ? (oldValue + newValue) / newQuantity : (existing.costPrice || 0);
                    nextProducts[idx] = { ...existing, quantity: newQuantity, costPrice: newCost, warehouse: itemWarehouse };
                }
            } else {
                // Товар не найден на этом складе - проверяем есть ли товар на другом складе
                const existingOnOtherWarehouse = products.find(p => p.id === item.productId);
                if (existingOnOtherWarehouse) {
                    // Создаём новую запись для этого склада с теми же параметрами товара
                    nextProducts.push({
                        ...existingOnOtherWarehouse,
                        id: IdGenerator.product(), // Новый ID для записи на новом складе
                        quantity: item.quantity,
                        costPrice: item.landedCost || item.invoicePrice || 0,
                        warehouse: itemWarehouse
                    });
                } else {
                    // Совсем новый товар
                    nextProducts.push({
                        id: item.productId || IdGenerator.product(),
                        name: item.productName || 'Новый товар',
                        type: ProductType.OTHER,
                        dimensions: '-',
                        steelGrade: 'Ст3',
                        quantity: item.quantity,
                        unit: item.unit,
                        pricePerUnit: item.invoicePrice || 0,
                        costPrice: item.landedCost || item.invoicePrice || 0,
                        minStockLevel: 0,
                        origin: procurementType === 'import' ? 'import' : 'local',
                        warehouse: itemWarehouse
                    });
                }
            }
        });

        // CRITICAL: Save to Sheets FIRST, then update state
        if (onSaveProducts) await onSaveProducts(nextProducts);
        setProducts(nextProducts);

        // Reset
        setCart([]);
        setSupplierName('');
        setOverheads({ logistics: 0, customsDuty: 0, importVat: 0, other: 0 });
        setPaymentMethod('cash');
        setPaymentCurrency('USD');
        toast.success(`Закупка проведена!`);
    };

    // Функции редактирования позиций в истории закупок
    const handleUpdatePurchaseItem = async (purchaseId: string, itemIndex: number, updates: Partial<PurchaseItem>) => {
        const purchase = purchases.find(p => p.id === purchaseId);
        if (!purchase) return;

        const updatedItems = [...(purchase.items || [])];
        if (itemIndex < 0 || itemIndex >= updatedItems.length) return;

        // Обновить позицию
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updates };

        // Пересчитать итоги
        const newTotalInvoice = updatedItems.reduce((sum, it) => sum + (it.quantity * (it.invoicePrice || 0)), 0);
        const newTotalLanded = updatedItems.reduce((sum, it) => sum + (it.quantity * (it.landedCost || it.invoicePrice || 0)), 0);

        const updatedPurchase: Purchase = {
            ...purchase,
            items: updatedItems,
            totalInvoiceAmount: newTotalInvoice,
            totalLandedAmount: newTotalLanded
        };

        const updatedPurchases = purchases.map(p => p.id === purchaseId ? updatedPurchase : p);
        await onSavePurchases(updatedPurchases);

        // Также обновить остатки товаров если изменился товар или кол-во
        const oldItem = purchase.items?.[itemIndex];
        if (oldItem && (oldItem.productId !== updates.productId || oldItem.quantity !== updates.quantity)) {
            // Вернуть старое количество
            const updatedProducts = products.map(p => {
                if (p.id === oldItem.productId) {
                    return { ...p, quantity: (p.quantity || 0) - (oldItem.quantity || 0) };
                }
                if (updates.productId && p.id === updates.productId) {
                    return { ...p, quantity: (p.quantity || 0) + (updates.quantity || 0) };
                }
                return p;
            });
            if (onSaveProducts) {
                await onSaveProducts(updatedProducts);
            }
        }

        toast.success('Позиция обновлена');
    };

    const handleDeletePurchaseItem = async (purchaseId: string, itemIndex: number) => {
        const purchase = purchases.find(p => p.id === purchaseId);
        if (!purchase || !purchase.items) return;

        const deletedItem = purchase.items[itemIndex];
        const updatedItems = purchase.items.filter((_, idx) => idx !== itemIndex);

        // Пересчитать итоги
        const newTotalInvoice = updatedItems.reduce((sum, it) => sum + (it.quantity * (it.invoicePrice || 0)), 0);
        const newTotalLanded = updatedItems.reduce((sum, it) => sum + (it.quantity * (it.landedCost || it.invoicePrice || 0)), 0);

        const updatedPurchase: Purchase = {
            ...purchase,
            items: updatedItems,
            totalInvoiceAmount: newTotalInvoice,
            totalLandedAmount: newTotalLanded
        };

        const updatedPurchases = purchases.map(p => p.id === purchaseId ? updatedPurchase : p);
        await onSavePurchases(updatedPurchases);

        // Убрать из остатков удаленный товар
        if (deletedItem) {
            const updatedProducts = products.map(p => {
                if (p.id === deletedItem.productId) {
                    return { ...p, quantity: Math.max(0, (p.quantity || 0) - (deletedItem.quantity || 0)) };
                }
                return p;
            });
            if (onSaveProducts) {
                await onSaveProducts(updatedProducts);
            }
        }

        toast.success('Позиция удалена');
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

    const handleRepayDebt = (distribution?: PaymentDistribution) => {
        if (!selectedPurchaseForRepayment) return;
        
        const rate = settings.defaultExchangeRate || 12900;
        const remainingDebt = selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid;
        const remainingDebtUZS = remainingDebt * rate;
        
        let amountUSD: number;
        let amountUZS: number;
        const newTransactions: Transaction[] = [];
        const baseTrx = {
            date: new Date().toISOString(),
            type: 'supplier_payment' as const,
            relatedId: selectedPurchaseForRepayment.id
        };
        
        if (distribution) {
            // Микс оплата
            amountUZS = distribution.cashUZS + distribution.cardUZS + distribution.bankUZS + (distribution.cashUSD * rate);
            amountUSD = amountUZS / rate;
            
            if (distribution.cashUSD > 0) {
                newTransactions.push({ 
                    ...baseTrx, 
                    id: IdGenerator.transaction(), 
                    amount: distribution.cashUSD, 
                    currency: 'USD', 
                    method: 'cash', 
                    description: `Погашение долга поставщику (Нал USD): ${selectedPurchaseForRepayment.supplierName}` 
                });
            }
            if (distribution.cashUZS > 0) {
                newTransactions.push({ 
                    ...baseTrx, 
                    id: IdGenerator.transaction(), 
                    amount: distribution.cashUZS, 
                    currency: 'UZS', 
                    exchangeRate: rate, 
                    method: 'cash', 
                    description: `Погашение долга поставщику (Нал сум): ${selectedPurchaseForRepayment.supplierName}` 
                });
            }
            if (distribution.cardUZS > 0) {
                newTransactions.push({ 
                    ...baseTrx, 
                    id: IdGenerator.transaction(), 
                    amount: distribution.cardUZS, 
                    currency: 'UZS', 
                    exchangeRate: rate, 
                    method: 'card', 
                    description: `Погашение долга поставщику (Карта): ${selectedPurchaseForRepayment.supplierName}` 
                });
            }
            if (distribution.bankUZS > 0) {
                newTransactions.push({ 
                    ...baseTrx, 
                    id: IdGenerator.transaction(), 
                    amount: distribution.bankUZS, 
                    currency: 'UZS', 
                    exchangeRate: rate, 
                    method: 'bank', 
                    description: `Погашение долга поставщику (Р/С): ${selectedPurchaseForRepayment.supplierName}` 
                });
            }
        } else {
            // Обычная оплата одним методом
            if (repaymentAmount <= 0) return;
            
            // Calculate USD Equivalent for Purchase update
            if (repaymentCurrency === 'UZS') {
                amountUZS = repaymentAmount;
                amountUSD = repaymentAmount / rate;
            } else {
                amountUSD = repaymentAmount;
                amountUZS = repaymentAmount * rate;
            }
            
            // Validate if trying to pay more than debt
            if (amountUSD > remainingDebt + 0.1) {
                toast.warning(`Сумма превышает остаток долга! (Макс: $${remainingDebt.toFixed(2)})`);
                return;
            }
            
            // Проверка баланса кассы
            if (balances) {
                if (repaymentMethod === 'cash') {
                    if (repaymentCurrency === 'USD' && balances.cashUSD < amountUSD) {
                        toast.error(`Недостаточно USD в кассе. Доступно: $${balances.cashUSD.toFixed(2)}`);
                        return;
                    }
                    if (repaymentCurrency === 'UZS' && balances.cashUZS < amountUZS) {
                        toast.error(`Недостаточно сум в кассе. Доступно: ${balances.cashUZS.toLocaleString()} сум`);
                        return;
                    }
                } else if (repaymentMethod === 'card' && balances.cardUZS < amountUZS) {
                    toast.error(`Недостаточно средств на карте. Доступно: ${balances.cardUZS.toLocaleString()} сум`);
                    return;
                } else if (repaymentMethod === 'bank' && balances.bankUZS < amountUZS) {
                    toast.error(`Недостаточно средств на Р/С. Доступно: ${balances.bankUZS.toLocaleString()} сум`);
                    return;
                }
            }
            
            // Create single transaction
            const methodLabel = repaymentMethod === 'cash' 
                ? (repaymentCurrency === 'USD' ? 'Нал USD' : 'Нал сум') 
                : repaymentMethod === 'card' ? 'Карта' : 'Р/С';
                
            newTransactions.push({
                ...baseTrx,
                id: IdGenerator.transaction(),
                amount: repaymentAmount,
                currency: repaymentCurrency,
                exchangeRate: repaymentCurrency === 'UZS' ? rate : undefined,
                method: repaymentMethod as 'cash' | 'bank' | 'card',
                description: `Погашение долга поставщику (${methodLabel}): ${selectedPurchaseForRepayment.supplierName}`
            });
        }

        // Save Transactions
        if (newTransactions.length > 0) {
            const updatedTransactions = [...transactions, ...newTransactions];
            setTransactions(updatedTransactions);
            if (onSaveTransactions) {
                onSaveTransactions(updatedTransactions);
            }
        }

        // Update Purchase (Always in USD)
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
        setIsRepaymentSplitModalOpen(false);
        toast.success(`Оплата поставщику проведена: ${amountUZS.toLocaleString()} сум ($${amountUSD.toFixed(2)})`);
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
                    selectedWarehouse={selectedWarehouse}
                    setSelectedWarehouse={setSelectedWarehouse}
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
                    updateCartItemQty={updateCartItemQty}
                    updateCartItemPrice={updateCartItemPrice}
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
                    onCancelWorkflow={openCancelModal}
                />
            ) : (
                <HistoryTab
                    purchases={purchases}
                    products={products}
                    transactions={transactions}
                    expandedPurchaseIds={expandedPurchaseIds}
                    togglePurchaseExpand={togglePurchaseExpand}
                    handleOpenRepayModal={handleOpenRepayModal}
                    onUpdatePurchaseItem={handleUpdatePurchaseItem}
                    onDeletePurchaseItem={handleDeletePurchaseItem}
                />
            )}

            {/* Repayment Modal */}
            {isRepayModalOpen && selectedPurchaseForRepayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-sm border ${t.border} shadow-2xl animate-scale-in`}>
                        <div className={`p-6 border-b ${t.border} flex justify-between items-center`}>
                            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                                <Wallet className="text-emerald-500" /> Оплата поставщику
                            </h3>
                            <button onClick={() => setIsRepayModalOpen(false)} className={`${t.textMuted} hover:${t.text}`}>
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className={`${t.bg} p-4 rounded-xl border ${t.border}`}>
                                <p className={`text-sm ${t.textMuted} mb-1`}>Поставщик</p>
                                <p className={`text-lg font-bold ${t.text}`}>{selectedPurchaseForRepayment.supplierName}</p>
                                <div className="mt-3 flex justify-between items-end">
                                    <span className={`text-sm ${t.textMuted}`}>Остаток долга:</span>
                                    <span className="text-xl font-mono font-bold text-red-400">
                                        ${(selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Available Balances */}
                            {balances && (
                                <div className={`${t.bg} p-3 rounded-xl border ${t.border}`}>
                                    <p className={`text-xs font-medium ${t.textMuted} mb-2`}>Доступно в кассах:</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className={t.textMuted}>Нал USD:</span>
                                            <span className="text-emerald-400 font-mono">${balances.cashUSD.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className={t.textMuted}>Нал сум:</span>
                                            <span className="text-blue-400 font-mono">{balances.cashUZS.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className={t.textMuted}>Карта:</span>
                                            <span className="text-purple-400 font-mono">{balances.cardUZS.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className={t.textMuted}>Р/С:</span>
                                            <span className="text-amber-400 font-mono">{balances.bankUZS.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Payment Method Selector */}
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Способ оплаты</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('cash');
                                            // Cash supports USD and UZS, keeping current if valid, else default USD
                                        }}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'cash'
                                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                                            : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`
                                            }`}
                                    >
                                        <Banknote size={20} />
                                        <span className="text-xs font-bold">Нал</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('card');
                                            setRepaymentCurrency('UZS'); // Card - Only Sum
                                        }}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${repaymentMethod === 'card'
                                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                                            : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`
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
                                            : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`
                                            }`}
                                    >
                                        <Building2 size={20} />
                                        <span className="text-xs font-bold">Р/С</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsRepayModalOpen(false);
                                            setIsRepaymentSplitModalOpen(true);
                                        }}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/50 text-purple-400 hover:border-purple-400`}
                                    >
                                        <Wallet size={20} />
                                        <span className="text-xs font-bold">Микс</span>
                                    </button>
                                </div>
                            </div>

                            {/* Currency Selector */}
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Валюта</label>
                                <div className={`flex ${t.bg} rounded-lg p-1 border ${t.border}`}>
                                    {repaymentMethod === 'cash' ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setRepaymentCurrency('USD');
                                                    // Auto-convert amount for convenience? Maybe cleaner to just reset or let user type.
                                                    // Let's reset to full debt in USD for convenience
                                                    setRepaymentAmount(selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid);
                                                }}
                                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${repaymentCurrency === 'USD' ? `${t.bgCard} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`
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
                                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${repaymentCurrency === 'UZS' ? `${t.bgCard} ${t.text} shadow` : `${t.textMuted} hover:${t.text}`
                                                    }`}
                                            >
                                                UZS (сум)
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className={`flex-1 py-1.5 rounded-md text-sm font-bold ${t.bgCard} ${t.text} shadow cursor-not-allowed opacity-50`}
                                            disabled
                                        >
                                            UZS (сум) — Только сумы
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>Сумма оплаты ({repaymentCurrency})</label>
                                    {repaymentCurrency === 'UZS' && (
                                        <span className={`text-xs ${t.textMuted} self-center`}>
                                            Курс: {settings.defaultExchangeRate.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    {repaymentCurrency === 'USD' ? (
                                        <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
                                    ) : (
                                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted} font-bold text-xs`}>UZS</span>
                                    )}
                                    <input
                                        type="number"
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg pl-12 pr-4 py-3 ${t.text} text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none`}
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
                                className={`w-full bg-emerald-600 hover:bg-emerald-500 disabled:${t.bgHover} disabled:${t.textMuted} text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20`}
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
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-2xl border ${t.border} shadow-2xl overflow-hidden`}>
                        <div className={`p-6 border-b ${t.border} flex justify-between items-center ${t.bg}`}>
                            <h3 className={`text-xl font-bold ${t.text}`}>Новый товар</h3>
                            <button onClick={() => setIsNewProductModalOpen(false)} className={`${t.textMuted} hover:${t.text}`}>
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Название *</label>
                                    <input
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500`}
                                        value={newProductData.name || ''}
                                        onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                                        placeholder="Например: Труба"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Тип</label>
                                    <select
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                                        value={newProductData.type}
                                        onChange={(e) => setNewProductData({ ...newProductData, type: e.target.value as ProductType })}
                                    >
                                        {Object.values(ProductType).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Ед. изм.</label>
                                    <select
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                                        value={newProductData.unit}
                                        onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value as Unit })}
                                    >
                                        {Object.values(Unit).map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Размеры *</label>
                                    <input
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500`}
                                        value={newProductData.dimensions || ''}
                                        onChange={(e) => setNewProductData({ ...newProductData, dimensions: e.target.value })}
                                        placeholder="50x50x3"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Марка стали</label>
                                    <input
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500`}
                                        value={newProductData.steelGrade || ''}
                                        onChange={(e) => setNewProductData({ ...newProductData, steelGrade: e.target.value })}
                                        placeholder="Ст3"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Цена продажи (сум)</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500 font-mono`}
                                        value={newProductData.pricePerUnit ?? 0}
                                        onChange={(e) => setNewProductData({ ...newProductData, pricePerUnit: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Минимальный остаток</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500 font-mono`}
                                        value={newProductData.minStockLevel ?? 0}
                                        onChange={(e) => setNewProductData({ ...newProductData, minStockLevel: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className={`text-xs font-medium ${t.textMuted}`}>Происхождение</label>
                                    <select
                                        className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                                        value={newProductData.origin || 'local'}
                                        onChange={(e) => setNewProductData({ ...newProductData, origin: e.target.value as 'import' | 'local' })}
                                    >
                                        <option value="local">Местный</option>
                                        <option value="import">Импорт</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 border-t ${t.border} flex justify-end gap-3 ${t.bg}`}>
                            <button
                                onClick={() => setIsNewProductModalOpen(false)}
                                className={`px-4 py-2 ${t.textMuted} hover:${t.text} transition-colors`}
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

            {/* Cancel Workflow Modal */}
            {isCancelModalOpen && workflowToCancel && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className={`${t.bgCard} rounded-2xl border ${t.border} w-full max-w-md p-6`}>
                        <h3 className={`text-xl font-bold ${t.text} mb-4 flex items-center gap-2`}>
                            <AlertTriangle className="text-red-400" size={24} />
                            Аннулирование заказа
                        </h3>
                        
                        <div className={`${t.bg} rounded-xl p-4 mb-4`}>
                            <div className={`text-sm ${t.textMuted}`}>Заказ: <span className={`${t.text} font-mono`}>{workflowToCancel.id}</span></div>
                            <div className={`text-sm ${t.textMuted} mt-1`}>Клиент: <span className={t.text}>{workflowToCancel.customerName}</span></div>
                            <div className={`text-sm ${t.textMuted} mt-1`}>Сумма: <span className="text-emerald-300 font-mono">{Number(workflowToCancel.totalAmountUZS || 0).toLocaleString()} сум</span></div>
                        </div>

                        <div className="mb-4">
                            <label className={`text-sm ${t.textMuted} mb-2 block`}>Причина аннулирования *</label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className={`w-full ${t.bg} border ${t.border} rounded-xl px-4 py-3 ${t.text} outline-none focus:ring-2 focus:ring-red-500/50 h-24 resize-none`}
                                placeholder="Укажите причину аннулирования..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIsCancelModalOpen(false); setWorkflowToCancel(null); setCancelReason(''); }}
                                className={`flex-1 ${t.bgHover} hover:${t.bg} ${t.text} py-3 rounded-xl font-medium`}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={confirmCancelWorkflow}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold"
                            >
                                Аннулировать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Split Modal for Repayment */}
            {selectedPurchaseForRepayment && (
                <PaymentSplitModal
                    isOpen={isRepaymentSplitModalOpen}
                    onClose={() => {
                        setIsRepaymentSplitModalOpen(false);
                        setIsRepayModalOpen(true);
                    }}
                    totalAmountUSD={selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid}
                    totalAmountUZS={(selectedPurchaseForRepayment.totalInvoiceAmount - selectedPurchaseForRepayment.amountPaid) * (settings.defaultExchangeRate || 12900)}
                    exchangeRate={settings.defaultExchangeRate || 12900}
                    onConfirm={handleRepayDebt}
                />
            )}
        </div>
    );
};
