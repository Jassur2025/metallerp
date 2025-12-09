import React, { useState, useEffect } from 'react';
import { Product, Order, OrderItem, AppSettings, Expense, Employee, Client, Transaction, JournalEvent } from '../types';
import { ShoppingCart, Plus, Trash2, CheckCircle, RefreshCw, Package, FileText, FileSpreadsheet, User, ArrowUpDown, Wallet, CreditCard, Building2, ArrowDownRight, ArrowUpRight, Phone, Mail, MapPin, Printer, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '../contexts/ToastContext';



interface SalesProps {
  products: Product[];
  setProducts: (p: Product[]) => void;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  settings: AppSettings;
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  employees: Employee[];
  onNavigateToStaff: () => void;
  clients: Client[];
  onSaveClients: (clients: Client[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  onSaveOrders?: (orders: Order[]) => Promise<boolean | void>;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  onSaveProducts?: (products: Product[]) => Promise<void>;
  onSaveExpenses?: (expenses: Expense[]) => Promise<void>;
  onAddJournalEvent?: (event: JournalEvent) => Promise<void>;
}

// ... (FlyingIcon component remains unchanged)

interface FlyingIconProps {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  onComplete: () => void;
}

const FlyingIcon: React.FC<FlyingIconProps> = ({
  startX, startY, targetX, targetY, onComplete
}) => {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: startX,
    top: startY,
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
    zIndex: 100,
    transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
  });

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setStyle({
        position: 'fixed',
        left: targetX,
        top: targetY,
        opacity: 0,
        transform: 'translate(-50%, -50%) scale(0.2)',
        zIndex: 100,
        transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
      });
    });

    const timer = setTimeout(onComplete, 600);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
    };
  }, [targetX, targetY, onComplete]);

  return (
    <div style={style} className="text-emerald-400 pointer-events-none">
      <Package size={24} fill="currentColor" fillOpacity={0.2} />
    </div>
  );
};

export const Sales: React.FC<SalesProps> = ({ products, setProducts, orders, setOrders, settings, expenses, setExpenses, employees, onNavigateToStaff, clients, onSaveClients, transactions, setTransactions, onSaveOrders, onSaveTransactions, onSaveProducts, onSaveExpenses, onAddJournalEvent }) => {
  const toast = useToast();
  // Mode: 'sale' or 'expense' or 'return'
  const [mode, setMode] = useState<'sale' | 'expense' | 'return'>('sale');

  // Client Modal State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState<Partial<Client>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: 0,
    notes: ''
  });

  const handleSaveClient = () => {
    if (!newClientData.name || !newClientData.phone) {
      toast.warning('Имя и Телефон обязательны!');
      return;
    }

    const newClient: Client = {
      id: Date.now().toString(),
      ...newClientData as Client
    };

    onSaveClients([...clients, newClient]);
    setCustomerName(newClient.name); // Auto-select
    setIsClientModalOpen(false);
    setNewClientData({ name: '', phone: '', email: '', address: '', creditLimit: 0, notes: '' });
  };

  // Sale State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<string>('default');
  const [exchangeRate, setExchangeRate] = useState<number>(settings.defaultExchangeRate);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card' | 'debt'>('cash');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'UZS'>('UZS'); // Default to UZS for cash

  // Expense State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Прочее');
  const [expenseMethod, setExpenseMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [expenseCurrency, setExpenseCurrency] = useState<'USD' | 'UZS'>('UZS');
  const [withVat, setWithVat] = useState(false);
  const [expenseVatAmount, setExpenseVatAmount] = useState('');

  // Return State
  const [returnClientName, setReturnClientName] = useState('');
  const [returnProductName, setReturnProductName] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnMethod, setReturnMethod] = useState<'cash' | 'debt'>('cash');

  // Animation State
  const [flyingItems, setFlyingItems] = useState<{ id: number, startX: number, startY: number, targetX: number, targetY: number }[]>([]);

  // Receipt Modal State
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  // Mobile Cart Modal State
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  useEffect(() => {
    setExchangeRate(settings.defaultExchangeRate);
  }, [settings.defaultExchangeRate]);

  const toUZS = (usd: number) => Math.round(usd * exchangeRate);
  const toUSD = (uzs: number) => exchangeRate > 0 ? uzs / exchangeRate : 0;

  // --- Balance Calculations ---
  const calculateBalance = () => {
    // 1. Cash USD
    // Include orders with paymentCurrency === 'USD' OR undefined (legacy orders assumed USD)
    const cashInUSD = orders
      .filter(o => o.paymentMethod === 'cash' && (o.paymentCurrency === 'USD' || !o.paymentCurrency))
      .reduce((sum, o) => sum + o.amountPaid, 0);

    // Cash Out: Expenses + Supplier Payments
    const cashOutUSDExpenses = expenses
      .filter(e => e.paymentMethod === 'cash' && e.currency === 'USD')
      .reduce((sum, e) => sum + e.amount, 0);
    const cashOutUSDSuppliers = transactions
      .filter(t => t.type === 'supplier_payment' && t.method === 'cash' && t.currency === 'USD')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashOutUSD = cashOutUSDExpenses + cashOutUSDSuppliers;
    const balanceCashUSD = cashInUSD - cashOutUSD;

    // 2. Cash UZS
    // Note: Orders store amountPaid in USD. We need to convert back to UZS for display if it was paid in UZS.
    // Ideally we should have stored amountPaidUZS. But we can approximate: amountPaid * exchangeRate (at time of order).
    // For now, let's use the current exchange rate for simplicity or the stored totalAmountUZS if fully paid.
    // Better: use totalAmountUZS for paid orders.
    const cashInUZS = orders
      .filter(o => o.paymentMethod === 'cash' && o.paymentCurrency === 'UZS')
      .reduce((sum, o) => sum + o.totalAmountUZS, 0); // Using stored UZS total

    // Cash Out UZS: Expenses + Supplier Payments
    const cashOutUZSExpenses = expenses
      .filter(e => e.paymentMethod === 'cash' && e.currency === 'UZS')
      .reduce((sum, e) => {
        // If exchangeRate exists, amount is in UZS. If missing (legacy), amount is USD -> convert to UZS
        return sum + (e.exchangeRate ? e.amount : (e.amount * exchangeRate));
      }, 0);
    const cashOutUZSSuppliers = transactions
      .filter(t => t.type === 'supplier_payment' && t.method === 'cash' && t.currency === 'UZS')
      .reduce((sum, t) => {
        // Supplier payments in UZS - amount is already in UZS
        return sum + t.amount;
      }, 0);
    const cashOutUZS = cashOutUZSExpenses + cashOutUZSSuppliers;
    const balanceCashUZS = cashInUZS - cashOutUZS;

    // 3. Bank UZS
    const bankInUZS = orders
      .filter(o => o.paymentMethod === 'bank')
      .reduce((sum, o) => sum + o.totalAmountUZS, 0);

    // Bank Out: Expenses + Supplier Payments
    const bankOutUZSExpenses = expenses
      .filter(e => e.paymentMethod === 'bank')
      .reduce((sum, e) => {
        // Bank expenses are usually UZS. If stored as USD (legacy), convert.
        // If currency is USD, we might need to handle that too, but here we assume bank is UZS based on previous logic?
        // Wait, previous logic: .filter(e => e.paymentMethod === 'bank').reduce((sum, e) => sum + (e.amount * exchangeRate), 0);
        // This implies ALL bank expenses were treated as USD and converted to UZS.
        // Now, if currency is UZS, we use amount. If USD, we convert.
        if (e.currency === 'UZS') {
          return sum + (e.exchangeRate ? e.amount : (e.amount * exchangeRate));
        } else {
          return sum + (e.amount * exchangeRate);
        }
      }, 0);
    const bankOutUZSSuppliers = transactions
      .filter(t => t.type === 'supplier_payment' && t.method === 'bank')
      .reduce((sum, t) => {
        // Supplier payments are in USD, convert to UZS using exchangeRate from transaction or current rate
        const rate = t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : exchangeRate;
        const amountUZS = t.currency === 'UZS' ? t.amount : (t.amount * rate);
        return sum + amountUZS;
      }, 0);
    const bankOutUZS = bankOutUZSExpenses + bankOutUZSSuppliers;
    const balanceBankUZS = bankInUZS - bankOutUZS;

    // 4. Card UZS
    const cardInUZS = orders
      .filter(o => o.paymentMethod === 'card')
      .reduce((sum, o) => sum + o.totalAmountUZS, 0);

    // Card Out: Only expenses (suppliers usually don't accept card)
    const cardOutUZS = expenses
      .filter(e => e.paymentMethod === 'card')
      .reduce((sum, e) => {
        if (e.currency === 'UZS') {
          return sum + (e.exchangeRate ? e.amount : (e.amount * exchangeRate));
        } else {
          return sum + (e.amount * exchangeRate);
        }
      }, 0);
    const balanceCardUZS = cardInUZS - cardOutUZS;

    return { balanceCashUSD, balanceCashUZS, balanceBankUZS, balanceCardUZS };
  };

  const balances = calculateBalance();

  // --- Sale Logic ---
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) return;

    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      priceAtSale: product.pricePerUnit,
      costAtSale: product.costPrice || 0,
      unit: product.unit,
      total: product.pricePerUnit
    };
    setCart([...cart, newItem]);
  };

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>, product: Product) => {
    addToCart(product);
    const btnRect = e.currentTarget.getBoundingClientRect();

    // Check if mobile (screen width < 1024px)
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
      // On mobile, open cart modal and animate to floating button position
      setIsCartModalOpen(true);
      setFlyingItems(prev => [...prev, {
        id: Date.now(),
        startX: btnRect.left + btnRect.width / 2,
        startY: btnRect.top + btnRect.height / 2,
        targetX: window.innerWidth - 24 - 16, // Right side where floating button is (right-6 = 24px, button size ~16px)
        targetY: window.innerHeight - 24 - 16  // Bottom where floating button is (bottom-6 = 24px)
      }]);
    } else {
      // On desktop, animate to cart sidebar
      const cartTarget = document.getElementById('cart-target');
      if (cartTarget) {
        const cartRect = cartTarget.getBoundingClientRect();
        setFlyingItems(prev => [...prev, {
          id: Date.now(),
          startX: btnRect.left + btnRect.width / 2,
          startY: btnRect.top + btnRect.height / 2,
          targetX: cartRect.left + cartRect.width / 2,
          targetY: cartRect.top + cartRect.height / 2
        }]);
      }
    }
  };

  const removeFlyingItem = (id: number) => {
    setFlyingItems(prev => prev.filter(item => item.id !== id));
  };

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

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.productId !== id));
  };

  const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
  const vatAmountUSD = subtotalUSD * (settings.vatRate / 100);
  const totalAmountUSD = subtotalUSD + vatAmountUSD;
  const totalAmountUZS = toUZS(totalAmountUSD);

  const completeOrder = async () => {
    if (cart.length === 0 || !customerName) return;

    // Проверка достаточности товара на складе
    const insufficientStock: string[] = [];
    cart.forEach(cartItem => {
      const product = products.find(p => p.id === cartItem.productId);
      if (!product) {
        insufficientStock.push(`${cartItem.productName} (товар не найден)`);
      } else if (product.quantity < cartItem.quantity) {
        insufficientStock.push(`${cartItem.productName} (запрошено: ${cartItem.quantity}, доступно: ${product.quantity})`);
      }
    });

    if (insufficientStock.length > 0) {
      toast.error(`Недостаточно товара на складе:\n${insufficientStock.join('\n')}\n\nПожалуйста, обновите количество в корзине.`);
      return;
    }

    const isDebt = paymentMethod === 'debt';
    const amountPaid = isDebt ? 0 : totalAmountUSD;
    const paymentStatus = isDebt ? 'unpaid' : 'paid';

    // Determine currency
    let finalCurrency: 'USD' | 'UZS' | undefined = undefined;
    if (paymentMethod === 'cash') finalCurrency = paymentCurrency;
    else if (paymentMethod === 'debt') finalCurrency = 'USD'; // Debt is in USD
    else finalCurrency = 'UZS'; // Bank/Card are UZS

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString(),
      customerName,
      sellerName: sellerName || 'Администратор',
      items: [...cart],
      subtotalAmount: subtotalUSD,
      vatRateSnapshot: settings.vatRate,
      vatAmount: vatAmountUSD,
      totalAmount: totalAmountUSD,
      exchangeRate: exchangeRate,
      totalAmountUZS: totalAmountUZS,
      status: 'completed',
      paymentMethod,
      paymentStatus,
      amountPaid,
      paymentCurrency: finalCurrency
    };

    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.productId === p.id);
      if (cartItem) {
        return { ...p, quantity: p.quantity - cartItem.quantity };
      }
      return p;
    });

    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);

    // Update products locally and save to sheets
    setProducts(updatedProducts);
    if (onSaveProducts) {
      onSaveProducts(updatedProducts);
    }

    // Update Client Debt & Purchases (Auto-create if not exists)
    let clientIndex = clients.findIndex(c => c.name.toLowerCase() === customerName.toLowerCase());
    let currentClients = [...clients];
    let clientId = '';

    if (clientIndex === -1) {
      // Create new client
      const newClient: Client = {
        id: `CLI-${Date.now()}`,
        name: customerName,
        phone: '',
        creditLimit: 0,
        totalPurchases: 0,
        totalDebt: 0,
        notes: 'Автоматически создан при продаже'
      };
      currentClients = [...currentClients, newClient];
      clientIndex = currentClients.length - 1;
      clientId = newClient.id;
    } else {
      clientId = currentClients[clientIndex].id;
    }

    // Update the client stats
    const client = currentClients[clientIndex];
    currentClients[clientIndex] = {
      ...client,
      totalPurchases: (client.totalPurchases || 0) + totalAmountUSD,
      totalDebt: isDebt ? (client.totalDebt || 0) + totalAmountUSD : (client.totalDebt || 0)
    };

    await onSaveClients(currentClients);

    // Create Transaction for Debt History
    let transactionSaved = true;
    if (isDebt) {
      const newTransaction: Transaction = {
        id: `TRX-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'debt_obligation',
        amount: totalAmountUSD,
        currency: 'USD',
        method: 'debt',
        description: `Покупка в долг: Заказ #${newOrder.id}`,
        relatedId: clientId
      };
      const updatedTransactions = [...transactions, newTransaction];
      setTransactions(updatedTransactions);
      if (onSaveTransactions) {
        transactionSaved = await onSaveTransactions(updatedTransactions) ?? true;
      }
    }

    // Save orders to Google Sheets
    let orderSaved = true;
    if (onSaveOrders) {
      try {
        orderSaved = await onSaveOrders(updatedOrders) ?? true;
        console.log('✅ Заказ сохранен в Google Sheets:', newOrder.id, 'Метод оплаты:', paymentMethod);
      } catch (err) {
        console.error('❌ Ошибка при сохранении заказа:', err);
        orderSaved = false;
      }
    } else {
      console.warn('⚠️ onSaveOrders не передан, заказ сохранен только локально');
    }

    // Clear form
    setCart([]);
    setCustomerName('');
    setSellerName('');
    setPaymentMethod('cash');

    // Store last order for receipt printing
    setLastOrder(newOrder);
    setSelectedOrderForReceipt(newOrder);

    // Show receipt modal immediately after order completion
    setTimeout(() => {
      setShowReceiptModal(true);
    }, 300);

    // Show success message (non-blocking)
    if (orderSaved && transactionSaved) {
      // Success - modal will show receipt
    } else {
      toast.warning(`⚠️ Заказ оформлен, но произошла ошибка при сохранении в Google Sheets.\n\nСумма: ${totalAmountUZS.toLocaleString()} сўм ($${totalAmountUSD.toFixed(2)})\nМетод оплаты: ${paymentMethod === 'debt' ? 'Долг (USD)' : paymentMethod === 'cash' ? `Наличные (${paymentCurrency})` : paymentMethod === 'card' ? 'Карта (UZS)' : 'Перечисление (UZS)'}\nЗаказ #${newOrder.id}`);
    }

    // Log to Journal
    if (onAddJournalEvent) {
      const journalEvent: JournalEvent = {
        id: `JE-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'employee_action',
        employeeName: sellerName || 'Администратор',
        action: 'Создан заказ',
        description: `Продажа на сумму ${totalAmountUZS.toLocaleString()} сўм ($${totalAmountUSD.toFixed(2)}) клиенту ${customerName}. Товаров: ${cart.length}. Метод оплаты: ${paymentMethod === 'debt' ? 'Долг' : paymentMethod === 'cash' ? 'Наличные' : paymentMethod === 'card' ? 'Карта' : 'Перечисление'}.`,
        module: 'sales',
        relatedType: 'order',
        relatedId: newOrder.id,
        receiptDetails: {
          orderId: newOrder.id,
          customerName: customerName,
          totalAmount: totalAmountUSD,
          itemsCount: cart.length,
          paymentMethod: paymentMethod,
          operation: 'created'
        }
      };
      onAddJournalEvent(journalEvent);
    }
  };

  // --- Receipt Printing ---
  const handlePrintReceipt = async (order: Order) => {
    // Create receipt HTML
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
          ${order.items.map(item => {
      const itemTotalUZS = item.total * order.exchangeRate;
      const itemPriceUZS = item.priceAtSale * order.exchangeRate;
      return `
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span style="font-weight: bold;">${item.productName}</span>
                <span>${itemTotalUZS.toLocaleString()} сўм</span>
              </div>
              <div style="font-size: 11px; color: #666; margin-left: 10px;">
                ${item.quantity} ${item.unit} × ${itemPriceUZS.toLocaleString()} сўм
              </div>
            </div>
          `;
    }).join('')}
        </div>
        
        <div style="margin-bottom: 10px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Подытог:</span>
            <span>${(order.subtotalAmount * order.exchangeRate).toLocaleString()} сўм</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>НДС (${order.vatRateSnapshot}%):</span>
            <span>${(order.vatAmount * order.exchangeRate).toLocaleString()} сўм</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; font-size: 14px;">
            <span>ИТОГО:</span>
            <span>${order.totalAmountUZS.toLocaleString()} сўм</span>
          </div>
        </div>
        
        <div style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 15px; font-size: 11px;">
          <p style="margin: 3px 0;"><strong>Способ оплаты:</strong> ${order.paymentMethod === 'cash' ? `Наличные (${order.paymentCurrency || 'UZS'})` :
        order.paymentMethod === 'card' ? 'Карта (UZS)' :
          order.paymentMethod === 'bank' ? 'Перечисление (UZS)' :
            'Долг (USD)'
      }</p>
          <p style="margin: 3px 0;"><strong>Статус:</strong> ${order.paymentStatus === 'paid' ? 'Оплачено' : order.paymentStatus === 'unpaid' ? 'Не оплачено' : 'Частично оплачено'}</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 10px; color: #666;">
          <p style="margin: 3px 0;">Спасибо за покупку!</p>
          <p style="margin: 3px 0;">${new Date().toLocaleString('ru-RU')}</p>
        </div>
      </div>
    `;

    // Create temporary element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = receiptHTML;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
      const element = document.getElementById('receipt-content') || tempDiv.querySelector('#receipt-content') || tempDiv;
      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', [80, 200]); // Small receipt size
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const pdfHeight = imgHeight * ratio;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Чек_${order.id}_${new Date().toISOString().split('T')[0]}.pdf`);

      // Also open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Чек ${order.id}</title>
              <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                @media print {
                  @page { size: 80mm auto; margin: 0; }
                }
              </style>
            </head>
            <body>${receiptHTML}</body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (err) {
      console.error('Ошибка при печати чека:', err);
      toast.error('Ошибка при создании чека. Попробуйте снова.');
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  // --- Expense Logic ---
  const handleAddExpense = async () => {
    if (!expenseDesc || !expenseAmount) return;

    const amountVal = parseFloat(expenseAmount);

    const newExpense: Expense = {
      id: `EXP-${Date.now()}`,
      date: new Date().toISOString(),
      description: expenseDesc,
      amount: amountVal, // Save in original currency
      category: expenseCategory,
      paymentMethod: expenseMethod,
      currency: expenseCurrency,
      exchangeRate: exchangeRate, // Save current rate
      vatAmount: withVat && expenseVatAmount ? parseFloat(expenseVatAmount) : 0 // Save in original currency
    };

    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);

    // Save to Google Sheets
    if (onSaveExpenses) {
      try {
        await onSaveExpenses(updatedExpenses);
      } catch (err) {
        console.error('Ошибка при сохранении расхода:', err);
        toast.warning('Расход добавлен локально, но не удалось сохранить в Google Sheets');
      }
    }

    setExpenseDesc('');
    setExpenseAmount('');
    setWithVat(false);
    setExpenseVatAmount('');
    toast.success('Расход добавлен!');
  };

  const handleReturnSubmit = () => {
    if (!returnClientName || !returnProductName || !returnQuantity) {
      toast.warning('Заполните все поля!');
      return;
    }

    const product = products.find(p => p.name === returnProductName);
    const client = clients.find(c => c.name === returnClientName);
    const qty = Number(returnQuantity);

    if (!product) {
      toast.error('Товар не найден!');
      return;
    }
    if (qty <= 0) {
      toast.error('Некорректное количество!');
      return;
    }

    if (returnMethod === 'debt' && !client) {
      toast.error('Клиент не найден! Невозможно списать с долга.');
      return;
    }

    // 1. Update Stock
    const updatedProducts = products.map(p => {
      if (p.id === product.id) {
        return { ...p, quantity: p.quantity + qty };
      }
      return p;
    });
    setProducts(updatedProducts);
    if (onSaveProducts) {
      onSaveProducts(updatedProducts);
    }

    // 2. Financial Impact
    const returnAmountUSD = qty * product.pricePerUnit; // Using current price for simplicity

    if (returnMethod === 'debt') {
      // Decrease Client Debt
      if (client) {
        const updatedClients = clients.map(c => {
          if (c.id === client.id) {
            return { ...c, totalDebt: Math.max(0, (c.totalDebt || 0) - returnAmountUSD) };
          }
          return c;
        });
        onSaveClients(updatedClients);
      }
    }

    // Always create a transaction record for the return (even if debt) for history?
    // If debt, we already updated client debt. But a history record is good.
    if (returnMethod === 'debt') {
      const newTransaction: Transaction = {
        id: `TRX-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'client_return',
        amount: returnAmountUSD,
        currency: 'USD',
        method: 'debt',
        description: `Возврат на долг: ${product.name} (${qty} ${product.unit})`,
        relatedId: client ? client.id : undefined
      };
      const updatedTransactions = [...transactions, newTransaction];
      setTransactions(updatedTransactions);
      if (onSaveTransactions) {
        onSaveTransactions(updatedTransactions);
      }
    } else {
      // Save cash return transaction
      const newTransaction: Transaction = {
        id: `TRX-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'client_return',
        amount: returnAmountUSD,
        currency: 'USD',
        method: 'cash',
        description: `Возврат товара: ${product.name} (${qty} ${product.unit})`,
        relatedId: client ? client.id : undefined
      };
      const updatedTransactions = [...transactions, newTransaction];
      setTransactions(updatedTransactions);
      if (onSaveTransactions) {
        onSaveTransactions(updatedTransactions);
      }
    }

    toast.success(`Возврат оформлен!\nТовар: ${product.name} (+${qty})\nСумма: $${returnAmountUSD.toFixed(2)}`);
    setMode('sale');
    setReturnClientName('');
    setReturnProductName('');
    setReturnQuantity('');
  };

  // --- Render ---
  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.quantity > 0)
    .sort((a, b) => {
      switch (sortOption) {
        case 'price-asc': return a.pricePerUnit - b.pricePerUnit;
        case 'price-desc': return b.pricePerUnit - a.pricePerUnit;
        case 'qty-asc': return a.quantity - b.quantity;
        case 'qty-desc': return b.quantity - a.quantity;
        default: return 0;
      }
    });

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar: Balances */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Wallet size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Касса (USD)</p>
            <p className="text-lg font-mono font-bold text-white">${balances.balanceCashUSD.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Wallet size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Касса (UZS)</p>
            <p className="text-lg font-mono font-bold text-white">{balances.balanceCashUZS.toLocaleString()} сўм</p>
          </div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500"><Building2 size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Р/С (UZS)</p>
            <p className="text-lg font-mono font-bold text-white">{balances.balanceBankUZS.toLocaleString()} сўм</p>
          </div>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><CreditCard size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Карта (UZS)</p>
            <p className="text-lg font-mono font-bold text-white">{balances.balanceCardUZS.toLocaleString()} сўм</p>
          </div>
        </div>
      </div>

      {/* Recent Orders Section - Quick Access to Receipts */}
      {/* Desktop: Top position */}
      {orders.length > 0 && mode === 'sale' && (
        <div className="hidden lg:block bg-slate-800 border-b border-slate-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-slate-400" />
              <span className="text-sm text-slate-400">Последние заказы:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {orders.slice(0, 5).map(order => (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderForReceipt(order);
                    setShowReceiptModal(true);
                  }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5"
                  title={`Чек ${order.id} - ${order.customerName}`}
                >
                  <FileText size={12} />
                  {order.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 relative overflow-hidden">
        {/* Animation Layer */}
        {flyingItems.map(item => (
          <FlyingIcon key={item.id} {...item} onComplete={() => removeFlyingItem(item.id)} />
        ))}

        {/* Left Column: Content based on Mode */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
          {/* Mode Switcher */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('sale')}
              className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'sale' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <ArrowDownRight size={20} /> Новая Продажа
            </button>
            <button
              onClick={() => setMode('expense')}
              className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'expense' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <ArrowUpRight size={20} /> Новый Расход
            </button>
            <button
              onClick={() => setMode('return')}
              className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${mode === 'return' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <RefreshCw size={20} /> Возврат
            </button>
          </div>

          {mode === 'sale' ? (
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              {/* Search & Filters */}
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Поиск товара..."
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <div className="relative">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 pl-4 pr-10 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none appearance-none h-full cursor-pointer hover:bg-slate-750"
                  >
                    <option value="default">По умолчанию</option>
                    <option value="price-asc">Цена: Низкая &rarr; Высокая</option>
                    <option value="price-desc">Цена: Высокая &rarr; Низкая</option>
                    <option value="qty-asc">Остаток: Мало &rarr; Много</option>
                    <option value="qty-desc">Остаток: Много &rarr; Мало</option>
                  </select>
                  <ArrowUpDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredProducts.map(product => {
                    const priceUZS = toUZS(product.pricePerUnit);
                    return (
                      <div key={product.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl hover:border-primary-500/50 transition-colors flex flex-col justify-between group">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-white flex items-center gap-2">
                              {product.name}
                              {product.origin === 'import' && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">ИМПОРТ</span>
                              )}
                            </h3>
                            <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">{product.dimensions}</span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">Сталь: {product.steelGrade}</p>
                          <div className="flex justify-between items-end mt-4">
                            <div>
                              <span className="text-lg font-mono font-bold text-emerald-400 block">{priceUZS.toLocaleString()} сўм</span>
                              <span className="text-xs text-slate-500">${product.pricePerUnit.toFixed(2)} / {product.unit}</span>
                            </div>
                            <span className="text-sm text-slate-400">Остаток: {product.quantity}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          className="mt-4 w-full bg-slate-700 hover:bg-primary-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-all opacity-80 group-hover:opacity-100 active:scale-95"
                        >
                          <Plus size={16} /> В корзину
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            // Expense Form
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-6 overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="text-red-500" /> Оформление Расхода
              </h3>
              <div className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Описание расхода</label>
                  <input
                    type="text"
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    placeholder="Например: Аренда офиса"
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Сумма</label>
                    <input
                      type="number"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Валюта</label>
                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-600">
                      <button
                        onClick={() => setExpenseCurrency('UZS')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${expenseCurrency === 'UZS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        UZS
                      </button>
                      <button
                        onClick={() => setExpenseCurrency('USD')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${expenseCurrency === 'USD' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        USD
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Источник средств</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setExpenseMethod('cash')}
                      className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                    >
                      Наличные
                    </button>
                    <button
                      onClick={() => setExpenseMethod('bank')}
                      className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                    >
                      Р/С (Банк)
                    </button>
                    <button
                      onClick={() => setExpenseMethod('card')}
                      className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                    >
                      Карта
                    </button>
                  </div>
                </div>

                {/* VAT Checkbox & Input (Only for Bank Transfer) */}
                {expenseMethod === 'bank' && (
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="withVat"
                        checked={withVat}
                        onChange={e => {
                          setWithVat(e.target.checked);
                          if (e.target.checked && expenseAmount) {
                            // Auto-calculate 12% included: Amount * 12/112
                            const amount = parseFloat(expenseAmount);
                            const vat = (amount * 12) / 112;
                            setExpenseVatAmount(vat.toFixed(2));
                          } else {
                            setExpenseVatAmount('');
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="withVat" className="text-sm text-slate-300 select-none cursor-pointer">
                        Учитывать НДС (12%)
                      </label>
                    </div>

                    {withVat && (
                      <div className="animate-fade-in">
                        <label className="text-xs font-medium text-slate-400 mb-1 block">Сумма НДС ({expenseCurrency})</label>
                        <input
                          type="number"
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="0.00"
                          value={expenseVatAmount}
                          onChange={e => setExpenseVatAmount(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          * НДС уже включен в общую сумму расхода, здесь мы просто выделяем его для отчета.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Категория</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
                  >
                    <option>Прочее</option>
                    <option>Аренда</option>
                    <option>Зарплата</option>
                    <option>Транспорт</option>
                    <option>Налоги</option>
                    <option>Маркетинг</option>
                  </select>
                </div>

                <button
                  onClick={handleAddExpense}
                  className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-600/20 transition-all mt-4"
                >
                  Добавить Расход
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Recent Orders - Bottom position, Compact */}
        {orders.length > 0 && mode === 'sale' && (
          <div className="lg:hidden bg-slate-800 border-t border-slate-700 px-3 py-2 col-span-full">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400">Последние чеки:</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {orders.slice(0, 5).map(order => (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderForReceipt(order);
                    setShowReceiptModal(true);
                  }}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1 flex-shrink-0"
                  title={`Чек ${order.id} - ${order.customerName}`}
                >
                  <FileText size={10} />
                  <span className="hidden sm:inline">{order.id}</span>
                  <span className="sm:hidden">{order.id.split('-')[1]?.slice(-6) || order.id.slice(-6)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Column: Cart (Desktop - Always visible in Sale mode) */}
        {/* User wants "Cash Register" to handle sales. So Cart is essential. */}
        {mode === 'sale' && (
          <div className="hidden lg:flex bg-slate-800 border border-slate-700 rounded-2xl flex flex-col shadow-2xl shadow-black/20 overflow-hidden h-full">
            <div id="cart-target" className="p-6 border-b border-slate-700 bg-slate-900/50 relative transition-colors duration-300 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 z-10">
                <ShoppingCart className={`text-primary-500 transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} /> Корзина
              </h3>
              {/* Export buttons removed for brevity, can add back if needed */}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
                  <ShoppingCart size={48} />
                  <p>Корзина пуста</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="bg-slate-700/30 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 animate-fade-in">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-200 text-sm truncate max-w-[180px]">{item.productName}</span>
                      <button onClick={() => removeFromCart(item.productId)} className="text-slate-500 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
                        <input
                          type="number"
                          className="w-16 bg-transparent text-center text-sm text-white outline-none"
                          value={item.quantity}
                          onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                        />
                        <span className="text-xs text-slate-500 pr-2">{item.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-300 block">
                          {toUZS(item.total).toLocaleString()} сўм
                        </span>
                        <span className="text-xs text-slate-500">${item.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-slate-900 border-t border-slate-700 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1"><User size={12} /> Клиент</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Поиск или выбор клиента..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        list="clients-list"
                      />
                      <datalist id="clients-list">
                        {clients.map(c => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                    <button
                      onClick={() => setIsClientModalOpen(true)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors"
                      title="Новый клиент"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1"><User size={12} /> Продавец</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none appearance-none"
                      value={sellerName}
                      onChange={e => setSellerName(e.target.value)}
                    >
                      <option value="">Выберите продавца</option>
                      {employees
                        .filter(e => ['sales', 'manager', 'admin'].includes(e.role) && e.status === 'active')
                        .map(e => (
                          <option key={e.id} value={e.name}>{e.name}</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={onNavigateToStaff}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors"
                      title="Добавить сотрудника"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase">Способ оплаты</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Наличные
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Карта (UZS)
                  </button>
                  <button
                    onClick={() => setPaymentMethod('bank')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Перечисление (UZS)
                  </button>
                  <button
                    onClick={() => setPaymentMethod('debt')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Долг (USD)
                  </button>
                </div>

                {/* Currency Selector for Cash */}
                {paymentMethod === 'cash' && (
                  <div className="flex gap-2 mt-2 animate-fade-in">
                    <button
                      onClick={() => setPaymentCurrency('UZS')}
                      className={`flex-1 py-1 rounded text-xs border ${paymentCurrency === 'UZS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                    >
                      В Сумах (UZS)
                    </button>
                    <button
                      onClick={() => setPaymentCurrency('USD')}
                      className={`flex-1 py-1 rounded text-xs border ${paymentCurrency === 'USD' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                    >
                      В Долларах (USD)
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Подытог (без НДС):</span>
                  <span className="font-mono text-slate-300">${subtotalUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400">
                  <span className="">НДС ({settings.vatRate}%):</span>
                  <span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-slate-200 font-bold">ИТОГО (USD):</span>
                  <span className="font-mono text-slate-200 font-bold">${totalAmountUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-200 font-bold">К оплате (UZS):</span>
                  <span className="text-2xl font-bold text-emerald-400 font-mono">{totalAmountUZS.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={completeOrder}
                disabled={cart.length === 0 || !customerName}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle size={20} />
                {paymentMethod === 'debt' ? 'Оформить в долг' : 'Оформить и оплатить'}
              </button>

              {/* Receipt Buttons */}
              {lastOrder && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSelectedOrderForReceipt(lastOrder);
                      setShowReceiptModal(true);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                  >
                    <FileText size={16} />
                    Просмотр чека
                  </button>
                  <button
                    onClick={() => handlePrintReceipt(lastOrder)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    <Printer size={16} />
                    PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Return Modal */}
      {
        mode === 'return' && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl animate-scale-in">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <RefreshCw className="text-amber-500" /> Возврат товара
                </h3>
                <button onClick={() => setMode('sale')} className="text-slate-400 hover:text-white">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                {/* Client Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Клиент *</label>
                  <input
                    type="text"
                    placeholder="Выберите клиента..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    value={returnClientName}
                    onChange={e => setReturnClientName(e.target.value)}
                    list="return-clients-list"
                  />
                  <datalist id="return-clients-list">
                    {clients.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Товар *</label>
                  <input
                    type="text"
                    placeholder="Выберите товар..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    value={returnProductName}
                    onChange={e => setReturnProductName(e.target.value)}
                    list="return-products-list"
                  />
                  <datalist id="return-products-list">
                    {products.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Количество *</label>
                  <input
                    type="number"
                    value={returnQuantity}
                    onChange={e => setReturnQuantity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="0"
                  />
                </div>

                {/* Refund Method */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Метод возврата</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setReturnMethod('cash')}
                      className={`py-2 rounded-lg text-sm font-medium border transition-all ${returnMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                    >
                      Вернуть деньги (Нал)
                    </button>
                    <button
                      onClick={() => setReturnMethod('debt')}
                      className={`py-2 rounded-lg text-sm font-medium border transition-all ${returnMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                    >
                      Списать с долга
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleReturnSubmit}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-amber-600/20 transition-all mt-4"
                >
                  Оформить Возврат
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Receipt Modal */}
      {showReceiptModal && selectedOrderForReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReceiptModal(false);
              setSelectedOrderForReceipt(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md border border-gray-200 shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="text-blue-600" /> Чек продажи
                </h3>
                <p className="text-sm text-gray-600 mt-1">Заказ #{selectedOrderForReceipt.id}</p>
              </div>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setSelectedOrderForReceipt(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Receipt Content */}
              <div id="receipt-preview" className="bg-white text-black space-y-4">
                <div className="text-center border-b-2 border-gray-300 pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">METAL ERP</h2>
                  <p className="text-sm text-gray-600 mt-1">Чек продажи</p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Заказ:</span>
                    <span className="font-semibold">{selectedOrderForReceipt.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Дата:</span>
                    <span>{new Date(selectedOrderForReceipt.date).toLocaleString('ru-RU')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Клиент:</span>
                    <span className="font-medium">{selectedOrderForReceipt.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Продавец:</span>
                    <span>{selectedOrderForReceipt.sellerName}</span>
                  </div>
                </div>

                <div className="border-t border-b border-gray-300 py-4 space-y-3">
                  {selectedOrderForReceipt.items.map((item, idx) => {
                    const itemTotalUZS = item.total * selectedOrderForReceipt.exchangeRate;
                    const itemPriceUZS = item.priceAtSale * selectedOrderForReceipt.exchangeRate;
                    return (
                      <div key={idx} className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{item.productName}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {item.quantity} {item.unit} × {itemPriceUZS.toLocaleString()} сўм
                          </div>
                        </div>
                        <div className="font-mono font-semibold text-gray-900">{itemTotalUZS.toLocaleString()} сўм</div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Подытог:</span>
                    <span className="font-mono">{(selectedOrderForReceipt.subtotalAmount * selectedOrderForReceipt.exchangeRate).toLocaleString()} сўм</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>НДС ({selectedOrderForReceipt.vatRateSnapshot}%):</span>
                    <span className="font-mono">+{(selectedOrderForReceipt.vatAmount * selectedOrderForReceipt.exchangeRate).toLocaleString()} сўм</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t-2 border-gray-300 font-bold text-lg text-emerald-600">
                    <span>ИТОГО:</span>
                    <span className="font-mono">{selectedOrderForReceipt.totalAmountUZS.toLocaleString()} сўм</span>
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-4 space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Способ оплаты:</span>
                    <span className="font-medium">
                      {selectedOrderForReceipt.paymentMethod === 'cash'
                        ? `Наличные (${selectedOrderForReceipt.paymentCurrency || 'UZS'})`
                        : selectedOrderForReceipt.paymentMethod === 'card'
                          ? 'Карта (UZS)'
                          : selectedOrderForReceipt.paymentMethod === 'bank'
                            ? 'Перечисление (UZS)'
                            : 'Долг (USD)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Статус:</span>
                    <span className={`font-medium ${selectedOrderForReceipt.paymentStatus === 'paid' ? 'text-emerald-600' :
                      selectedOrderForReceipt.paymentStatus === 'unpaid' ? 'text-red-600' :
                        'text-amber-600'
                      }`}>
                      {selectedOrderForReceipt.paymentStatus === 'paid' ? 'Оплачено' :
                        selectedOrderForReceipt.paymentStatus === 'unpaid' ? 'Не оплачено' :
                          'Частично оплачено'}
                    </span>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-dashed border-gray-300 text-xs text-gray-500">
                  <p>Спасибо за покупку!</p>
                  <p className="mt-1">{new Date().toLocaleString('ru-RU')}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handlePrintReceipt(selectedOrderForReceipt)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-105"
                title="Скачать чек в формате PDF"
              >
                <FileText size={18} />
                Скачать PDF
              </button>
              <button
                onClick={() => {
                  const printContent = document.getElementById('receipt-preview');
                  if (printContent) {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Чек ${selectedOrderForReceipt.id}</title>
                            <style>
                              body { 
                                margin: 0; 
                                padding: 20px; 
                                font-family: Arial, sans-serif; 
                                background: white;
                                color: black;
                              }
                              @media print {
                                @page { 
                                  size: 80mm auto; 
                                  margin: 0; 
                                }
                                body { padding: 10px; }
                              }
                            </style>
                          </head>
                          <body>${printContent.innerHTML}</body>
                        </html>
                      `);
                      printWindow.document.close();
                      setTimeout(() => {
                        printWindow.print();
                      }, 250);
                    }
                  }
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-105"
                title="Распечатать чек"
              >
                <Printer size={18} />
                Печать
              </button>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setSelectedOrderForReceipt(null);
                }}
                className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all hover:scale-105"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Floating Button */}
      {mode === 'sale' && (
        <button
          onClick={() => setIsCartModalOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full p-4 shadow-2xl shadow-emerald-600/50 z-40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          aria-label="Открыть корзину"
        >
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
              {cart.length}
            </span>
          )}
        </button>
      )}

      {/* Mobile Cart Modal */}
      {mode === 'sale' && isCartModalOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setIsCartModalOpen(false)}>
          <div className="bg-slate-800 w-full max-h-[90vh] rounded-t-2xl flex flex-col shadow-2xl border-t border-slate-700 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div id="cart-target-mobile" className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingCart className={`text-primary-500 transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} />
                Корзина {cart.length > 0 && <span className="text-sm bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">({cart.length})</span>}
              </h3>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50 py-12">
                  <ShoppingCart size={48} />
                  <p>Корзина пуста</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="bg-slate-700/30 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 animate-fade-in">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-200 text-sm">{item.productName}</span>
                      <button onClick={() => removeFromCart(item.productId)} className="text-slate-500 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
                        <input
                          type="number"
                          className="w-16 bg-transparent text-center text-sm text-white outline-none"
                          value={item.quantity}
                          onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                        />
                        <span className="text-xs text-slate-500 pr-2">{item.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-300 block">
                          {toUZS(item.total).toLocaleString()} сўм
                        </span>
                        <span className="text-xs text-slate-500">${item.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer - Same as desktop */}
            <div className="p-4 bg-slate-900 border-t border-slate-700 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1"><User size={12} /> Клиент</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Поиск или выбор клиента..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        list="clients-list-mobile"
                      />
                      <datalist id="clients-list-mobile">
                        {clients.map(c => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                    <button
                      onClick={() => setIsClientModalOpen(true)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors"
                      title="Новый клиент"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1"><User size={12} /> Продавец</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none appearance-none"
                      value={sellerName}
                      onChange={e => setSellerName(e.target.value)}
                    >
                      <option value="">Выберите продавца</option>
                      {employees
                        .filter(e => ['sales', 'manager', 'admin'].includes(e.role) && e.status === 'active')
                        .map(e => (
                          <option key={e.id} value={e.name}>{e.name}</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={onNavigateToStaff}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 text-slate-400 hover:text-white transition-colors"
                      title="Добавить сотрудника"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase">Способ оплаты</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Наличные
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Карта (UZS)
                  </button>
                  <button
                    onClick={() => setPaymentMethod('bank')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Перечисление (UZS)
                  </button>
                  <button
                    onClick={() => setPaymentMethod('debt')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    Долг (USD)
                  </button>
                </div>

                {/* Currency Selector for Cash */}
                {paymentMethod === 'cash' && (
                  <div className="flex gap-2 mt-2 animate-fade-in">
                    <button
                      onClick={() => setPaymentCurrency('UZS')}
                      className={`flex-1 py-1 rounded text-xs border ${paymentCurrency === 'UZS' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                    >
                      В Сумах (UZS)
                    </button>
                    <button
                      onClick={() => setPaymentCurrency('USD')}
                      className={`flex-1 py-1 rounded text-xs border ${paymentCurrency === 'USD' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                    >
                      В Долларах (USD)
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Подытог (без НДС):</span>
                  <span className="font-mono text-slate-300">${subtotalUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400">
                  <span className="">НДС ({settings.vatRate}%):</span>
                  <span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-slate-200 font-bold">ИТОГО (USD):</span>
                  <span className="font-mono text-slate-200 font-bold">${totalAmountUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-200 font-bold">К оплате (UZS):</span>
                  <span className="text-2xl font-bold text-emerald-400 font-mono">{totalAmountUZS.toLocaleString()}</span>
                </div>
              </div>



              <button
                onClick={completeOrder}
                disabled={cart.length === 0 || !customerName}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle size={20} />
                {paymentMethod === 'debt' ? 'Оформить в долг' : 'Оформить и оплатить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};
