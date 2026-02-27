import React, { useState, useMemo, useCallback } from 'react';
import { Product, Purchase, PurchaseItem, PurchaseOverheads, Transaction, WorkflowOrder, OrderItem, ProductType, Unit, WarehouseType } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { DEFAULT_EXCHANGE_RATE } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { PaymentSplitModal, PaymentDistribution } from './Sales/PaymentSplitModal';
import { CancelWorkflowModal } from './CancelWorkflowModal';

import type { ProcurementProps, ProcurementTab, ProcurementType, PaymentMethod, PaymentCurrency, Totals, Balances } from './Procurement/types';
import { TopBar } from './Procurement/TopBar';
import { NewPurchaseView } from './Procurement/NewPurchaseView';
import { WorkflowTab } from './Procurement/WorkflowTab';
import { HistoryTab } from './Procurement/HistoryTab';
import { RepaymentModal } from './Procurement/RepaymentModal';
import { NewProductModal } from './Procurement/NewProductModal';
import { logger } from '../utils/logger';
import { getMissingItems } from '../utils/inventoryHelpers';

export const Procurement: React.FC<ProcurementProps> = ({ products, settings, purchases, onSavePurchases, transactions, workflowOrders, onSaveWorkflowOrders, onSaveProducts, onSaveTransactions, onUpdatePurchase, balances }) => {
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
    const togglePurchaseExpand = useCallback((id: string) => {
        setExpandedPurchaseIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

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

    const openCancelModal = useCallback((wf: WorkflowOrder) => {
        setWorkflowToCancel(wf);
        setIsCancelModalOpen(true);
    }, []);

    React.useEffect(() => {
        localStorage.setItem('procurement_active_tab', activeTab);
    }, [activeTab]);

    const isFullyInStock = (wf: WorkflowOrder) => getMissingItems(wf.items, products).length === 0;

    const workflowQueue = useMemo(() => {
        return workflowOrders
            .filter(o => o.status === 'sent_to_procurement')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [workflowOrders]);

    const createDraftPurchaseFromWorkflow = (wf: WorkflowOrder) => {
        const missing = getMissingItems(wf.items, products);
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
            manufacturer: newProductData.manufacturer || undefined,
            origin: newProductData.origin || 'local'
        };

        const updated = [...products, product];
        // CRITICAL: Save to Sheets FIRST, then update state
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
            dimensions: product.dimensions, // Добавляем размер
            quantity: inputQty,
            unit: product.unit,
            invoicePrice: inputPrice,
            invoicePriceWithoutVat: inputPrice / (1 + (settings.vatRate || 12) / 100),
            vatAmount: inputPrice - (inputPrice / (1 + (settings.vatRate || 12) / 100)),
            landedCost: inputPrice, // Will be updated dynamically for Import, same as price for Local
            totalLineCost: inputQty * inputPrice / (settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE), // USD estimate
            totalLineCostUZS: inputQty * inputPrice
        };

        setCart([...cart, newItem]);

        // Reset inputs
        setSelectedProductId('');
        setInputQty(0);
        setInputPrice(0);
    };

    const removeItem = useCallback((productId: string) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
    }, []);

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
        const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;
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
            // IAS 2.10: Cost of purchase includes import duties, non-recoverable taxes,
            // transport, handling, and other costs directly attributable to acquisition.
            // importVat is a non-recoverable import tax that should be included in cost.
            totalOverheads = overheads.logistics + overheads.customsDuty + overheads.importVat + overheads.other;
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

        const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;

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

        const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;
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
            if (onSaveTransactions) await onSaveTransactions(updatedTransactions);
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
        // Use amountPaidUSD if available (for new records), otherwise assume amountPaid is USD (legacy) or convert?
        // Actually since we are in a transition, reliance on amountPaidUSD for USD calculations is safer if it exists.
        // Smart Legacy Check: if amountPaidUSD is missing but amountPaid exists and it's a legacy item
        // (we assume legacy items generally don't have totalInvoiceAmountUZS set yet)
        const isLegacy = purchase.totalInvoiceAmountUZS === undefined || purchase.totalInvoiceAmountUZS === 0;
        let paidUSD = purchase.amountPaidUSD;

        if (isLegacy && (paidUSD === undefined || paidUSD === null)) {
            paidUSD = purchase.amountPaid || 0;
        } else {
            paidUSD = paidUSD ?? 0;
        }
        // If amountPaidUSD is 0 but amountPaid is > 0, we might be in a state where only UZS was recorded?
        // But let's stick to the main bug: new usage has amountPaid as UZS.

        setRepaymentAmount(Math.max(0, purchase.totalInvoiceAmount - paidUSD));
        setRepaymentMethod('cash');
        setRepaymentCurrency('USD');
        setIsRepayModalOpen(true);
    };

    const handleRepayDebt = (distribution?: PaymentDistribution) => {
        if (!selectedPurchaseForRepayment) return;

        const rate = settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;
        const isLegacy = selectedPurchaseForRepayment.totalInvoiceAmountUZS === undefined || selectedPurchaseForRepayment.totalInvoiceAmountUZS === 0;
        let prevPaidUSD = selectedPurchaseForRepayment.amountPaidUSD;
        if (isLegacy && (prevPaidUSD === undefined || prevPaidUSD === null)) {
            prevPaidUSD = selectedPurchaseForRepayment.amountPaid || 0;
        } else {
            prevPaidUSD = prevPaidUSD ?? 0;
        }

        const remainingDebt = selectedPurchaseForRepayment.totalInvoiceAmount - prevPaidUSD;
        const remainingDebtUZS = remainingDebt * rate;

        let amountUSD: number = 0;
        let amountUZS: number = 0;
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

            // Validate inputs
            if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
                toast.warning('Введите корректную сумму оплаты');
                return;
            }

            // Calculate USD/UZS based on currency (assign to outer variables)

            if (repaymentCurrency === 'UZS') {
                amountUZS = repaymentAmount;
                const safeRate = (rate && rate > 0) ? rate : DEFAULT_EXCHANGE_RATE;
                amountUSD = repaymentAmount / safeRate;
            } else {
                amountUSD = repaymentAmount;
                const safeRate = (rate && rate > 0) ? rate : DEFAULT_EXCHANGE_RATE;
                amountUZS = repaymentAmount * safeRate;
            }

            // Check for NaN result
            if (!Number.isFinite(amountUSD) || !Number.isFinite(amountUZS)) {
                toast.error('Ошибка в расчетах курса. Проверьте настройки валюты.');
                return;
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

        // Save Transactions via Firebase
        if (newTransactions.length > 0) {
            const updatedTransactions = [...transactions, ...newTransactions];
            if (onSaveTransactions) {
                onSaveTransactions(updatedTransactions);
            }
        }

        // Update Purchase (Always in USD)
        const updatedPurchases = purchases.map(p => {
            if (p.id === selectedPurchaseForRepayment.id) {
                // Determine clean values to add
                const addedUSD = Number.isFinite(amountUSD) ? amountUSD : 0;
                const addedUZS = Number.isFinite(amountUZS) ? amountUZS : 0;

                // Smart Legacy Handling:
                // 1. New Schema: totalInvoiceAmountUZS exists -> amountPaid is UZS, amountPaidUSD is USD
                // 2. Legacy Schema: totalInvoiceAmountUZS missing -> amountPaid is USD
                const isLegacy = p.totalInvoiceAmountUZS === undefined || p.totalInvoiceAmountUZS === 0;

                let currentPaidUSD = p.amountPaidUSD;
                let currentPaidUZS = p.amountPaid;

                if (isLegacy) {
                    // Legacy: amountPaid holds USD value
                    currentPaidUSD = currentPaidUSD ?? p.amountPaid ?? 0;
                    // Recalculate UZS equivalent for consistency (using current rate or purchase rate)
                    const pRate = p.exchangeRate || DEFAULT_EXCHANGE_RATE;
                    currentPaidUZS = (currentPaidUSD * pRate);
                } else {
                    // New: just ensure safe numbers
                    currentPaidUSD = currentPaidUSD ?? 0;
                    currentPaidUZS = currentPaidUZS ?? 0;
                }

                const newAmountPaidUZS = currentPaidUZS + addedUZS;
                const newAmountPaidUSD = currentPaidUSD + addedUSD;

                // Snap to Paid Logic:
                // If remaining debt is negligible (< 0.1 USD), mark as fully paid.
                const isPaid = newAmountPaidUSD >= p.totalInvoiceAmount - 0.1;

                const updatedPurchase = {
                    ...p,
                    amountPaid: newAmountPaidUZS, // UZS
                    amountPaidUSD: newAmountPaidUSD, // USD
                    paymentStatus: isPaid ? 'paid' : 'partial'
                } as Purchase;

                // Direct update to Firebase
                if (onUpdatePurchase) {
                    onUpdatePurchase(p.id, {
                        amountPaid: newAmountPaidUZS,
                        amountPaidUSD: newAmountPaidUSD,
                        paymentStatus: isPaid ? 'paid' as const : 'partial' as const
                    }).catch(err => logger.error('Procurement', 'Failed to update purchase directly', err));
                }

                return updatedPurchase;
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
            {selectedPurchaseForRepayment && (
                <RepaymentModal
                    isOpen={isRepayModalOpen}
                    purchase={selectedPurchaseForRepayment}
                    repaymentAmount={repaymentAmount}
                    setRepaymentAmount={setRepaymentAmount}
                    repaymentMethod={repaymentMethod}
                    setRepaymentMethod={setRepaymentMethod}
                    repaymentCurrency={repaymentCurrency}
                    setRepaymentCurrency={setRepaymentCurrency}
                    balances={balances}
                    settings={settings}
                    t={t}
                    onClose={() => setIsRepayModalOpen(false)}
                    onConfirm={() => handleRepayDebt()}
                    onOpenMixed={() => { setIsRepayModalOpen(false); setIsRepaymentSplitModalOpen(true); }}
                />
            )}

            {/* New Product Modal */}
            <NewProductModal
                isOpen={isNewProductModalOpen}
                productData={newProductData}
                setProductData={setNewProductData}
                settings={settings}
                t={t}
                onClose={() => setIsNewProductModalOpen(false)}
                onSave={handleCreateNewProduct}
            />
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
                <CancelWorkflowModal
                    order={workflowToCancel}
                    workflowOrders={workflowOrders}
                    cancelledBy="Закуп"
                    onSaveWorkflowOrders={onSaveWorkflowOrders}
                    onClose={() => { setIsCancelModalOpen(false); setWorkflowToCancel(null); }}
                />
            )}

            {/* Payment Split Modal for Repayment */}
            {selectedPurchaseForRepayment && (
                <PaymentSplitModal
                    isOpen={isRepaymentSplitModalOpen}
                    onClose={() => {
                        setIsRepaymentSplitModalOpen(false);
                        setIsRepayModalOpen(true);
                    }}
                    totalAmountUSD={selectedPurchaseForRepayment.totalInvoiceAmount - (selectedPurchaseForRepayment.amountPaidUSD ?? 0)}
                    totalAmountUZS={(selectedPurchaseForRepayment.totalInvoiceAmount - (selectedPurchaseForRepayment.amountPaidUSD ?? 0)) * (settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE)}
                    exchangeRate={settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE}
                    onConfirm={handleRepayDebt}
                />
            )}
        </div>
    );
};
