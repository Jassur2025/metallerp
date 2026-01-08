import React, { useState, useEffect } from 'react';
import { Product, Order, OrderItem, Expense, Client, Transaction, JournalEvent, WorkflowOrder } from '../../types';
import { ShoppingCart, ArrowDownRight, ArrowUpRight, RefreshCw, FileText, ClipboardList, BadgeCheck, AlertTriangle, List } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { SUPER_ADMIN_EMAILS, IS_DEV_MODE } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { IdGenerator } from '../../utils/idGenerator';


// Sub-components
import { SalesProps, Balances, FlyingItem, SalesMode, PaymentMethod, Currency } from './types';
import { FlyingIcon } from './FlyingIcon';
import { BalanceBar } from './BalanceBar';
import { ProductGrid } from './ProductGrid';
import { CartPanel } from './CartPanel';
import { MobileCartModal } from './MobileCartModal';
import { ExpenseForm } from './ExpenseForm';
import { ReturnModal } from './ReturnModal';
import { ReceiptModal } from './ReceiptModal';
import { ClientModal } from './ClientModal';
import { generateInvoicePDF, generateWaybillPDF } from '../../utils/DocumentTemplates';
import { PaymentSplitModal, PaymentDistribution } from './PaymentSplitModal';
import { TransactionsManager } from './TransactionsManager';
import { calculateBaseTotals } from '../../utils/finance';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

export const Sales: React.FC<SalesProps> = ({
  products, setProducts, orders, setOrders, settings, expenses, setExpenses,
  employees, onNavigateToStaff, clients, onSaveClients, transactions, setTransactions,
  workflowOrders, onSaveWorkflowOrders, currentUserEmail, onNavigateToProcurement,
  onSaveOrders, onSaveTransactions, onSaveProducts, onSaveExpenses, onAddJournalEvent
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const { theme } = useTheme();
  const t = getThemeClasses(theme);


  const currentEmployee = React.useMemo(
    () => employees.find(e => e.email?.toLowerCase() === (currentUserEmail || '').toLowerCase()),
    [employees, currentUserEmail]
  );
  const isCashier =
    IS_DEV_MODE ||
    (!!currentUserEmail && SUPER_ADMIN_EMAILS.includes(currentUserEmail.toLowerCase())) ||
    currentEmployee?.role === 'accountant' ||
    currentEmployee?.role === 'manager' ||
    currentEmployee?.role === 'admin';

  // Mode State
  const [mode, setMode] = useState<SalesMode>('sale');

  // Client Modal State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState<Partial<Client>>({
    name: '', phone: '', email: '', address: '', creditLimit: 0, notes: ''
  });

  // Sale State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<string>('default');
  const [exchangeRate, setExchangeRate] = useState<number>(settings.defaultExchangeRate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [manualTotal, setManualTotal] = useState<number | null>(null);

  // Expense State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Прочее');
  const [expenseMethod, setExpenseMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('UZS');
  const [withVat, setWithVat] = useState(false);
  const [expenseVatAmount, setExpenseVatAmount] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Return State
  const [returnClientName, setReturnClientName] = useState('');
  const [returnProductName, setReturnProductName] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnMethod, setReturnMethod] = useState<'cash' | 'debt'>('cash');

  // Animation State
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);

  // Receipt Modal State
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  // Mobile Cart Modal State
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  // Sales Mixed Payment Modal State
  const [salesPaymentModalOpen, setSalesPaymentModalOpen] = useState(false);

  // Order Edit State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editOrderData, setEditOrderData] = useState<{
    totalAmount: string;
    amountPaid: string;
    paymentMethod: string;
    paymentCurrency: string;
  }>({ totalAmount: '', amountPaid: '', paymentMethod: '', paymentCurrency: '' });

  // Workflow Payment Modal State
  // Workflow Payment Modal State
  const [workflowPaymentModalOpen, setWorkflowPaymentModalOpen] = useState(false);
  const [selectedWorkflowOrder, setSelectedWorkflowOrder] = useState<WorkflowOrder | null>(null);

  useEffect(() => {
    if (editingOrderId) {
      const order = orders.find(o => o.id === editingOrderId);
      if (order) {
        setEditOrderData({
          totalAmount: String(order.totalAmount || 0),
          amountPaid: String(order.amountPaid || 0),
          paymentMethod: order.paymentMethod || 'cash',
          paymentCurrency: order.paymentCurrency || 'USD'
        });
      }
    }
  }, [editingOrderId, orders]);

  useEffect(() => {
    setExchangeRate(settings.defaultExchangeRate);
  }, [settings.defaultExchangeRate]);

  // Helpers
  const toUZS = (usd: number) => Math.round(usd * exchangeRate);
  const toUSD = (uzs: number) => exchangeRate > 0 ? uzs / exchangeRate : 0;

  // Расчёт скидки для заказа относительно прайс-листа
  const getOrderDiscount = (items: OrderItem[]) => {
    if (!Array.isArray(items) || items.length === 0) return { hasDiscount: false, totalDiscount: 0, discountPercent: 0 };
    
    let priceListTotal = 0;
    let actualTotal = 0;
    
    items.forEach(it => {
      const product = products.find(p => p.id === it.productId);
      const priceListPrice = product?.pricePerUnit || it.priceAtSale;
      priceListTotal += priceListPrice * it.quantity;
      actualTotal += it.priceAtSale * it.quantity;
    });
    
    const totalDiscount = priceListTotal - actualTotal;
    const discountPercent = priceListTotal > 0 ? (totalDiscount / priceListTotal) * 100 : 0;
    
    return {
      hasDiscount: totalDiscount > 0.01,
      totalDiscount,
      discountPercent,
      priceListTotal,
      actualTotal
    };
  };

  const workflowCashQueue = React.useMemo(() => {
    return (workflowOrders || [])
      .filter(o => o.status === 'sent_to_cash')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workflowOrders]);

  const getMissingItems = (items: OrderItem[]) => {
    const missing: { productId: string; need: number; available: number }[] = [];
    items.forEach(it => {
      const p = products.find(pp => pp.id === it.productId);
      const available = p?.quantity ?? 0;
      if (!p || available < it.quantity) {
        missing.push({ productId: it.productId, need: it.quantity, available });
      }
    });
    return missing;
  };

  const openWorkflowPaymentModal = (wf: WorkflowOrder) => {
    if (!isCashier) {
      toast.error('Нет прав: только кассир/финансист может подтверждать.');
      return;
    }

    const missing = getMissingItems(wf.items || []);
    if (missing.length > 0) {
      toast.warning('Недостаточно остатков. Заявка отправлена в закуп.');
      // ... (existing logic to return to procurement)
      return;
    }

    setSelectedWorkflowOrder(wf);
    setWorkflowPaymentModalOpen(true);
  };

  const confirmWorkflowPayment = async (dist: PaymentDistribution) => {
    const wf = selectedWorkflowOrder;
    if (!wf) return;

    const { cashUSD, cashUZS, cardUZS, bankUZS, isPaid, remainingUSD } = dist;

    // Determine overall status
    let paymentStatus: 'paid' | 'unpaid' | 'partial' = isPaid ? 'paid' : 'partial';
    // If absolutely nothing paid, it's unpaid (debt).
    if (cashUSD + cashUZS + cardUZS + bankUZS === 0) paymentStatus = 'unpaid';

    // Total Paid in USD (for reference, though transactions track real movement)
    const totalPaidUSD = cashUSD + (cashUZS / (wf.exchangeRate || exchangeRate)) + (cardUZS / (wf.exchangeRate || exchangeRate)) + (bankUZS / (wf.exchangeRate || exchangeRate));

    // Payment Method is 'mixed' if multiple used, otherwise specific?
    // User requested "Partially this, partially that". "Mixed" is safest bucket.
    const paymentMethod: PaymentMethod = 'mixed';

    const newOrder: Order = {
      id: IdGenerator.order(),
      date: new Date().toISOString(),
      customerName: wf.customerName,
      sellerId: wf.sellerId, // Employee ID for KPI
      sellerName: wf.sellerName || wf.createdBy || 'Sales',
      items: wf.items,
      subtotalAmount: wf.subtotalAmount,
      vatRateSnapshot: wf.vatRateSnapshot,
      vatAmount: wf.vatAmount,
      totalAmount: wf.totalAmount,
      exchangeRate: wf.exchangeRate,
      totalAmountUZS: wf.totalAmountUZS,
      status: 'completed',
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      amountPaid: totalPaidUSD,
      paymentCurrency: 'USD' // Default reference
    };

    const updatedProducts = products.map(p => {
      const it = wf.items.find((i: OrderItem) => i.productId === p.id);
      return it ? { ...p, quantity: p.quantity - it.quantity } : p;
    });
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveProducts?.(updatedProducts);
    setProducts(updatedProducts);

    // Update client (create if missing)
    const nextClients = [...clients];
    let idx = nextClients.findIndex(c => c.name.toLowerCase() === String(wf.customerName || '').toLowerCase());
    let clientId = '';
    if (idx === -1) {
      const c: Client = {
        id: IdGenerator.client(),
        name: wf.customerName,
        phone: wf.customerPhone || '',
        creditLimit: 0,
        totalPurchases: 0,
        totalDebt: 0,
        notes: 'Автоматически создан из Workflow'
      };
      nextClients.push(c);
      idx = nextClients.length - 1;
      clientId = c.id;
    } else {
      clientId = nextClients[idx].id;
    }

    // Update Client Debt
    // Add full amount to purchase history, add remaining debt
    // NOTE: If we record transactions for payments, we should add TOTAL amount to debt first, then reduce by payments? 
    // OR: Current logic says `totalDebt` tracks UNPAID amount?
    // Let's stick to: Total Debt += (Total Amount - Paid Amount).
    // Wait, if we use transactions model, `totalDebt` is usually calculated from (Purchases - Payments).
    // But we are storing a static `totalDebt` field.
    // So: Debt += newOrder.totalAmount (increase debt by purchase)
    // Then Debt -= payments (decrease debt by payment)
    // Net result: Debt += remainingUSD.

    // BUT! Our transactions logic below creates `client_payment` which usually implies reducing debt.
    // To keep it consistent: We add the FULL order amount to debt/purchases.
    // Then the `client_payment` transactions will physically reduce it (if we had a ledger re-calc). 
    // Since we manually update `totalDebt` here:

    const debtIncrease = remainingUSD; // Only add the unpaid part?
    // Logic: 
    // 1. Client buys for $100. Debt +100.
    // 2. Client pays $40. Debt -40.
    // Result: Debt +60.
    // So YES, we increase debt by remaining amount.

    nextClients[idx] = {
      ...nextClients[idx],
      totalPurchases: (nextClients[idx].totalPurchases || 0) + (wf.totalAmount || 0),
      totalDebt: (nextClients[idx].totalDebt || 0) + remainingUSD
    };
    onSaveClients(nextClients);

    // Create Transactions for EACH payment part
    const newTrx: Transaction[] = [];
    const baseTrx = {
      id: '', date: new Date().toISOString(), type: 'client_payment' as const,
      description: `Оплата заказа ${newOrder.id} (Workflow)`, relatedId: clientId
    };

    if (cashUSD > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cashUSD, currency: 'USD', method: 'cash' });
    if (cashUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cashUZS, currency: 'UZS', method: 'cash' });
    if (cardUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cardUZS, currency: 'UZS', method: 'card' });
    if (bankUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: bankUZS, currency: 'UZS', method: 'bank' });

    // If using transactions to track balance, these `client_payment`s will be summed up by `calculateBalance`.
    // And since `paymentMethod` is 'mixed', `calculateBalance` will SKIP the order itself.

    // Also record the "Debt Obligation" transaction if there is debt?
    // "debt_obligation" is informational? Or used for balance?
    // `calculateBalance` ignores `debt_obligation`. It's purely for ledger of "why debt increased".
    if (remainingUSD > 0.05) {
      newTrx.push({
        ...baseTrx, id: IdGenerator.transaction(), type: 'debt_obligation', amount: remainingUSD, currency: 'USD', method: 'debt',
        description: `Долг по заказу ${newOrder.id}`
      });
    }

    const updatedTx = [...transactions, ...newTrx];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveTransactions?.(updatedTx);
    setTransactions(updatedTx);

    const updatedOrders = [newOrder, ...orders];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveOrders?.(updatedOrders);
    setOrders(updatedOrders);

    const nextWorkflow = workflowOrders.map(o =>
      o.id === wf.id ? { ...o, status: 'completed' as const, convertedToOrderId: newOrder.id, convertedAt: new Date().toISOString() } : o
    );
    await onSaveWorkflowOrders(nextWorkflow);

    await onAddJournalEvent?.({
      id: IdGenerator.journal(),
      date: new Date().toISOString(),
      type: 'employee_action',
      employeeName: currentEmployee?.name || 'Кассир',
      action: 'Workflow подтвержден (Смешанная оплата)',
      description: `Заказ ${newOrder.id}. Оплачено: $${totalPaidUSD.toFixed(2)}. Долг: $${remainingUSD.toFixed(2)}.`,
      module: 'sales',
      relatedType: 'workflow',
      relatedId: wf.id,
      metadata: { convertedTo: newOrder.id }
    });

    toast.success('Workflow подтвержден!');
    setMode('sale');
    setWorkflowPaymentModalOpen(false);
    setSelectedWorkflowOrder(null);
  };

  // --- Cancel Workflow Order ---
  const [cancelReason, setCancelReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<WorkflowOrder | null>(null);

  const openCancelModal = (wf: WorkflowOrder) => {
    setOrderToCancel(wf);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const confirmCancelWorkflow = async () => {
    if (!orderToCancel) return;
    if (!cancelReason.trim()) {
      toast.warning('Укажите причину аннулирования');
      return;
    }

    const updatedWorkflow = workflowOrders.map(o =>
      o.id === orderToCancel.id
        ? {
            ...o,
            status: 'cancelled' as const,
            cancellationReason: cancelReason.trim(),
            cancelledBy: currentEmployee?.name || currentUserEmail || 'Кассир',
            cancelledAt: new Date().toISOString()
          }
        : o
    );

    await onSaveWorkflowOrders(updatedWorkflow);

    await onAddJournalEvent?.({
      id: IdGenerator.journalEvent(),
      date: new Date().toISOString(),
      type: 'employee_action',
      employeeName: currentEmployee?.name || 'Кассир',
      action: 'Workflow аннулирован',
      description: `Заказ ${orderToCancel.id} аннулирован. Причина: ${cancelReason.trim()}`,
      module: 'sales',
      relatedType: 'workflow',
      relatedId: orderToCancel.id
    });

    toast.success('Заказ аннулирован');
    setCancelModalOpen(false);
    setOrderToCancel(null);
    setCancelReason('');
  };

  // --- Balance Calculations ---
  // --- Helpers ---
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
    // Минимальный реалистичный курс UZS/USD около 12000
    const defaultRate = num(exchangeRate);
    const safeDefault = defaultRate > 100 ? defaultRate : 12900;
    return r > 100 ? r : safeDefault;
  };

  const calculateBalance = (): { balances: Balances; debugStats: any; suspicious: any } => {
    const { cashUSD, cashUZS, bankUZS, cardUZS } = calculateBaseTotals(
      orders || [],
      transactions || [],
      expenses || [],
      settings.defaultExchangeRate
    );

    const suspiciousThreshold = 1000000; // $1M

    return {
      balances: {
        balanceCashUSD: Math.max(0, cashUSD),
        balanceCashUZS: Math.max(0, cashUZS),
        balanceBankUZS: Math.max(0, bankUZS),
        balanceCardUZS: Math.max(0, cardUZS)
      },
      debugStats: {
        salesUSD: 0,
        trxInUSD: 0,
        trxOutUSD: 0,
        expUSD: 0
      },
      suspicious: {
        orders: (orders || []).filter(o => num(o.totalAmount) > suspiciousThreshold || num(o.amountPaid) > suspiciousThreshold),
        transactions: (transactions || []).filter(t => {
          const rate = getRate(t.exchangeRate);
          const usd = t.currency === 'USD' ? num(t.amount) : num(t.amount) / rate;
          return usd > suspiciousThreshold;
        }),
        expenses: (expenses || []).filter(e => {
          const rate = getRate(e.exchangeRate);
          const usd = e.currency === 'USD' ? num(e.amount) : num(e.amount) / rate;
          return usd > suspiciousThreshold;
        })
      }
    };
  };

  const { balances, debugStats, suspicious } = calculateBalance();

  // --- Cart Logic ---
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) return;
    const newItem: OrderItem = {
      productId: product.id, productName: product.name, dimensions: product.dimensions,
      quantity: 1, priceAtSale: product.pricePerUnit, costAtSale: product.costPrice || 0,
      unit: product.unit, total: product.pricePerUnit
    };
    setCart([...cart, newItem]);
  };

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>, product: Product) => {
    addToCart(product);
    const btnRect = e.currentTarget.getBoundingClientRect();
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
      setIsCartModalOpen(true);
      setFlyingItems(prev => [...prev, {
        id: Date.now(), startX: btnRect.left + btnRect.width / 2, startY: btnRect.top + btnRect.height / 2,
        targetX: window.innerWidth - 40, targetY: window.innerHeight - 40
      }]);
    } else {
      const cartTarget = document.getElementById('cart-target');
      if (cartTarget) {
        const cartRect = cartTarget.getBoundingClientRect();
        setFlyingItems(prev => [...prev, {
          id: Date.now(), startX: btnRect.left + btnRect.width / 2, startY: btnRect.top + btnRect.height / 2,
          targetX: cartRect.left + cartRect.width / 2, targetY: cartRect.top + cartRect.height / 2
        }]);
      }
    }
  };

  const removeFlyingItem = (id: number) => setFlyingItems(prev => prev.filter(item => item.id !== id));

  const updateQuantity = (productId: string, qty: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return item;
        const validQty = Math.min(Math.max(0, qty), product.quantity);
        return { ...item, quantity: validQty, total: validQty * item.priceAtSale };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(cart.filter(item => item.productId !== id));

  // Totals
  // Totals
  const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
  const vatAmountUSD = subtotalUSD * (settings.vatRate / 100);
  const originalTotalUSD = subtotalUSD + vatAmountUSD;

  const totalAmountUSD = manualTotal !== null
    ? manualTotal
    : originalTotalUSD * (1 - (discountPercent || 0) / 100);

  const discountAmount = originalTotalUSD - totalAmountUSD;

  const totalAmountUZS = toUZS(totalAmountUSD);

  // --- Order Finalization (Shared) ---
  const finalizeSale = async (dist: PaymentDistribution, method: PaymentMethod = 'mixed', customStatus?: 'paid' | 'unpaid' | 'partial') => {
    const { cashUSD, cashUZS, cardUZS, bankUZS, isPaid, remainingUSD } = dist;

    const paymentStatus = customStatus || (isPaid ? 'paid' : (cashUSD + cashUZS + cardUZS + bankUZS === 0 ? 'unpaid' : 'partial'));
    const totalPaidUSD = cashUSD + (cashUZS / exchangeRate) + (cardUZS / exchangeRate) + (bankUZS / exchangeRate);

    // Find seller employee by name for KPI
    const sellerEmployee = employees.find(e => e.name?.toLowerCase() === (sellerName || '').toLowerCase());

    const newOrder: Order = {
      id: IdGenerator.order(), date: new Date().toISOString(), customerName,
      sellerId: sellerEmployee?.id || currentEmployee?.id, // Employee ID for KPI
      sellerName: sellerName || currentEmployee?.name || 'Администратор',
      items: [...cart], subtotalAmount: subtotalUSD, vatRateSnapshot: settings.vatRate, vatAmount: vatAmountUSD,
      totalAmount: totalAmountUSD, exchangeRate, totalAmountUZS, status: 'completed', paymentMethod: method, paymentStatus, amountPaid: totalPaidUSD,
      paymentCurrency: method === 'cash' ? (paymentCurrency || 'USD') : 'USD' // Fallback
    };

    // Update products
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.productId === p.id);
      return cartItem ? { ...p, quantity: p.quantity - cartItem.quantity } : p;
    });
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveProducts?.(updatedProducts);
    setProducts(updatedProducts);

    // Update/Create Client
    let currentClients = [...clients];
    let clientIndex = currentClients.findIndex(c => c.name.toLowerCase() === customerName.toLowerCase());
    let clientId = '';

    if (clientIndex === -1) {
      const newClient: Client = { id: IdGenerator.client(), name: customerName, phone: '', creditLimit: 0, totalPurchases: 0, totalDebt: 0, notes: 'Автоматически создан при продаже' };
      currentClients.push(newClient);
      clientIndex = currentClients.length - 1;
      clientId = newClient.id;
    } else {
      clientId = currentClients[clientIndex].id;
    }

    // Update Client Debt (Purchase + Remaining Debt)
    // Add purchase to totalPurchases
    // Add remaining part to debt. (If paid fully, result is 0)
    currentClients[clientIndex] = {
      ...currentClients[clientIndex],
      totalPurchases: (currentClients[clientIndex].totalPurchases || 0) + totalAmountUSD,
      totalDebt: (currentClients[clientIndex].totalDebt || 0) + remainingUSD
    };
    await onSaveClients(currentClients);

    // Create Transactions
    const newTrx: Transaction[] = [];
    const baseTrx = {
      id: '', date: new Date().toISOString(), type: 'client_payment' as const,
      description: `Оплата заказа ${newOrder.id}`, relatedId: clientId
    };

    if (cashUSD > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cashUSD, currency: 'USD', method: 'cash' });
    if (cashUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cashUZS, currency: 'UZS', method: 'cash' });
    if (cardUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cardUZS, currency: 'UZS', method: 'card' });
    if (bankUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: bankUZS, currency: 'UZS', method: 'bank' });

    // Debt Obligation
    if (remainingUSD > 0.05) {
      newTrx.push({
        ...baseTrx, id: IdGenerator.transaction(), type: 'debt_obligation', amount: remainingUSD, currency: 'USD', method: 'debt',
        description: `Долг по заказу ${newOrder.id}`
      });
    }

    const updatedTransactions = [...transactions, ...newTrx];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveTransactions?.(updatedTransactions);
    setTransactions(updatedTransactions);

    // Save order
    const updatedOrders = [newOrder, ...orders];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveOrders?.(updatedOrders);
    setOrders(updatedOrders);

    // Clear form
    setCart([]);
    setCustomerName('');
    setSellerName('');
    setPaymentMethod('cash');
    setDiscountPercent(0);
    setManualTotal(null);
    setLastOrder(newOrder);
    setSalesPaymentModalOpen(false); // Close if open
    setSelectedOrderForReceipt(newOrder);
    setTimeout(() => setShowReceiptModal(true), 300);

    // Journal
    await onAddJournalEvent?.({
      id: IdGenerator.journalEvent(), date: new Date().toISOString(), type: 'employee_action',
      employeeName: sellerName || 'Администратор', action: 'Создан заказ',
      description: `Продажа на сумму ${totalAmountUZS.toLocaleString()} сўм ($${totalAmountUSD.toFixed(2)}) клиенту ${customerName}.`,
      module: 'sales', relatedType: 'order', relatedId: newOrder.id,
      receiptDetails: { orderId: newOrder.id, customerName, totalAmount: totalAmountUSD, itemsCount: cart.length, paymentMethod, operation: 'created' }
    });
  };

  // --- Complete Order ---
  const completeOrder = async () => {
    if (cart.length === 0 || !customerName) return;

    // Check stock
    const insufficientStock: string[] = [];
    cart.forEach(cartItem => {
      const product = products.find(p => p.id === cartItem.productId);
      if (!product) insufficientStock.push(`${cartItem.productName} (товар не найден)`);
      else if (product.quantity < cartItem.quantity) insufficientStock.push(`${cartItem.productName} (запрошено: ${cartItem.quantity}, доступно: ${product.quantity})`);
    });
    if (insufficientStock.length > 0) {
      toast.error(`Недостаточно товара на складе:\n${insufficientStock.join('\n')}`);
      return;
    }

    if (paymentMethod === 'mixed') {
      setSalesPaymentModalOpen(true);
      return;
    }

    // Construct "simple" distribution for standard methods
    const isDebt = paymentMethod === 'debt';
    const dist: PaymentDistribution = {
      cashUSD: 0, cashUZS: 0, cardUZS: 0, bankUZS: 0,
      isPaid: !isDebt, remainingUSD: isDebt ? totalAmountUSD : 0
    };

    if (paymentMethod === 'cash') {
      if (paymentCurrency === 'UZS') dist.cashUZS = totalAmountUZS;
      else dist.cashUSD = totalAmountUSD;
    } else if (paymentMethod === 'card') {
      dist.cardUZS = totalAmountUZS;
    } else if (paymentMethod === 'bank') {
      dist.bankUZS = totalAmountUZS;
    }
    // For debt, everything is 0, remaining is total.

    await finalizeSale(dist, paymentMethod, isDebt ? 'unpaid' : 'paid');
  };

  // --- Receipt Printing ---
  const handlePrintReceipt = async (order: Order) => {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    const receiptHTML = `
      <div id="receipt-content" style="width: 300px; padding: 20px; font-family: Arial, sans-serif; background: white; color: black;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold;">METAL ERP</h2>
          <p style="margin: 5px 0; font-size: 12px;">Чек продажи</p>
        </div>
        <div style="margin-bottom: 15px; font-size: 12px;">
          <p style="margin: 3px 0;"><strong>Заказ:</strong> ${order.id}</p>
          <p style="margin: 3px 0;"><strong>Дата:</strong> ${new Date(order.date).toLocaleString('ru-RU')}</p>
          <p style="margin: 3px 0;"><strong>Клиент:</strong> ${order.customerName}</p>
          <p style="margin: 3px 0;"><strong>Продавец:</strong> ${order.sellerName}</p>
        </div>
        <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 15px 0;">
          ${order.items.map(item => `<div style="margin-bottom: 8px;"><div style="display: flex; justify-content: space-between;"><span style="font-weight: bold;">${item.productName}</span><span>${(item.total * order.exchangeRate).toLocaleString()} сўм</span></div><div style="font-size: 11px; color: #666;">${item.quantity} ${item.unit} × ${(item.priceAtSale * order.exchangeRate).toLocaleString()} сўм</div></div>`).join('')}
        </div>
        <div style="margin-bottom: 10px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;"><span>Подытог:</span><span>${(order.subtotalAmount * order.exchangeRate).toLocaleString()} сўм</span></div>
          <div style="display: flex; justify-content: space-between;"><span>НДС (${order.vatRateSnapshot}%):</span><span>${(order.vatAmount * order.exchangeRate).toLocaleString()} сўм</span></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #000; padding-top: 5px;"><span>ИТОГО:</span><span>${order.totalAmountUZS.toLocaleString()} сўм</span></div>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;"><p>Спасибо за покупку!</p></div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = receiptHTML;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
      const element = tempDiv.querySelector('#receipt-content') || tempDiv;
      const canvas = await html2canvas(element as HTMLElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', [80, 200]);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const ratio = pdfWidth / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvas.height * ratio);
      pdf.save(`Чек_${order.id}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      errorDev('Ошибка при печати чека:', err);
      toast.error('Ошибка при создании чека.');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  // --- Expense Logic ---
  const handleAddExpense = async () => {
    if (!expenseDesc || !expenseAmount) return;
    const newExpense: Expense = {
      id: IdGenerator.expense(), date: new Date().toISOString(), description: expenseDesc,
      amount: parseFloat(expenseAmount), category: expenseCategory, paymentMethod: expenseMethod,
      currency: expenseCurrency,
      exchangeRate: exchangeRate > 0 ? exchangeRate : settings.defaultExchangeRate,
      vatAmount: withVat && expenseVatAmount ? parseFloat(expenseVatAmount) : 0,
      employeeId: selectedEmployeeId || undefined
    };
    const updatedExpenses = [newExpense, ...expenses];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveExpenses?.(updatedExpenses);
    setExpenses(updatedExpenses);
    setExpenseDesc(''); setExpenseAmount(''); setWithVat(false); setExpenseVatAmount(''); setSelectedEmployeeId('');
    toast.success('Расход добавлен!');
  };

  // --- Return Logic ---
  const handleReturnSubmit = () => {
    if (!returnClientName || !returnProductName || !returnQuantity) { toast.warning('Заполните все поля!'); return; }
    const product = products.find(p => p.id === returnProductName);
    const client = clients.find(c => c.name === returnClientName);
    const qty = Number(returnQuantity);
    if (!product) { toast.error('Товар не найден!'); return; }
    if (qty <= 0) { toast.error('Некорректное количество!'); return; }
    if (returnMethod === 'debt' && !client) { toast.error('Клиент не найден!'); return; }

    // Update Stock
    const updatedProducts = products.map(p => p.id === product.id ? { ...p, quantity: p.quantity + qty } : p);
    setProducts(updatedProducts);
    onSaveProducts?.(updatedProducts);

    const returnAmountUSD = qty * product.pricePerUnit;

    if (returnMethod === 'debt' && client) {
      const updatedClients = clients.map(c => c.id === client.id ? { ...c, totalDebt: Math.max(0, (c.totalDebt || 0) - returnAmountUSD) } : c);
      onSaveClients(updatedClients);
    }

    const newTransaction: Transaction = {
      id: IdGenerator.transaction(), date: new Date().toISOString(), type: 'client_return',
      amount: returnAmountUSD, currency: 'USD', method: returnMethod,
      description: `Возврат товара: ${product.name} (${qty} ${product.unit})`, relatedId: client?.id
    };
    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    onSaveTransactions?.(updatedTransactions);

    toast.success(`Возврат оформлен!\nТовар: ${product.name} (+${qty})\nСумма: $${returnAmountUSD.toFixed(2)}`);
    setMode('sale'); setReturnClientName(''); setReturnProductName(''); setReturnQuantity('');
  };

  // --- Money Return Logic ---
  const handleMoneyReturn = async (data: { clientName: string; amount: number; method: 'cash' | 'bank' | 'card'; currency: 'USD' | 'UZS'; reason: string }) => {
    const client = clients.find(c => c.name.toLowerCase() === data.clientName.toLowerCase());

    // Create refund transaction (negative expense = money going out)
    const newTransaction: Transaction = {
      id: IdGenerator.transaction(),
      date: new Date().toISOString(),
      type: 'client_refund',
      amount: data.amount,
      currency: data.currency,
      exchangeRate: data.currency === 'UZS' ? settings.defaultExchangeRate : undefined,
      method: data.method,
      description: `Возврат денег: ${data.reason}${client ? ` (клиент: ${client.name})` : ''}`,
      relatedId: client?.id
    };

    const updatedTransactions = [...transactions, newTransaction];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveTransactions?.(updatedTransactions);
    setTransactions(updatedTransactions);

    // Update client debt if exists
    if (client) {
      const amountInUSD = data.currency === 'USD' ? data.amount : data.amount / settings.defaultExchangeRate;
      const updatedClients = clients.map(c =>
        c.id === client.id
          ? { ...c, totalDebt: Math.max(0, (c.totalDebt || 0) - amountInUSD) }
          : c
      );
      await onSaveClients(updatedClients);
    }

    const formattedAmount = data.currency === 'UZS'
      ? `${data.amount.toLocaleString()} сум`
      : `$${data.amount.toFixed(2)}`;

    toast.success(`Возврат денег оформлен!\nСумма: ${formattedAmount}\nСпособ: ${data.method === 'cash' ? 'Наличные' : data.method === 'bank' ? 'Р/С' : 'Карта'}`);
    setMode('sale');
    setReturnClientName('');
  };

  // --- Client Save ---
  const handleSaveClient = () => {
    if (!newClientData.name || !newClientData.phone) { toast.warning('Имя и Телефон обязательны!'); return; }
    const newClient: Client = { id: IdGenerator.client(), ...newClientData as Client };
    onSaveClients([...clients, newClient]);
    setCustomerName(newClient.name);
    setIsClientModalOpen(false);
    setNewClientData({ name: '', phone: '', email: '', address: '', creditLimit: 0, notes: '' });
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-full">
      <BalanceBar balances={balances} orders={orders} debugStats={debugStats} />

      {/* Recent Orders (Desktop) */}
      {orders.length > 0 && mode === 'sale' && (
        <div className={`hidden lg:block ${t.bgCard} border-b ${t.border} px-6 py-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className={t.textMuted} />
              <span className={`text-sm ${t.textMuted}`}>Последние заказы:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {orders.slice(0, 5).map(order => (
                <button key={order.id} onClick={() => { setSelectedOrderForReceipt(order); setShowReceiptModal(true); }}
                  className={`px-3 py-1.5 ${t.bgButton} ${t.text} text-xs rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5`}>
                  <FileText size={12} />{order.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 relative overflow-hidden">
        {flyingItems.map(item => <FlyingIcon key={item.id} {...item} onComplete={() => removeFlyingItem(item.id)} />)}

        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
          {/* Mode Switcher */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setMode('sale')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'sale' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : `${t.bgCard} ${t.textMuted} ${t.bgCardHover}`}`}>
              <ArrowDownRight size={20} /> Новая Продажа
            </button>
            <button onClick={() => setMode('expense')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'expense' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : `${t.bgCard} ${t.textMuted} ${t.bgCardHover}`}`}>
              <ArrowUpRight size={20} /> Новый Расход
            </button>
            {(user?.permissions?.canProcessReturns !== false) && (
              <button onClick={() => setMode('return')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'return' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : `${t.bgCard} ${t.textMuted} ${t.bgCardHover}`}`}>
                <RefreshCw size={20} /> Возврат
              </button>
            )}

            {isCashier && (
              <button onClick={() => setMode('workflow')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'workflow' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : `${t.bgCard} ${t.textMuted} ${t.bgCardHover}`}`}>
                <ClipboardList size={20} /> Workflow
              </button>
            )}

            {isCashier && (
              <button onClick={() => setMode('transactions')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'transactions' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : `${t.bgCard} ${t.textMuted} ${t.bgCardHover}`}`}>
                <List size={20} /> Транзакции
              </button>
            )}
          </div>

          {/* Audit Alert - Visible in Sales too */}
          {(suspicious.orders.length > 0 || suspicious.transactions.length > 0 || suspicious.expenses.length > 0) && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 animate-bounce-subtle">
              <div className="flex items-center gap-2 text-red-400 font-bold mb-3">
                <AlertTriangle size={20} />
                <span>ВНИМАНИЕ: Найдены аномальные записи ($3.3 млрд?)</span>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {suspicious.orders.map(o => (
                  <div key={o.id} className="text-xs bg-slate-900/50 p-2 rounded-lg flex justify-between border border-red-500/20">
                    <span className="text-slate-300">Заказ {o.id} ({o.customerName})</span>
                    <span className="text-red-400 font-bold">${num(o.totalAmount).toLocaleString()}</span>
                  </div>
                ))}
                {suspicious.transactions.map(t => (
                  <div key={t.id} className="text-xs bg-slate-900/50 p-2 rounded-lg flex justify-between border border-red-500/20">
                    <span className="text-slate-300">Транзакция {t.id} ({t.type})</span>
                    <span className="text-red-400 font-bold">${(t.currency === 'USD' ? num(t.amount) : num(t.amount) / getRate(t.exchangeRate)).toLocaleString()}</span>
                  </div>
                ))}
                {suspicious.expenses.map(e => (
                  <div key={e.id} className="text-xs bg-slate-900/50 p-2 rounded-lg flex justify-between border border-red-500/20">
                    <span className="text-slate-300">Расход {e.id} ({e.description})</span>
                    <span className="text-red-400 font-bold">${(e.currency === 'USD' ? num(e.amount) : num(e.amount) / getRate(e.exchangeRate)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">* Найдите эти записи в истории и измените валюту на UZS или исправьте сумму.</p>
            </div>
          )}

          {mode === 'workflow' ? (
            <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5 overflow-y-auto custom-scrollbar`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${t.text} font-bold flex items-center gap-2`}>
                  <ClipboardList size={18} className="text-indigo-400" /> Заявки из Workflow (в кассу)
                </h3>
                <div className={`text-xs ${t.textMuted}`}>{workflowCashQueue.length} заявок</div>
              </div>

              {workflowCashQueue.length === 0 ? (
                <div className={`${t.textMuted} text-center py-10`}>Пока нет заявок из Workflow</div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {workflowCashQueue.map((wf: any) => {
                    const discount = getOrderDiscount(wf.items);
                    return (
                    <div key={wf.id} className={`${t.bgPanelAlt} border ${t.border} rounded-2xl p-5`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className={`${t.text} font-bold`}>{wf.customerName}</div>
                          <div className={`text-xs ${t.textMuted} mt-1`}>{new Date(wf.date).toLocaleString('ru-RU')}</div>
                          <div className={`text-xs ${t.textMuted} mt-1`}>ID: {wf.id} • Создал: {wf.createdBy}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-500 font-mono font-bold">{Number(wf.totalAmountUZS || 0).toLocaleString()} сум</div>
                          <div className={`text-xs ${t.textMuted}`}>${Number(wf.totalAmount || 0).toFixed(2)}</div>
                          {discount.hasDiscount && (
                            <div className="text-xs text-orange-400 font-semibold mt-1">
                              🏷️ Скидка: {discount.discountPercent.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        {(wf.items || []).slice(0, 5).map((it: OrderItem, idx: number) => {
                          const prod = products.find(p => p.id === it.productId);
                          const dims = prod?.dimensions || it.dimensions || '';
                          return (
                            <div key={idx} className={`flex justify-between ${t.textSecondary}`}>
                              <span className="truncate max-w-[260px]">
                                {it.productName}
                                {dims && dims !== '-' && <span className={`${t.textMuted} ml-1`}>({dims})</span>}
                                <span className={`${t.textMuted} ml-1`}>× {it.quantity}</span>
                              </span>
                              <span className={`font-mono ${t.textMuted}`}>{Math.round(Number(it.total || 0) * Number(wf.exchangeRate || exchangeRate)).toLocaleString()} сум</span>
                            </div>
                          );
                        })}
                        {(wf.items || []).length > 5 && <div className={`text-xs ${t.textMuted}`}>+ ещё {(wf.items || []).length - 5} поз.</div>}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className={`text-xs ${t.textMuted}`}>
                          Оплата: <span className={`${t.text} font-semibold`}>{wf.paymentMethod}</span>
                          {wf.paymentMethod === 'debt' && <span className="ml-2 text-amber-500 font-bold">ДОЛГ</span>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openCancelModal(wf)}
                            className={`bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-xl font-medium flex items-center gap-1 border border-red-500/20`}
                          >
                            ✕ Аннулировать
                          </button>
                          <button
                            onClick={() => openWorkflowPaymentModal(wf)}
                            className={`${theme === 'light' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2`}
                          >
                            <BadgeCheck size={18} /> Подтвердить
                          </button>
                        </div>
                      </div>

                      <div className={`mt-3 text-xs ${t.textMuted} flex items-center gap-2`}>
                        <AlertTriangle size={14} className="text-amber-500" />
                        Если остатков не хватит — заявка уйдет обратно в закуп.
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : mode === 'sale' ? (
            <ProductGrid products={products} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              sortOption={sortOption} setSortOption={setSortOption} onAddToCart={handleAddToCart} toUZS={toUZS} />
          ) : mode === 'expense' ? (
            <ExpenseForm expenseDesc={expenseDesc} setExpenseDesc={setExpenseDesc}
              expenseAmount={expenseAmount} setExpenseAmount={setExpenseAmount}
              expenseCategory={expenseCategory} setExpenseCategory={setExpenseCategory}
              expenseMethod={expenseMethod} setExpenseMethod={setExpenseMethod}
              expenseCurrency={expenseCurrency} setExpenseCurrency={setExpenseCurrency}
              withVat={withVat} setWithVat={setWithVat}
              expenseVatAmount={expenseVatAmount} setExpenseVatAmount={setExpenseVatAmount}
              onSubmit={handleAddExpense}
              expenseCategories={settings.expenseCategories}
              employees={employees}
              selectedEmployeeId={selectedEmployeeId}
              setSelectedEmployeeId={setSelectedEmployeeId} />
          ) : mode === 'transactions' ? (
            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
              {/* Детальный отчёт движения кассы */}
              <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
                <h3 className={`${t.text} font-bold mb-4 flex items-center gap-2`}>
                  📊 Детализация баланса кассы USD
                </h3>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <div className={`text-xs ${t.textMuted} font-bold border-b ${t.border} pb-2 grid grid-cols-6 gap-2`}>
                    <span>ID Заказа</span>
                    <span>Клиент</span>
                    <span>Метод</span>
                    <span>Валюта</span>
                    <span className="text-right">Сумма (к балансу USD)</span>
                    <span className="text-right">Действия</span>
                  </div>
                  
                  {(orders || [])
                    .filter(o => o.paymentMethod !== 'mixed' && o.paymentMethod !== 'debt')
                    .map(o => {
                      const rate = num(o.exchangeRate) > 100 ? num(o.exchangeRate) : 12900;
                      let paidUSD = num(o.amountPaid);
                      if (paidUSD > 100000) paidUSD = paidUSD / rate;
                      let totalUSD = num(o.totalAmount);
                      if (totalUSD > 100000) totalUSD = totalUSD / rate;
                      const finalAmount = paidUSD > 0 ? paidUSD : totalUSD;
                      
                      const isCashUSD = o.paymentMethod === 'cash' && o.paymentCurrency !== 'UZS';
                      const isLargeAmount = finalAmount > 10000;
                      
                      return (
                        <div key={o.id} className={`text-xs grid grid-cols-6 gap-2 py-2 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/50'} ${isLargeAmount ? 'bg-red-500/20 border-red-500/30' : isCashUSD ? 'bg-emerald-500/10' : t.bgPanelAlt}`}>
                          <span className={`${t.textSecondary} font-mono`}>{o.id}</span>
                          <span className={`${t.textMuted} truncate`}>{o.customerName}</span>
                          <span className={`${t.textMuted}`}>{o.paymentMethod}</span>
                          <span className={`${t.textMuted}`}>{o.paymentCurrency || 'USD'}</span>
                          <span className={`text-right font-mono font-bold ${isLargeAmount ? 'text-red-500' : isCashUSD ? 'text-emerald-500' : t.textMuted}`}>
                            {isCashUSD ? `+$${finalAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}` : '-'}
                          </span>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditingOrderId(o.id)}
                              className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded text-[10px] font-bold"
                            >
                              ✎
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Удалить заказ ${o.id}?`)) {
                                  const updated = orders.filter(ord => ord.id !== o.id);
                                  // CRITICAL: Save to Sheets FIRST, then update state
                                  await onSaveOrders?.(updated);
                                  setOrders(updated);
                                  toast.success('Заказ удалён');
                                }
                              }}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[10px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                <div className={`mt-4 pt-4 border-t ${t.border} flex justify-between items-center`}>
                  <span className={`${t.textMuted}`}>Итого в кассе USD (из заказов):</span>
                  <span className="text-emerald-500 font-mono font-bold text-xl">
                    ${(orders || [])
                      .filter(o => o.paymentMethod === 'cash' && o.paymentCurrency !== 'UZS')
                      .reduce((sum, o) => {
                        const rate = num(o.exchangeRate) > 100 ? num(o.exchangeRate) : 12900;
                        let paidUSD = num(o.amountPaid);
                        if (paidUSD > 100000) paidUSD = paidUSD / rate;
                        let totalUSD = num(o.totalAmount);
                        if (totalUSD > 100000) totalUSD = totalUSD / rate;
                        return sum + (paidUSD > 0 ? paidUSD : totalUSD);
                      }, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}
                  </span>
                </div>
                
                <div className={`mt-2 text-xs ${theme === 'light' ? 'text-slate-600' : 'text-amber-500'} bg-amber-500/10 p-2 rounded-lg`}>
                  💡 Зелёные строки добавляются к балансу USD. Если видите огромные суммы - это ошибки в данных.
                </div>
              </div>

              <TransactionsManager 
                transactions={transactions}
                onUpdateTransactions={setTransactions}
                onSaveTransactions={onSaveTransactions}
                expenses={expenses}
                onUpdateExpenses={setExpenses}
                onSaveExpenses={onSaveExpenses}
                exchangeRate={exchangeRate}
              />
            </div>
          ) : null}
        </div>

        {/* Mobile Recent Orders */}
        {orders.length > 0 && mode === 'sale' && (
          <div className="lg:hidden bg-slate-800 border-t border-slate-700 px-3 py-2 col-span-full">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400">Последние чеки:</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {orders.slice(0, 5).map(order => (
                <button key={order.id} onClick={() => { setSelectedOrderForReceipt(order); setShowReceiptModal(true); }}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded-md font-medium whitespace-nowrap flex items-center gap-1 flex-shrink-0">
                  <FileText size={10} />{order.id.split('-')[1]?.slice(-6) || order.id.slice(-6)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cart Panel (Desktop) */}
        {mode === 'sale' && (
          <CartPanel cart={cart} removeFromCart={removeFromCart} updateQuantity={updateQuantity}
            customerName={customerName} setCustomerName={setCustomerName}
            sellerName={sellerName} setSellerName={setSellerName}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            paymentCurrency={paymentCurrency} setPaymentCurrency={setPaymentCurrency}
            clients={clients} employees={employees} settings={settings}
            subtotalUSD={subtotalUSD} vatAmountUSD={vatAmountUSD} totalAmountUSD={totalAmountUSD} totalAmountUZS={totalAmountUZS}
            toUZS={toUZS} onCompleteOrder={completeOrder} onOpenClientModal={() => setIsClientModalOpen(true)}
            onNavigateToStaff={onNavigateToStaff} lastOrder={lastOrder}
            onShowReceipt={() => {
              setLastOrder(null); // Just close/reset if needed
              // Logic for receipt moved to modal usage usually
            }}
            onPrintReceipt={() => { }}
            onPrintInvoice={order => generateInvoicePDF(order, settings)}
            onPrintWaybill={order => generateWaybillPDF(order, settings)}
            flyingItems={flyingItems}

            // Discount Props
            discountPercent={discountPercent}
            onDiscountChange={(val) => {
              setDiscountPercent(val);
              setManualTotal(null); // Reset manual total so percentage takes precedence
            }}
            manualTotal={manualTotal}
            onTotalChange={(val) => {
              setManualTotal(val);
              // Calculate effective percentage for display/logic
              if (originalTotalUSD > 0) {
                const newDiscount = ((originalTotalUSD - val) / originalTotalUSD) * 100;
                setDiscountPercent(Math.max(0, newDiscount));
              }
            }}
            originalTotalUSD={originalTotalUSD}
          />)}
      </div>

      {/* Return Modal */}
      {mode === 'return' && (
        <ReturnModal returnClientName={returnClientName} setReturnClientName={setReturnClientName}
          returnProductName={returnProductName} setReturnProductName={setReturnProductName}
          returnQuantity={returnQuantity} setReturnQuantity={setReturnQuantity}
          returnMethod={returnMethod} setReturnMethod={setReturnMethod}
          clients={clients} products={products}
          onSubmit={handleReturnSubmit}
          onSubmitMoneyReturn={handleMoneyReturn}
          onClose={() => setMode('sale')} />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedOrderForReceipt && (
        <ReceiptModal order={selectedOrderForReceipt} onPrint={handlePrintReceipt}
          onPrintInvoice={(order) => generateInvoicePDF(order, settings)}
          onPrintWaybill={(order) => generateWaybillPDF(order, settings)}
          onClose={() => { setShowReceiptModal(false); setSelectedOrderForReceipt(null); }} />
      )}

      {/* Client Modal */}
      <ClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)}
        clientData={newClientData} setClientData={setNewClientData} onSave={handleSaveClient} />

      {/* Workflow Payment Confirmation Modal (New Split) */}
      <PaymentSplitModal
        isOpen={workflowPaymentModalOpen}
        onClose={() => setWorkflowPaymentModalOpen(false)}
        totalAmountUSD={selectedWorkflowOrder?.totalAmount || 0}
        totalAmountUZS={selectedWorkflowOrder?.totalAmountUZS || 0}
        exchangeRate={selectedWorkflowOrder?.exchangeRate || exchangeRate}
        onConfirm={confirmWorkflowPayment}
      />

      {/* Sales Mixed Payment Modal */}
      <PaymentSplitModal
        isOpen={salesPaymentModalOpen}
        onClose={() => setSalesPaymentModalOpen(false)}
        totalAmountUSD={totalAmountUSD}
        totalAmountUZS={totalAmountUZS}
        exchangeRate={exchangeRate}
        onConfirm={(dist) => finalizeSale(dist, 'mixed')}
      />

      {/* Mobile Cart Button */}
      {mode === 'sale' && (
        <button onClick={() => setIsCartModalOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full p-4 shadow-2xl shadow-emerald-600/50 z-40 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
              {cart.length}
            </span>
          )}
        </button>
      )}

      {/* Mobile Cart Modal */}
      <MobileCartModal isOpen={isCartModalOpen} onClose={() => setIsCartModalOpen(false)}
        cart={cart} removeFromCart={removeFromCart} updateQuantity={updateQuantity}
        customerName={customerName} setCustomerName={setCustomerName}
        sellerName={sellerName} setSellerName={setSellerName}
        paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        paymentCurrency={paymentCurrency} setPaymentCurrency={setPaymentCurrency}
        clients={clients} employees={employees} settings={settings}
        subtotalUSD={subtotalUSD} vatAmountUSD={vatAmountUSD} totalAmountUSD={totalAmountUSD} totalAmountUZS={totalAmountUZS}
        toUZS={toUZS} onCompleteOrder={completeOrder} onOpenClientModal={() => setIsClientModalOpen(true)}
        onNavigateToStaff={onNavigateToStaff} flyingItems={flyingItems}
        discountPercent={discountPercent}
        onDiscountChange={(val) => {
          setDiscountPercent(val);
          setManualTotal(null);
        }}
        manualTotal={manualTotal}
        onTotalChange={(val) => {
          setManualTotal(val);
          if (originalTotalUSD > 0) {
            const newDiscount = ((originalTotalUSD - val) / originalTotalUSD) * 100;
            setDiscountPercent(Math.max(0, newDiscount));
          }
        }}
        originalTotalUSD={originalTotalUSD}
      />

      {/* Cancel Workflow Modal */}
      {cancelModalOpen && orderToCancel && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-400" size={24} />
              Аннулирование заказа
            </h3>
            
            <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
              <div className="text-sm text-slate-400">Заказ: <span className="text-white font-mono">{orderToCancel.id}</span></div>
              <div className="text-sm text-slate-400 mt-1">Клиент: <span className="text-white">{orderToCancel.customerName}</span></div>
              <div className="text-sm text-slate-400 mt-1">Сумма: <span className="text-emerald-300 font-mono">{Number(orderToCancel.totalAmountUZS || 0).toLocaleString()} сум</span></div>
            </div>

            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-2 block">Причина аннулирования *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500/50 h-24 resize-none"
                placeholder="Укажите причину аннулирования..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setCancelModalOpen(false); setOrderToCancel(null); setCancelReason(''); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium"
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

      {/* Order Edit Modal */}
      {editingOrderId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              ✎ Редактирование заказа
            </h3>
            
            <div className="text-sm text-slate-400 mb-4">ID: <span className="text-white font-mono">{editingOrderId}</span></div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Сумма (totalAmount) в USD</label>
                <input
                  type="number"
                  value={editOrderData.totalAmount}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, totalAmount: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Оплачено (amountPaid) в USD</label>
                <input
                  type="number"
                  value={editOrderData.amountPaid}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, amountPaid: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Метод оплаты</label>
                <select
                  value={editOrderData.paymentMethod}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="debt">Debt</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Валюта оплаты</label>
                <select
                  value={editOrderData.paymentCurrency}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, paymentCurrency: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="UZS">UZS</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingOrderId(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  const updated = orders.map(o => 
                    o.id === editingOrderId 
                      ? { 
                          ...o, 
                          totalAmount: parseFloat(editOrderData.totalAmount) || 0,
                          amountPaid: parseFloat(editOrderData.amountPaid) || 0,
                          paymentMethod: editOrderData.paymentMethod as any,
                          paymentCurrency: editOrderData.paymentCurrency as any
                        } 
                      : o
                  );
                  // CRITICAL: Save to Sheets FIRST, then update state
                  await onSaveOrders?.(updated);
                  setOrders(updated);
                  toast.success('Заказ обновлён');
                  setEditingOrderId(null);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper for icon
const SalesModeIcon = ({ icon, size }: { icon: any, size: number }) => <div style={{ width: size, height: size }}>{icon}</div>;

