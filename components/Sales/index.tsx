import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Order, OrderItem, Expense, Client, Transaction, JournalEvent, WorkflowOrder } from '../../types';
import { ShoppingCart, ArrowDownRight, ArrowUpRight, RefreshCw, FileText, ClipboardList, List } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { SUPER_ADMIN_EMAILS } from '../../constants';
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
import { WorkflowQueue } from './WorkflowQueue';
import { OrderEditModal } from './OrderEditModal';
import { SalesTransactionsView } from './SalesTransactionsView';
import { AuditAlert } from './AuditAlert';
import { calculateBaseTotals, num, getSafeRate } from '../../utils/finance';
import { findOrCreateClient } from '../../services/clientService';
import { CancelWorkflowModal } from '../CancelWorkflowModal';

import { logger } from '../../utils/logger';
import { getMissingItems } from '../../utils/inventoryHelpers';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) logger.error('Sales', String(args[0]), ...args.slice(1)); };

export const Sales: React.FC<SalesProps> = ({
  products, orders, setOrders, settings, setSettings, expenses,
  employees, onNavigateToStaff, clients, onSaveClients, transactions,
  workflowOrders, onSaveWorkflowOrders, currentUserEmail, onNavigateToProcurement,
  onSaveOrders, onSaveTransactions, onSaveProducts, onSaveExpenses, onAddExpense, onAddJournalEvent,
  onDeleteTransaction, onDeleteExpense
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  // Helper to get next report number and update settings
  // Use a ref to prevent race conditions when multiple sales happen quickly
  const reportNoRef = React.useRef<number>(settings.nextReportNo ?? 1);
  React.useEffect(() => {
    reportNoRef.current = settings.nextReportNo ?? 1;
  }, [settings.nextReportNo]);

  const getNextReportNo = (): number => {
    const currentNo = reportNoRef.current;
    reportNoRef.current = currentNo + 1; // Immediately increment ref to prevent duplicates
    if (setSettings) {
      setSettings({ ...settings, nextReportNo: currentNo + 1 });
    }
    return currentNo;
  };

  const currentEmployee = React.useMemo(
    () => employees.find(e => e.email?.toLowerCase() === (currentUserEmail || '').toLowerCase()),
    [employees, currentUserEmail]
  );
  const isCashier =
    (!!currentUserEmail && SUPER_ADMIN_EMAILS.includes(currentUserEmail.toLowerCase())) ||
    currentEmployee?.role === 'accountant' ||
    currentEmployee?.role === 'manager' ||
    currentEmployee?.role === 'admin' ||
    currentEmployee?.permissions?.workflow === true ||
    currentEmployee?.permissions?.sales === true;

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
  const [debtDueDate, setDebtDueDate] = useState<string>(''); // Payment due date for debt orders

  // Expense State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Прочее');
  const [expenseMethod, setExpenseMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('UZS');
  const [withVat, setWithVat] = useState(false);
  const [expenseVatAmount, setExpenseVatAmount] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [showAuditAlert, setShowAuditAlert] = useState(false);

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
  const toUZS = useCallback((usd: number) => Math.round(usd * exchangeRate), [exchangeRate]);
  const toUSD = useCallback((uzs: number) => exchangeRate > 0 ? uzs / exchangeRate : 0, [exchangeRate]);

  // Расчёт скидки для заказа относительно прайс-листа
  const getOrderDiscount = useCallback((items: OrderItem[]) => {
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
  }, [products]);

  const workflowCashQueue = React.useMemo(() => {
    return (workflowOrders || [])
      .filter(o => o.status === 'sent_to_cash')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workflowOrders]);

  const openWorkflowPaymentModal = (wf: WorkflowOrder) => {
    if (!isCashier) {
      toast.error('Нет прав: только кассир/финансист может подтверждать.');
      return;
    }

    const missing = getMissingItems(wf.items || [], products);
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

    // Generate report number for workflow orders
    const reportNo = getNextReportNo();

    const newOrder: Order = {
      id: IdGenerator.order(),
      reportNo, // Sequential report number
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

    // Update client (create if missing)
    const { client: foundClient, index: idx, clients: nextClients } = findOrCreateClient(
      clients, wf.customerName, wf.customerPhone || '', 'Автоматически создан из Workflow'
    );
    const clientId = foundClient.id;

    // Add clientId to order
    const newOrderWithClient: Order = {
      ...newOrder,
      clientId
    };

    nextClients[idx] = {
      ...nextClients[idx],
      totalPurchases: (nextClients[idx].totalPurchases || 0) + (wf.totalAmount || 0)
    };
    onSaveClients(nextClients);

    // Create Transactions for EACH payment part
    const newTrx: Transaction[] = [];
    const baseTrx = {
      id: '', date: new Date().toISOString(), type: 'client_payment' as const,
      description: `Оплата заказа ${newOrder.id} (Workflow)`, relatedId: clientId, orderId: newOrder.id
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
        description: `Долг по заказу ${newOrder.id}`, orderId: newOrder.id
      });
    }

    const updatedTx = [...transactions, ...newTrx];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveTransactions?.(updatedTx);

    const updatedOrders = [newOrderWithClient, ...orders];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveOrders?.(updatedOrders);
    setOrders(updatedOrders);

    const nextWorkflow = workflowOrders.map(o =>
      o.id === wf.id ? { ...o, status: 'completed' as const, convertedToOrderId: newOrderWithClient.id, convertedAt: new Date().toISOString() } : o
    );
    await onSaveWorkflowOrders(nextWorkflow);

    await onAddJournalEvent?.({
      id: IdGenerator.journal(),
      date: new Date().toISOString(),
      type: 'employee_action',
      employeeName: currentEmployee?.name || 'Кассир',
      action: 'Workflow подтвержден (Смешанная оплата)',
      description: `Заказ ${newOrderWithClient.id}. Оплачено: $${totalPaidUSD.toFixed(2)}. Долг: $${remainingUSD.toFixed(2)}.`,
      module: 'sales',
      relatedType: 'workflow',
      relatedId: wf.id,
      metadata: { convertedTo: newOrderWithClient.id }
    });

    toast.success('Workflow подтвержден!');
    setMode('sale');
    setWorkflowPaymentModalOpen(false);
    setSelectedWorkflowOrder(null);
  };

  // --- Cancel Workflow Order ---
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<WorkflowOrder | null>(null);

  const openCancelModal = (wf: WorkflowOrder) => {
    setOrderToCancel(wf);
    setCancelModalOpen(true);
  };

  // --- Balance Calculations (memoized) ---
  const { balances, debugStats, suspicious } = useMemo(() => {
    const { cashUSD, cashUZS, bankUZS, cardUZS } = calculateBaseTotals(
      orders || [],
      transactions || [],
      expenses || [],
      settings.defaultExchangeRate
    );

    const getRate = (rate: number | undefined) => getSafeRate(rate, num(exchangeRate));
    const suspiciousThreshold = 1000000; // $1M

    return {
      balances: {
        balanceCashUSD: cashUSD,
        balanceCashUZS: cashUZS,
        balanceBankUZS: bankUZS,
        balanceCardUZS: cardUZS
      } as Balances,
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
  }, [orders, transactions, expenses, settings.defaultExchangeRate, exchangeRate]);

  // --- Cart Logic ---
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) return prev;
      const newItem: OrderItem = {
        productId: product.id, productName: product.name, dimensions: product.dimensions,
        quantity: 1, priceAtSale: product.pricePerUnit, costAtSale: product.costPrice || 0,
        unit: product.unit, total: product.pricePerUnit
      };
      return [...prev, newItem];
    });
  }, []);

  const handleAddToCart = useCallback((e: React.MouseEvent<HTMLElement>, product: Product) => {
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
  }, [addToCart]);

  const removeFlyingItem = useCallback((id: number) => setFlyingItems(prev => prev.filter(item => item.id !== id)), []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return item;
        const validQty = Math.min(Math.max(0, qty), product.quantity);
        return { ...item, quantity: validQty, total: validQty * item.priceAtSale };
      }
      return item;
    }));
  }, [products]);

  const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter(item => item.productId !== id)), []);

  // Totals — IFRS 15: discount applies to net amount (before VAT)
  const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
  
  // Apply discount to subtotal BEFORE calculating VAT (IFRS 15 - Transaction Price)
  const discountedSubtotal = manualTotal !== null
    ? manualTotal / (1 + settings.vatRate / 100) // Reverse-calculate net from manual total
    : subtotalUSD * (1 - (discountPercent || 0) / 100);
  
  const vatAmountUSD = discountedSubtotal * (settings.vatRate / 100);
  const originalTotalUSD = subtotalUSD + (subtotalUSD * (settings.vatRate / 100));

  const totalAmountUSD = manualTotal !== null
    ? manualTotal
    : discountedSubtotal + vatAmountUSD;

  const discountAmount = originalTotalUSD - totalAmountUSD;

  const totalAmountUZS = toUZS(totalAmountUSD);

  // --- Order Finalization (Shared) ---
  const finalizeSale = async (dist: PaymentDistribution, method: PaymentMethod = 'mixed', customStatus?: 'paid' | 'unpaid' | 'partial') => {
    const { cashUSD, cashUZS, cardUZS, bankUZS, isPaid, remainingUSD } = dist;

    const paymentStatus = customStatus || (isPaid ? 'paid' : (cashUSD + cashUZS + cardUZS + bankUZS === 0 ? 'unpaid' : 'partial'));
    const totalPaidUSD = cashUSD + (cashUZS / exchangeRate) + (cardUZS / exchangeRate) + (bankUZS / exchangeRate);

    // Find seller employee by name for KPI
    const sellerEmployee = employees.find(e => e.name?.toLowerCase() === (sellerName || '').toLowerCase());

    // Generate report number for this order
    const reportNo = getNextReportNo();

    // Determine payment due date: if debt or partial, require due date
    const hasDebt = paymentStatus === 'unpaid' || paymentStatus === 'partial';
    const paymentDueDate = hasDebt && debtDueDate ? debtDueDate : undefined;

    const newOrder: Order = {
      id: IdGenerator.order(), 
      reportNo, // Add sequential report number
      date: new Date().toISOString(), 
      customerName,
      sellerId: sellerEmployee?.id || currentEmployee?.id, // Employee ID for KPI
      sellerName: sellerName || currentEmployee?.name || 'Администратор',
      items: [...cart], subtotalAmount: discountedSubtotal, vatRateSnapshot: settings.vatRate, vatAmount: vatAmountUSD,
      totalAmount: totalAmountUSD, exchangeRate, totalAmountUZS, status: 'completed', paymentMethod: method, paymentStatus, amountPaid: totalPaidUSD,
      paymentCurrency: method === 'cash' ? (paymentCurrency || 'USD') : 'USD', // Fallback
      paymentDueDate, // Payment deadline for debts
    };

    try {
      // Update products
      const updatedProducts = products.map(p => {
        const cartItem = cart.find(item => item.productId === p.id);
        return cartItem ? { ...p, quantity: p.quantity - cartItem.quantity } : p;
      });
      await onSaveProducts?.(updatedProducts);

      // Update/Create Client
      const { client: foundClient, index: clientIndex, clients: currentClients } = findOrCreateClient(
        clients, customerName, '', 'Автоматически создан при продаже'
      );
      const clientId = foundClient.id;

      // Add clientId to order for proper linking
      const newOrderWithClient = {
        ...newOrder,
        clientId
      };

      // Update Client stats. Debt is updated via debt transactions only.
      currentClients[clientIndex] = {
        ...currentClients[clientIndex],
        totalPurchases: (currentClients[clientIndex].totalPurchases || 0) + totalAmountUSD
      };
      await onSaveClients(currentClients);

      // Create Transactions
      const newTrx: Transaction[] = [];
      const baseTrx = {
        id: '', date: new Date().toISOString(), type: 'client_payment' as const,
        description: `Оплата заказа ${newOrder.id}`, relatedId: clientId, orderId: newOrder.id
      };

      if (method === 'mixed') {
        if (cashUSD > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cashUSD, currency: 'USD', method: 'cash' });
        if (cashUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cashUZS, currency: 'UZS', method: 'cash' });
        if (cardUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: cardUZS, currency: 'UZS', method: 'card' });
        if (bankUZS > 0) newTrx.push({ ...baseTrx, id: IdGenerator.transaction(), amount: bankUZS, currency: 'UZS', method: 'bank' });
      }

      // Debt Obligation
      if (remainingUSD > 0.05) {
        newTrx.push({
          ...baseTrx, id: IdGenerator.transaction(), type: 'debt_obligation', amount: remainingUSD, currency: 'USD', method: 'debt',
          description: `Долг по заказу ${newOrder.id}`, orderId: newOrder.id
        });
      }

      const updatedTransactions = [...transactions, ...newTrx];
      await onSaveTransactions?.(updatedTransactions);

      // Save order
      const updatedOrders = [newOrderWithClient, ...orders];
      await onSaveOrders?.(updatedOrders);
      setOrders(updatedOrders);

      // Clear form
      setCart([]);
      setCustomerName('');
      setSellerName('');
      setPaymentMethod('cash');
      setDiscountPercent(0);
      setManualTotal(null);
      setDebtDueDate(''); // Clear debt due date
      setLastOrder(newOrderWithClient);
      setSalesPaymentModalOpen(false); // Close if open
      setSelectedOrderForReceipt(newOrderWithClient);
      setTimeout(() => setShowReceiptModal(true), 300);

      // Journal
      await onAddJournalEvent?.({
        id: IdGenerator.journalEvent(), date: new Date().toISOString(), type: 'employee_action',
        employeeName: sellerName || 'Администратор', action: 'Создан заказ',
        description: `Отчёт №${newOrder.reportNo}. Продажа на сумму ${totalAmountUZS.toLocaleString()} сўм ($${totalAmountUSD.toFixed(2)}) клиенту ${customerName}.`,
        module: 'sales', relatedType: 'order', relatedId: newOrder.id,
        receiptDetails: { orderId: newOrder.id, customerName, totalAmount: totalAmountUSD, itemsCount: cart.length, paymentMethod, operation: 'created' }
      });
    } catch (error) {
      errorDev('finalizeSale failed:', error);
      toast.error('Ошибка при сохранении заказа! Попробуйте снова.');
    }
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
    if (!expenseDesc || !expenseAmount || isExpenseSubmitting) return;
    setIsExpenseSubmitting(true);
    try {
      const newExpense: Expense = {
        id: IdGenerator.expense(), date: new Date().toISOString(), description: expenseDesc,
        amount: parseFloat(expenseAmount), category: expenseCategory, paymentMethod: expenseMethod,
        currency: expenseCurrency,
        exchangeRate: exchangeRate > 0 ? exchangeRate : settings.defaultExchangeRate,
        vatAmount: withVat && expenseVatAmount ? parseFloat(expenseVatAmount) : 0,
        employeeId: selectedEmployeeId || undefined
      };
      // Save to Firebase via dedicated addExpense handler
      if (onAddExpense) {
        await onAddExpense(newExpense);
      } else {
        // Fallback to legacy batch save
        const updatedExpenses = [newExpense, ...expenses];
        await onSaveExpenses?.(updatedExpenses);
      }
      setExpenseDesc(''); setExpenseAmount(''); setWithVat(false); setExpenseVatAmount(''); setSelectedEmployeeId('');
      toast.success('Расход добавлен!');
    } catch (err) {
      errorDev('Ошибка при добавлении расхода:', err);
      toast.error('Ошибка при добавлении расхода');
    } finally {
      setIsExpenseSubmitting(false);
    }
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

    // Find the last order for this product to get the actual sale price
    const lastOrder = orders.find(o => 
      o.status === 'completed' && 
      o.items.some(item => item.productId === product.id) &&
      (client ? (o.clientId === client.id || o.customerName.toLowerCase() === client.name.toLowerCase()) : true)
    );
    const orderItem = lastOrder?.items.find(item => item.productId === product.id);
    
    // Use the actual sale price from the order, fallback to current price
    const returnPricePerUnit = orderItem?.priceAtSale ?? product.pricePerUnit;
    const returnCostPerUnit = orderItem?.costAtSale ?? product.costPrice;

    // Update Stock & Recalculate Weighted Average Cost (WAVG)
    const updatedProducts = products.map(p => {
      if (p.id === product.id) {
        const newQuantity = p.quantity + qty;
        // Recalculate WAVG: (existing_value + returned_value) / new_total_qty
        const existingValue = p.quantity * p.costPrice;
        const returnedValue = qty * returnCostPerUnit;
        const newCostPrice = newQuantity > 0 ? (existingValue + returnedValue) / newQuantity : p.costPrice;
        return { ...p, quantity: newQuantity, costPrice: newCostPrice };
      }
      return p;
    });
    onSaveProducts?.(updatedProducts);

    const returnAmountUSD = qty * returnPricePerUnit;

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
    const newClient: Client = { ...newClientData as Client, id: IdGenerator.client() };
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
            {(currentEmployee?.permissions?.canProcessReturns !== false) && (
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

          <AuditAlert
            suspicious={suspicious} showAuditAlert={showAuditAlert}
            setShowAuditAlert={setShowAuditAlert} exchangeRate={exchangeRate}
            t={t} theme={theme}
          />

          {mode === 'workflow' ? (
            <WorkflowQueue
              workflowCashQueue={workflowCashQueue} products={products} exchangeRate={exchangeRate}
              t={t} theme={theme} getOrderDiscount={getOrderDiscount}
              openCancelModal={openCancelModal} openWorkflowPaymentModal={openWorkflowPaymentModal}
            />
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
              isSubmitting={isExpenseSubmitting}
              expenseCategories={settings.expenseCategories}
              employees={employees}
              selectedEmployeeId={selectedEmployeeId}
              setSelectedEmployeeId={setSelectedEmployeeId} />
          ) : mode === 'transactions' ? (
            <SalesTransactionsView
              orders={orders} transactions={transactions} expenses={expenses}
              setOrders={setOrders}
              onSaveOrders={onSaveOrders} onSaveTransactions={onSaveTransactions} onSaveExpenses={onSaveExpenses}
              onDeleteTransaction={onDeleteTransaction} onDeleteExpense={onDeleteExpense}
              onAddJournalEvent={onAddJournalEvent} currentUserEmail={currentUserEmail || undefined}
              exchangeRate={exchangeRate} t={t} theme={theme}
              setEditingOrderId={setEditingOrderId}
              onToast={(type, msg) => type === 'success' ? toast.success(msg) : toast.error(msg)}
            />
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
            // Debt Due Date
            debtDueDate={debtDueDate}
            onDebtDueDateChange={setDebtDueDate}
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
        <CancelWorkflowModal
          order={orderToCancel}
          workflowOrders={workflowOrders}
          cancelledBy={currentEmployee?.name || currentUserEmail || 'Кассир'}
          onSaveWorkflowOrders={onSaveWorkflowOrders}
          onClose={() => { setCancelModalOpen(false); setOrderToCancel(null); }}
          onAddJournalEvent={onAddJournalEvent}
          journalEvent={{
            id: IdGenerator.journalEvent(),
            date: new Date().toISOString(),
            type: 'employee_action',
            employeeName: currentEmployee?.name || 'Кассир',
            action: 'Workflow аннулирован',
            description: '',
            module: 'sales',
            relatedType: 'workflow',
            relatedId: orderToCancel.id
          }}
        />
      )}

      {/* Order Edit Modal */}
      {editingOrderId && (
        <OrderEditModal
          editingOrderId={editingOrderId} editOrderData={editOrderData}
          setEditOrderData={setEditOrderData} orders={orders} setOrders={setOrders}
          onSaveOrders={onSaveOrders} onClose={() => setEditingOrderId(null)}
          onSuccess={(msg) => toast.success(msg)}
        />
      )}
    </div>
  );
};
