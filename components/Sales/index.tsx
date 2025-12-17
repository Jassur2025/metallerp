import React, { useState, useEffect } from 'react';
import { Product, Order, OrderItem, Expense, Client, Transaction, JournalEvent, WorkflowOrder } from '../../types';
import { ShoppingCart, ArrowDownRight, ArrowUpRight, RefreshCw, FileText, ClipboardList, BadgeCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { SUPER_ADMIN_EMAILS, IS_DEV_MODE } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';


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
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('UZS');

  // Expense State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Прочее');
  const [expenseMethod, setExpenseMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('UZS');
  const [withVat, setWithVat] = useState(false);
  const [expenseVatAmount, setExpenseVatAmount] = useState('');

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

  useEffect(() => {
    setExchangeRate(settings.defaultExchangeRate);
  }, [settings.defaultExchangeRate]);

  // Helpers
  const toUZS = (usd: number) => Math.round(usd * exchangeRate);
  const toUSD = (uzs: number) => exchangeRate > 0 ? uzs / exchangeRate : 0;

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

  const approveWorkflowInCash = async (wf: WorkflowOrder) => {
    if (!isCashier) {
      toast.error('Нет прав: только кассир/финансист может подтверждать.');
      return;
    }

    const missing = getMissingItems(wf.items || []);
    if (missing.length > 0) {
      toast.warning('Недостаточно остатков. Заявка отправлена в закуп.');
      const next = workflowOrders.map(o => o.id === wf.id ? { ...o, status: 'sent_to_procurement' as const } : o);
      await onSaveWorkflowOrders(next);
      localStorage.setItem('procurement_active_tab', 'workflow');
      onNavigateToProcurement?.();
      return;
    }

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString(),
      customerName: wf.customerName,
      sellerName: wf.createdBy || 'Sales',
      items: wf.items,
      subtotalAmount: wf.subtotalAmount,
      vatRateSnapshot: wf.vatRateSnapshot,
      vatAmount: wf.vatAmount,
      totalAmount: wf.totalAmount,
      exchangeRate: wf.exchangeRate,
      totalAmountUZS: wf.totalAmountUZS,
      status: 'completed',
      paymentMethod: wf.paymentMethod,
      paymentStatus: wf.paymentStatus,
      amountPaid: wf.amountPaid,
      paymentCurrency: wf.paymentCurrency
    };

    const updatedProducts = products.map(p => {
      const it = wf.items.find((i: OrderItem) => i.productId === p.id);
      return it ? { ...p, quantity: p.quantity - it.quantity } : p;
    });
    setProducts(updatedProducts);
    await onSaveProducts?.(updatedProducts);

    // Update client (create if missing)
    const nextClients = [...clients];
    let idx = nextClients.findIndex(c => c.name.toLowerCase() === String(wf.customerName || '').toLowerCase());
    let clientId = '';
    if (idx === -1) {
      const c: Client = {
        id: `CLI-${Date.now()}`,
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
    const isDebt = wf.paymentMethod === 'debt';
    nextClients[idx] = {
      ...nextClients[idx],
      totalPurchases: (nextClients[idx].totalPurchases || 0) + (wf.totalAmount || 0),
      totalDebt: isDebt ? (nextClients[idx].totalDebt || 0) + (wf.totalAmount || 0) : (nextClients[idx].totalDebt || 0)
    };
    onSaveClients(nextClients);

    if (isDebt) {
      const trx: Transaction = {
        id: `TRX-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'debt_obligation',
        amount: wf.totalAmount,
        currency: 'USD',
        method: 'debt',
        description: `Workflow → Долг: ${wf.id}`,
        relatedId: clientId
      };
      const updatedTx = [...transactions, trx];
      setTransactions(updatedTx);
      await onSaveTransactions?.(updatedTx);
    }

    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    await onSaveOrders?.(updatedOrders);

    const nextWorkflow = workflowOrders.map(o =>
      o.id === wf.id ? { ...o, status: 'completed' as const, convertedToOrderId: newOrder.id, convertedAt: new Date().toISOString() } : o
    );
    await onSaveWorkflowOrders(nextWorkflow);

    await onAddJournalEvent?.({
      id: `JE-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'employee_action',
      employeeName: currentEmployee?.name || 'Кассир',
      action: 'Workflow подтвержден (из кассы)',
      description: `Workflow ${wf.id} подтвержден в кассе. Создан заказ ${newOrder.id}.`,
      module: 'sales',
      relatedType: 'workflow',
      relatedId: wf.id,
      metadata: { convertedTo: newOrder.id }
    });

    toast.success('Workflow подтвержден: продажа создана и склад списан.');
    setMode('sale');
  };

  // --- Balance Calculations ---
  const calculateBalance = (): Balances => {
    const val = (n: number | undefined | null) => n || 0;
    const getRate = (rate: number | undefined | null) => (rate && rate > 0) ? rate : (exchangeRate || 1);

    // Cash USD
    const cashInUSD = orders
      .filter(o => o.paymentMethod === 'cash' && (o.paymentCurrency === 'USD' || !o.paymentCurrency))
      .reduce((sum, o) => sum + val(o.amountPaid), 0);
    const cashOutUSDExpenses = expenses.filter(e => e.paymentMethod === 'cash' && e.currency === 'USD').reduce((sum, e) => sum + val(e.amount), 0);
    const cashOutUSDSuppliers = transactions.filter(t => t.type === 'supplier_payment' && t.method === 'cash' && t.currency === 'USD').reduce((sum, t) => sum + val(t.amount), 0);
    const balanceCashUSD = cashInUSD - cashOutUSDExpenses - cashOutUSDSuppliers;

    // Cash UZS
    const cashInUZS = orders.filter(o => o.paymentMethod === 'cash' && o.paymentCurrency === 'UZS').reduce((sum, o) => sum + val(o.totalAmountUZS), 0);
    const cashOutUZSExpenses = expenses.filter(e => e.paymentMethod === 'cash' && e.currency === 'UZS').reduce((sum, e) => {
      const rate = getRate(e.exchangeRate);
      return sum + (e.exchangeRate ? val(e.amount) : (val(e.amount) * rate));
    }, 0);
    const cashOutUZSSuppliers = transactions.filter(t => t.type === 'supplier_payment' && t.method === 'cash' && t.currency === 'UZS').reduce((sum, t) => sum + val(t.amount), 0);
    const balanceCashUZS = cashInUZS - cashOutUZSExpenses - cashOutUZSSuppliers;

    // Bank UZS
    const bankInUZS = orders.filter(o => o.paymentMethod === 'bank').reduce((sum, o) => sum + val(o.totalAmountUZS), 0);
    const bankOutUZSExpenses = expenses.filter(e => e.paymentMethod === 'bank').reduce((sum, e) => {
      const rate = getRate(e.exchangeRate);
      return e.currency === 'UZS' ? sum + (e.exchangeRate ? val(e.amount) : (val(e.amount) * rate)) : sum + (val(e.amount) * rate);
    }, 0);
    const bankOutUZSSuppliers = transactions.filter(t => t.type === 'supplier_payment' && t.method === 'bank').reduce((sum, t) => {
      const rate = getRate(t.exchangeRate);
      return sum + (t.currency === 'UZS' ? val(t.amount) : (val(t.amount) * rate));
    }, 0);
    const balanceBankUZS = bankInUZS - bankOutUZSExpenses - bankOutUZSSuppliers;

    // Card UZS
    const cardInUZS = orders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + val(o.totalAmountUZS), 0);
    const cardOutUZS = expenses.filter(e => e.paymentMethod === 'card').reduce((sum, e) => {
      const rate = getRate(e.exchangeRate);
      return e.currency === 'UZS' ? sum + (e.exchangeRate ? val(e.amount) : (val(e.amount) * rate)) : sum + (val(e.amount) * rate);
    }, 0);
    const balanceCardUZS = cardInUZS - cardOutUZS;

    return { balanceCashUSD: Math.max(0, balanceCashUSD), balanceCashUZS: Math.max(0, balanceCashUZS), balanceBankUZS: Math.max(0, balanceBankUZS), balanceCardUZS: Math.max(0, balanceCardUZS) };
  };

  const balances = calculateBalance();

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
  const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
  const vatAmountUSD = subtotalUSD * (settings.vatRate / 100);
  const totalAmountUSD = subtotalUSD + vatAmountUSD;
  const totalAmountUZS = toUZS(totalAmountUSD);

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

    const isDebt = paymentMethod === 'debt';
    const amountPaid = isDebt ? 0 : totalAmountUSD;
    const paymentStatus = isDebt ? 'unpaid' : 'paid';
    let finalCurrency: 'USD' | 'UZS' | undefined = paymentMethod === 'cash' ? paymentCurrency : (paymentMethod === 'debt' ? 'USD' : 'UZS');

    const newOrder: Order = {
      id: `ORD-${Date.now()}`, date: new Date().toISOString(), customerName, sellerName: sellerName || 'Администратор',
      items: [...cart], subtotalAmount: subtotalUSD, vatRateSnapshot: settings.vatRate, vatAmount: vatAmountUSD,
      totalAmount: totalAmountUSD, exchangeRate, totalAmountUZS, status: 'completed', paymentMethod, paymentStatus, amountPaid, paymentCurrency: finalCurrency
    };

    // Update products
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.productId === p.id);
      return cartItem ? { ...p, quantity: p.quantity - cartItem.quantity } : p;
    });
    setProducts(updatedProducts);
    onSaveProducts?.(updatedProducts);

    // Update/Create Client
    let currentClients = [...clients];
    let clientIndex = currentClients.findIndex(c => c.name.toLowerCase() === customerName.toLowerCase());
    let clientId = '';

    if (clientIndex === -1) {
      const newClient: Client = { id: `CLI-${Date.now()}`, name: customerName, phone: '', creditLimit: 0, totalPurchases: 0, totalDebt: 0, notes: 'Автоматически создан при продаже' };
      currentClients.push(newClient);
      clientIndex = currentClients.length - 1;
      clientId = newClient.id;
    } else {
      clientId = currentClients[clientIndex].id;
    }

    currentClients[clientIndex] = {
      ...currentClients[clientIndex],
      totalPurchases: (currentClients[clientIndex].totalPurchases || 0) + totalAmountUSD,
      totalDebt: isDebt ? (currentClients[clientIndex].totalDebt || 0) + totalAmountUSD : (currentClients[clientIndex].totalDebt || 0)
    };
    await onSaveClients(currentClients);

    // Create debt transaction
    if (isDebt) {
      const newTransaction: Transaction = {
        id: `TRX-${Date.now()}`, date: new Date().toISOString(), type: 'debt_obligation',
        amount: totalAmountUSD, currency: 'USD', method: 'debt', description: `Покупка в долг: Заказ #${newOrder.id}`, relatedId: clientId
      };
      const updatedTransactions = [...transactions, newTransaction];
      setTransactions(updatedTransactions);
      onSaveTransactions?.(updatedTransactions);
    }

    // Save order
    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    await onSaveOrders?.(updatedOrders);

    // Clear form
    setCart([]);
    setCustomerName('');
    setSellerName('');
    setPaymentMethod('cash');
    setLastOrder(newOrder);
    setSelectedOrderForReceipt(newOrder);
    setTimeout(() => setShowReceiptModal(true), 300);

    // Journal
    onAddJournalEvent?.({
      id: `JE-${Date.now()}`, date: new Date().toISOString(), type: 'employee_action',
      employeeName: sellerName || 'Администратор', action: 'Создан заказ',
      description: `Продажа на сумму ${totalAmountUZS.toLocaleString()} сўм ($${totalAmountUSD.toFixed(2)}) клиенту ${customerName}.`,
      module: 'sales', relatedType: 'order', relatedId: newOrder.id,
      receiptDetails: { orderId: newOrder.id, customerName, totalAmount: totalAmountUSD, itemsCount: cart.length, paymentMethod, operation: 'created' }
    });
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
      id: `EXP-${Date.now()}`, date: new Date().toISOString(), description: expenseDesc,
      amount: parseFloat(expenseAmount), category: expenseCategory, paymentMethod: expenseMethod,
      currency: expenseCurrency, exchangeRate, vatAmount: withVat && expenseVatAmount ? parseFloat(expenseVatAmount) : 0
    };
    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);
    await onSaveExpenses?.(updatedExpenses);
    setExpenseDesc(''); setExpenseAmount(''); setWithVat(false); setExpenseVatAmount('');
    toast.success('Расход добавлен!');
  };

  // --- Return Logic ---
  const handleReturnSubmit = () => {
    if (!returnClientName || !returnProductName || !returnQuantity) { toast.warning('Заполните все поля!'); return; }
    const product = products.find(p => p.name === returnProductName);
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
      id: `TRX-${Date.now()}`, date: new Date().toISOString(), type: 'client_return',
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
      id: `TRX-${Date.now()}`,
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
    setTransactions(updatedTransactions);
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
    const newClient: Client = { id: Date.now().toString(), ...newClientData as Client };
    onSaveClients([...clients, newClient]);
    setCustomerName(newClient.name);
    setIsClientModalOpen(false);
    setNewClientData({ name: '', phone: '', email: '', address: '', creditLimit: 0, notes: '' });
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-full">
      <BalanceBar balances={balances} />

      {/* Recent Orders (Desktop) */}
      {orders.length > 0 && mode === 'sale' && (
        <div className="hidden lg:block bg-slate-800 border-b border-slate-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-slate-400" />
              <span className="text-sm text-slate-400">Последние заказы:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {orders.slice(0, 5).map(order => (
                <button key={order.id} onClick={() => { setSelectedOrderForReceipt(order); setShowReceiptModal(true); }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5">
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
            <button onClick={() => setMode('sale')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'sale' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <ArrowDownRight size={20} /> Новая Продажа
            </button>
            <button onClick={() => setMode('expense')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'expense' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <ArrowUpRight size={20} /> Новый Расход
            </button>
            {(user?.permissions?.canProcessReturns !== false) && (
              <button onClick={() => setMode('return')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'return' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                <RefreshCw size={20} /> Возврат
              </button>
            )}

            {isCashier && (
              <button onClick={() => setMode('workflow')} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'workflow' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                <ClipboardList size={20} /> Workflow
              </button>
            )}
          </div>

          {mode === 'workflow' ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ClipboardList size={18} className="text-indigo-400" /> Заявки из Workflow (в кассу)
                </h3>
                <div className="text-xs text-slate-400">{workflowCashQueue.length} заявок</div>
              </div>

              {workflowCashQueue.length === 0 ? (
                <div className="text-slate-500 text-center py-10">Пока нет заявок из Workflow</div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {workflowCashQueue.map((wf: any) => (
                    <div key={wf.id} className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white font-bold">{wf.customerName}</div>
                          <div className="text-xs text-slate-400 mt-1">{new Date(wf.date).toLocaleString('ru-RU')}</div>
                          <div className="text-xs text-slate-500 mt-1">ID: {wf.id} • Создал: {wf.createdBy}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-300 font-mono font-bold">{Number(wf.totalAmountUZS || 0).toLocaleString()} сум</div>
                          <div className="text-xs text-slate-500">${Number(wf.totalAmount || 0).toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        {(wf.items || []).slice(0, 5).map((it: OrderItem, idx: number) => {
                          const prod = products.find(p => p.id === it.productId);
                          const dims = prod?.dimensions || it.dimensions || '';
                          return (
                            <div key={idx} className="flex justify-between text-slate-300">
                              <span className="truncate max-w-[260px]">
                                {it.productName}
                                {dims && dims !== '-' && <span className="text-slate-500 ml-1">({dims})</span>}
                                <span className="text-slate-400 ml-1">× {it.quantity}</span>
                              </span>
                              <span className="font-mono text-slate-400">{Math.round(Number(it.total || 0) * Number(wf.exchangeRate || exchangeRate)).toLocaleString()} сум</span>
                            </div>
                          );
                        })}
                        {(wf.items || []).length > 5 && <div className="text-xs text-slate-500">+ ещё {(wf.items || []).length - 5} поз.</div>}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                          Оплата: <span className="text-slate-200 font-semibold">{wf.paymentMethod}</span>
                          {wf.paymentMethod === 'debt' && <span className="ml-2 text-amber-300 font-bold">ДОЛГ</span>}
                        </div>
                        <button
                          onClick={() => approveWorkflowInCash(wf)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"
                        >
                          <BadgeCheck size={18} /> Подтвердить
                        </button>
                      </div>

                      <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-400" />
                        Если остатков не хватит — заявка уйдет обратно в закуп.
                      </div>
                    </div>
                  ))}
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
              expenseCategories={settings.expenseCategories} />
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
            onShowReceipt={(order) => { setSelectedOrderForReceipt(order); setShowReceiptModal(true); }}
            onPrintReceipt={handlePrintReceipt}
            onPrintInvoice={(order) => generateInvoicePDF(order, settings)}
            onPrintWaybill={(order) => generateWaybillPDF(order, settings)}
            flyingItems={flyingItems} />

        )}
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
        onNavigateToStaff={onNavigateToStaff} flyingItems={flyingItems} />
    </div>
  );
};

