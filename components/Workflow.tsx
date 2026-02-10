import React, { useMemo, useState } from 'react';
import { Product, WorkflowOrder, OrderItem, Order, Client, Transaction, AppSettings, Employee, JournalEvent } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Trash2, Search, ClipboardList, BadgeCheck, Send, AlertTriangle, Wallet, Building2, CreditCard, XCircle, RotateCcw, Edit3 } from 'lucide-react';

interface WorkflowProps {
  products: Product[];
  setProducts: (p: Product[]) => void;
  workflowOrders: WorkflowOrder[];
  setWorkflowOrders: (o: WorkflowOrder[]) => void;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  clients: Client[];
  onSaveClients: (c: Client[]) => void;
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  employees: Employee[];
  settings: AppSettings;
  currentUserEmail?: string | null;
  onSaveOrders?: (orders: Order[]) => Promise<boolean | void>;
  onSaveProducts?: (products: Product[]) => Promise<void>;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  onSaveWorkflowOrders?: (workflowOrders: WorkflowOrder[]) => Promise<boolean | void>;
  onAddJournalEvent?: (event: JournalEvent) => Promise<void>;
  onNavigateToProcurement?: () => void;
}

type PaymentMethod = 'cash' | 'bank' | 'card' | 'debt';
type Currency = 'USD' | 'UZS';

export const Workflow: React.FC<WorkflowProps> = ({
  products,
  setProducts,
  workflowOrders,
  setWorkflowOrders,
  orders,
  setOrders,
  clients,
  onSaveClients,
  transactions,
  setTransactions,
  employees,
  settings,
  currentUserEmail,
  onSaveOrders,
  onSaveProducts,
  onSaveTransactions,
  onSaveWorkflowOrders,
  onAddJournalEvent,
  onNavigateToProcurement
}) => {
  const toast = useToast();
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  const currentEmployee = useMemo(
    () => employees.find(e => e.email?.toLowerCase() === (currentUserEmail || '').toLowerCase()),
    [employees, currentUserEmail]
  );

  // Если пользователь авторизован но нет в списке сотрудников - даём права sales по умолчанию
  const isSales = !currentEmployee || currentEmployee.role === 'sales' || currentEmployee.role === 'manager' || currentEmployee.role === 'admin';
  const isCashier = currentEmployee?.role === 'accountant' || currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  const [tab, setTab] = useState<'create' | 'queue' | 'cancelled'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<WorkflowOrder | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'UZS'>('USD'); // Валюта отображения в корзине

  // Create form
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [exchangeRate, setExchangeRate] = useState(settings.defaultExchangeRate || 12800);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('UZS');

  const toUZS = (usd: number) => Math.round(usd * (exchangeRate || 1));

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
      hasDiscount: totalDiscount > 0.01, // Есть скидка если разница больше 1 цента
      totalDiscount,
      discountPercent,
      priceListTotal,
      actualTotal
    };
  };

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.dimensions.toLowerCase().includes(q))
      .sort((a, b) => b.quantity - a.quantity);
  }, [products, searchTerm]);

  const addToCart = (p: Product) => {
    if (cart.some(i => i.productId === p.id)) return;
    const item: OrderItem = {
      productId: p.id,
      productName: p.name,
      dimensions: p.dimensions,
      quantity: 1,
      priceAtSale: p.pricePerUnit,
      costAtSale: p.costPrice || 0, // скрываем от продавца, но сохраняем для учета
      unit: p.unit,
      total: p.pricePerUnit
    };
    setCart(prev => [...prev, item]);
  };

  const updateQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const valid = Math.max(0, qty);
      return { ...i, quantity: valid, total: valid * i.priceAtSale };
    }));
  };

  const updatePrice = (productId: string, price: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const validPrice = Math.max(0, price);
      return { ...i, priceAtSale: validPrice, total: i.quantity * validPrice };
    }));
  };

  const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

  const subtotalUSD = cart.reduce((s, i) => s + i.total, 0);
  const vatAmountUSD = subtotalUSD * ((settings.vatRate || 0) / 100);
  const totalUSD = subtotalUSD + vatAmountUSD;
  const totalUZS = toUZS(totalUSD);

  const getMissingItems = (items: OrderItem[]) => {
    const missing: { item: OrderItem; available: number }[] = [];
    items.forEach(it => {
      const p = products.find(pp => pp.id === it.productId);
      const available = p?.quantity ?? 0;
      if (!p || available < it.quantity) {
        missing.push({ item: it, available });
      }
    });
    return missing;
  };

  const saveWorkflowOrders = async (next: WorkflowOrder[]) => {
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveWorkflowOrders?.(next);
    setWorkflowOrders(next);
  };

  const submitWorkflowOrder = async () => {
    if (!isSales) {
      toast.error('Нет прав: только отдел продаж может создавать заявки.');
      return;
    }
    if (!customerName.trim()) {
      toast.warning('Укажите клиента');
      return;
    }
    if (cart.length === 0) {
      toast.warning('Корзина пуста');
      return;
    }

    const missing = getMissingItems(cart);
    const status: WorkflowOrder['status'] = missing.length > 0 ? 'sent_to_procurement' : 'sent_to_cash';

    const isDebt = paymentMethod === 'debt';
    const amountPaid = isDebt ? 0 : totalUSD;
    const paymentStatus: WorkflowOrder['paymentStatus'] = isDebt ? 'unpaid' : 'paid';
    const finalCurrency: Currency | undefined =
      paymentMethod === 'cash' ? paymentCurrency : paymentMethod === 'debt' ? 'USD' : 'UZS';

    const wf: WorkflowOrder = {
      id: IdGenerator.workflow(),
      date: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      createdBy: currentEmployee?.name || currentEmployee?.email || currentUserEmail || 'sales',
      sellerId: currentEmployee?.id, // ID продавца для KPI
      sellerName: currentEmployee?.name || currentUserEmail || 'sales', // Имя продавца
      items: cart,
      subtotalAmount: subtotalUSD,
      vatRateSnapshot: settings.vatRate,
      vatAmount: vatAmountUSD,
      totalAmount: totalUSD,
      exchangeRate,
      totalAmountUZS: totalUZS,
      status,
      notes: notes.trim() || undefined,
      paymentMethod,
      paymentStatus,
      paymentCurrency: finalCurrency,
      amountPaid
    };

    await saveWorkflowOrders([wf, ...workflowOrders]);

    if (missing.length > 0) {
      toast.warning(`Заявка отправлена в закуп (нет остатка по ${missing.length} позициям).`);
      localStorage.setItem('procurement_active_tab', 'workflow');
      onNavigateToProcurement?.();
    } else {
      toast.success('Заявка отправлена в кассу.');
      setTab('queue');
    }

    // reset
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setPaymentMethod('cash');
    setPaymentCurrency('UZS');
  };

  const approveAndConvert = async (wf: WorkflowOrder) => {
    if (!isCashier) {
      toast.error('Нет прав: только кассир/финансист может подтверждать.');
      return;
    }

    const missing = getMissingItems(wf.items);
    if (missing.length > 0) {
      toast.warning('Недостаточно остатков. Заявка отправлена в закуп.');
      const next = workflowOrders.map(o => o.id === wf.id ? { ...o, status: 'sent_to_procurement' as const } : o);
      await saveWorkflowOrders(next);
      onNavigateToProcurement?.();
      return;
    }

    // Create Order (real sale)
    const newOrder: Order = {
      id: IdGenerator.order(),
      date: new Date().toISOString(),
      customerName: wf.customerName,
      sellerId: wf.sellerId, // ID продавца для KPI
      sellerName: wf.sellerName || wf.createdBy || 'Sales',
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

    // Deduct stock
    const updatedProducts = products.map(p => {
      const it = wf.items.find(i => i.productId === p.id);
      return it ? { ...p, quantity: p.quantity - it.quantity } : p;
    });
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveProducts?.(updatedProducts);
    setProducts(updatedProducts);

    // Update clients stats (auto-create if missing)
    let currentClients = [...clients];
    let idx = currentClients.findIndex(c => c.name.toLowerCase() === wf.customerName.toLowerCase());
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
      currentClients.push(c);
      idx = currentClients.length - 1;
      clientId = c.id;
    } else {
      clientId = currentClients[idx].id;
    }
    const isDebt = wf.paymentMethod === 'debt';
    currentClients[idx] = {
      ...currentClients[idx],
      totalPurchases: (currentClients[idx].totalPurchases || 0) + wf.totalAmount,
      totalDebt: isDebt ? (currentClients[idx].totalDebt || 0) + wf.totalAmount : (currentClients[idx].totalDebt || 0)
    };
    onSaveClients(currentClients);

    // Create transaction for debt obligation
    if (isDebt) {
      const trx: Transaction = {
        id: IdGenerator.transaction(),
        date: new Date().toISOString(),
        type: 'debt_obligation',
        amount: wf.totalAmount,
        currency: 'USD',
        method: 'debt',
        description: `Workflow → Долг: ${wf.id}`,
        relatedId: clientId
      };
      const updatedTx = [...transactions, trx];
      // CRITICAL: Save to Sheets FIRST, then update state
      await onSaveTransactions?.(updatedTx);
      setTransactions(updatedTx);
    }

    // Save orders
    const updatedOrders = [newOrder, ...orders];
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveOrders?.(updatedOrders);
    setOrders(updatedOrders);

    // Update workflow status
    const nextWorkflow = workflowOrders.map(o =>
      o.id === wf.id ? { ...o, status: 'completed' as const, convertedToOrderId: newOrder.id, convertedAt: new Date().toISOString() } : o
    );
    await saveWorkflowOrders(nextWorkflow);

    // Journal
    await onAddJournalEvent?.({
      id: IdGenerator.journalEvent(),
      date: new Date().toISOString(),
      type: 'employee_action',
      employeeName: currentEmployee?.name || 'Кассир',
      action: 'Workflow подтвержден',
      description: `Workflow ${wf.id} подтвержден. Создан заказ ${newOrder.id} на сумму ${wf.totalAmountUZS.toLocaleString()} сум.`,
      module: 'workflow',
      relatedType: 'workflow',
      relatedId: wf.id,
      metadata: { convertedTo: newOrder.id }
    });

    toast.success('Подтверждено: продажа создана и склад списан.');
  };

  // Редактирование аннулированного заказа
  const startEditCancelled = (wf: WorkflowOrder) => {
    setEditingOrder(wf);
    setCart([...wf.items]);
    setCustomerName(wf.customerName);
    setCustomerPhone(wf.customerPhone || '');
    setNotes(wf.notes || '');
    setExchangeRate(wf.exchangeRate);
    setPaymentMethod(wf.paymentMethod as PaymentMethod);
    setPaymentCurrency((wf.paymentCurrency || 'UZS') as Currency);
    setTab('create');
  };

  // Переотправить заказ (после редактирования)
  const resubmitOrder = async () => {
    if (!editingOrder) return;
    if (!customerName.trim()) {
      toast.warning('Укажите клиента');
      return;
    }
    if (cart.length === 0) {
      toast.warning('Корзина пуста');
      return;
    }

    const missing = getMissingItems(cart);
    const status: WorkflowOrder['status'] = missing.length > 0 ? 'sent_to_procurement' : 'sent_to_cash';

    const isDebt = paymentMethod === 'debt';
    const amountPaid = isDebt ? 0 : totalUSD;
    const paymentStatus: WorkflowOrder['paymentStatus'] = isDebt ? 'unpaid' : 'paid';
    const finalCurrency: Currency | undefined =
      paymentMethod === 'cash' ? paymentCurrency : paymentMethod === 'debt' ? 'USD' : 'UZS';

    // Обновляем существующий заказ (сохраняем оригинального продавца)
    const updatedWf: WorkflowOrder = {
      ...editingOrder,
      date: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      // Сохраняем оригинального продавца или ставим текущего если не было
      sellerId: editingOrder.sellerId || currentEmployee?.id,
      sellerName: editingOrder.sellerName || currentEmployee?.name || currentUserEmail || 'sales',
      items: cart,
      subtotalAmount: subtotalUSD,
      vatRateSnapshot: settings.vatRate,
      vatAmount: vatAmountUSD,
      totalAmount: totalUSD,
      exchangeRate,
      totalAmountUZS: totalUZS,
      status,
      notes: notes.trim() || undefined,
      paymentMethod,
      paymentStatus,
      paymentCurrency: finalCurrency,
      amountPaid
    };

    const nextWorkflow = workflowOrders.map(o => o.id === editingOrder.id ? updatedWf : o);
    await saveWorkflowOrders(nextWorkflow);

    // Journal
    await onAddJournalEvent?.({
      id: IdGenerator.journalEvent(),
      date: new Date().toISOString(),
      type: 'employee_action',
      employeeName: currentEmployee?.name || 'Продажи',
      action: 'Workflow переотправлен',
      description: `Аннулированный заказ ${editingOrder.id} был отредактирован и переотправлен.`,
      module: 'workflow',
      relatedType: 'workflow',
      relatedId: editingOrder.id
    });

    if (missing.length > 0) {
      toast.warning(`Заявка отправлена в закуп (нет остатка по ${missing.length} позициям).`);
      onNavigateToProcurement?.();
    } else {
      toast.success('Заявка переотправлена в кассу.');
    }

    // Reset
    setEditingOrder(null);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setPaymentMethod('cash');
    setPaymentCurrency('UZS');
    setTab('queue');
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setPaymentMethod('cash');
    setPaymentCurrency('UZS');
  };

  const statusBadge = (s: WorkflowOrder['status']) => {
    const base = 'text-[11px] font-bold px-2 py-1 rounded border';
    if (s === 'sent_to_cash') return `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`;
    if (s === 'sent_to_procurement') return `${base} bg-amber-500/10 text-amber-400 border-amber-500/20`;
    if (s === 'completed') return `${base} bg-blue-500/10 text-blue-400 border-blue-500/20`;
    if (s === 'cancelled') return `${base} bg-red-500/10 text-red-400 border-red-500/20`;
    return `${base} bg-slate-700/30 text-slate-300 border-slate-600/30`;
  };

  const statusLabel = (s: WorkflowOrder['status']) => {
    if (s === 'sent_to_cash') return 'На кассе';
    if (s === 'sent_to_procurement') return 'В закупе';
    if (s === 'completed') return 'Выполнен';
    if (s === 'cancelled') return 'Аннулирован';
    return s;
  };

  const queue = useMemo(() => {
    // Sales sees own + all if manager/admin
    const isManager = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';
    const list = isManager ? workflowOrders : workflowOrders.filter(o => (o.createdBy || '').toLowerCase().includes((currentEmployee?.name || currentEmployee?.email || '').toLowerCase()));
    return list.filter(o => o.status !== 'cancelled' && o.status !== 'completed');
  }, [workflowOrders, currentEmployee]);

  const cancelledOrders = useMemo(() => {
    const isManager = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';
    const list = isManager ? workflowOrders : workflowOrders.filter(o => (o.createdBy || '').toLowerCase().includes((currentEmployee?.name || currentEmployee?.email || '').toLowerCase()));
    return list.filter(o => o.status === 'cancelled');
  }, [workflowOrders, currentEmployee]);

  return (
    <div className="p-4 space-y-4 animate-fade-in h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${t.text}`}>
            <ClipboardList className={t.accent} size={24} /> Workflow
          </h2>
          <p className={`text-sm ${t.textMuted}`}>Продажи → касса/закуп</p>
        </div>
        <div className={`flex gap-1 ${t.bgCard} border ${t.border} rounded-lg p-1`}>
          <button
            onClick={() => setTab('create')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'create' 
                ? theme === 'light' ? 'bg-[#1A73E8] text-white' : 'bg-slate-700 text-white'
                : t.textMuted + ' hover:' + t.text
            }`}
          >
            Создать
          </button>
          <button
            onClick={() => setTab('queue')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'queue' 
                ? theme === 'light' ? 'bg-[#1A73E8] text-white' : 'bg-slate-700 text-white'
                : t.textMuted + ' hover:' + t.text
            }`}
          >
            Очередь ({queue.length})
          </button>
          <button
            onClick={() => setTab('cancelled')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'cancelled' 
                ? 'bg-red-500 text-white' 
                : t.textMuted + ' hover:' + t.text
            }`}
          >
            <span className="flex items-center gap-1">
              <XCircle size={12} /> Аннул. {cancelledOrders.length > 0 && `(${cancelledOrders.length})`}
            </span>
          </button>
        </div>
      </div>

      {tab === 'create' && (
        <div className="flex-1 flex flex-col min-h-0">
        {editingOrder && (
          <div className={`${t.warningBg} border ${theme === 'light' ? 'border-amber-200' : 'border-amber-500/30'} rounded-lg p-3 flex items-center justify-between mb-3 flex-shrink-0`}>
            <div className="flex items-center gap-2">
              <Edit3 className={t.warning} size={16} />
              <div>
                <div className={`${t.warning} font-medium text-sm`}>Редактирование #{editingOrder.id}</div>
              </div>
            </div>
            <button onClick={cancelEdit} className={`px-3 py-1 ${t.bgButton} ${t.text} rounded text-sm`}>
              Отмена
            </button>
          </div>
        )}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
          {/* Product List - 3 columns */}
          <div className="lg:col-span-3 flex flex-col min-h-0">
            <div className="relative mb-3 flex-shrink-0">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={16} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg pl-9 pr-4 py-2 ${t.text} outline-none ${t.focusRing} text-sm ${t.textPlaceholder}`}
                placeholder="Поиск товара..."
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredProducts.slice(0, 60).map(p => (
                  <div key={p.id} className={`${t.bgCard} border ${t.border} rounded-lg p-2 transition-colors ${theme === 'light' ? 'hover:border-[#1A73E8]/50 hover:shadow-md' : 'hover:border-primary-500/50'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-xs truncate ${t.text}`}>{p.name}</div>
                        <div className={`text-[10px] truncate ${t.textMuted}`}>{p.dimensions} • {p.steelGrade}</div>
                      </div>
                      <div className="text-right ml-1">
                        <div className={`${t.success} font-mono font-bold text-xs`}>${p.pricePerUnit.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] ${t.textMuted}`}>Ост: {p.quantity}</span>
                      <button
                        onClick={() => addToCart(p)}
                        className={`${theme === 'light' ? 'bg-slate-100 hover:bg-[#1A73E8] hover:text-white text-slate-700' : 'bg-slate-700 hover:bg-primary-600 text-white'} px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors`}
                      >
                        <Plus size={10} /> Добавить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart - 1 column */}
          <div className={`${t.bgCard} border ${t.border} rounded-xl overflow-hidden flex flex-col min-h-0 ${t.shadow}`} style={{ maxHeight: 'calc(100vh - 160px)' }}>
            <div className={`p-3 border-b ${t.border} ${t.bgPanelAlt} flex-shrink-0 flex items-center justify-between`}>
              <div className={`${t.text} font-bold text-sm`}>Заявка ({cart.length})</div>
              {/* Переключатель валюты отображения */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => setDisplayCurrency('USD')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${displayCurrency === 'USD' ? 'bg-emerald-500 text-white' : `${t.bgInput} ${t.textMuted}`}`}
                >
                  $
                </button>
                <button
                  onClick={() => setDisplayCurrency('UZS')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${displayCurrency === 'UZS' ? 'bg-blue-500 text-white' : `${t.bgInput} ${t.textMuted}`}`}
                >
                  сум
                </button>
              </div>
            </div>

            <div className={`p-3 space-y-2 flex-shrink-0 border-b ${t.border}`}>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded px-2 py-1.5 ${t.text} outline-none text-sm ${t.focusRing} ${t.textPlaceholder}`}
                placeholder="Клиент"
                list="wf-clients"
              />
              <datalist id="wf-clients">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              <div className="grid grid-cols-2 gap-1">
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`${t.bgInput} border ${t.borderInput} rounded px-2 py-1.5 ${t.text} outline-none text-xs ${t.focusRing} ${t.textPlaceholder}`}
                  placeholder="Телефон"
                />
                <input
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className={`${t.bgInput} border ${t.borderInput} rounded px-2 py-1.5 ${t.text} outline-none font-mono text-xs ${t.focusRing}`}
                  placeholder="Курс"
                  type="number"
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                <button onClick={() => setPaymentMethod('cash')} className={`px-1 py-1.5 rounded text-[10px] border transition-colors ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}>
                  Нал
                </button>
                <button onClick={() => setPaymentMethod('bank')} className={`px-1 py-1.5 rounded text-[10px] border transition-colors ${paymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-600' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}>
                  Банк
                </button>
                <button onClick={() => setPaymentMethod('card')} className={`px-1 py-1.5 rounded text-[10px] border transition-colors ${paymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-600' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}>
                  Карта
                </button>
                <button onClick={() => setPaymentMethod('debt')} className={`px-1 py-1.5 rounded text-[10px] border transition-colors ${paymentMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-600' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}>
                  Долг
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div className="flex gap-1">
                  <button onClick={() => setPaymentCurrency('UZS')} className={`flex-1 py-1 rounded text-[10px] border transition-colors ${paymentCurrency === 'UZS' ? `${t.bgButton} ${t.borderInput} ${t.text}` : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}>UZS</button>
                  <button onClick={() => setPaymentCurrency('USD')} className={`flex-1 py-1 rounded text-[10px] border transition-colors ${paymentCurrency === 'USD' ? `${t.bgButton} ${t.borderInput} ${t.text}` : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}>USD</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
              {cart.length === 0 ? (
                <div className={`${t.textMuted} text-center py-4 text-sm`}>Корзина пуста</div>
              ) : cart.map(it => (
                <div key={it.productId} className={`${t.bgPanelAlt} border ${t.border} rounded-lg px-2 py-1.5`}>
                  <div className="flex items-center gap-2">
                    {/* Название и размеры слева */}
                    <div className="min-w-0 w-16 flex-shrink-0">
                      <div className={`${t.text} text-[11px] font-medium truncate`}>{it.productName}</div>
                      {it.dimensions && it.dimensions !== '-' && (
                        <div className={`text-[9px] ${t.textMuted} truncate`}>{it.dimensions}</div>
                      )}
                    </div>
                    {/* Кол-во, Цена, Сумма в одну строку */}
                    <div className="flex items-center gap-1 flex-1">
                      <div className="flex-1">
                        <div className={`text-[8px] ${t.textMuted}`}>Кол-во</div>
                        <input
                          type="number"
                          className={`w-full ${t.bgInput} border ${t.borderInput} rounded px-1 py-0.5 ${t.text} font-mono text-[11px]`}
                          value={it.quantity}
                          onChange={(e) => updateQty(it.productId, Number(e.target.value))}
                        />
                      </div>
                      <div className="flex-1">
                        <div className={`text-[8px] ${t.textMuted}`}>Цена {displayCurrency === 'USD' ? '$' : 'сум'}</div>
                        <input
                          type="number"
                          step={displayCurrency === 'USD' ? '0.01' : '100'}
                          className={`w-full ${t.bgInput} border ${t.borderInput} rounded px-1 py-0.5 ${t.text} font-mono text-[11px]`}
                          value={displayCurrency === 'USD' ? it.priceAtSale : toUZS(it.priceAtSale)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updatePrice(it.productId, displayCurrency === 'USD' ? val : val / exchangeRate);
                          }}
                        />
                      </div>
                      <div className="w-16 text-right">
                        <div className={`text-[8px] ${t.textMuted}`}>Сумма</div>
                        <div className={`${t.success} font-mono font-bold text-[11px]`}>
                          {displayCurrency === 'USD' ? `$${it.total.toFixed(2)}` : `${toUZS(it.total).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                    {/* Кнопка удаления */}
                    <button onClick={() => removeItem(it.productId)} className={`${t.textMuted} hover:text-red-500 flex-shrink-0`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`p-3 border-t ${t.border} ${t.bgPanelAlt} space-y-1 flex-shrink-0`}>
              <div className={`flex justify-between text-xs ${t.textSecondary}`}>
                <span>Подытог</span>
                <span className="font-mono">
                  {displayCurrency === 'USD' ? `$${subtotalUSD.toFixed(2)}` : `${toUZS(subtotalUSD).toLocaleString()} сум`}
                </span>
              </div>
              <div className={`flex justify-between text-xs ${t.warning}`}>
                <span>НДС ({settings.vatRate}%)</span>
                <span className="font-mono">
                  +{displayCurrency === 'USD' ? `$${vatAmountUSD.toFixed(2)}` : `${toUZS(vatAmountUSD).toLocaleString()} сум`}
                </span>
              </div>
              <div className={`flex justify-between font-bold ${t.text} text-sm`}>
                <span>ИТОГО</span>
                <span className="font-mono">
                  {displayCurrency === 'USD' ? `$${totalUSD.toFixed(2)}` : `${totalUZS.toLocaleString()} сум`}
                </span>
              </div>
              {editingOrder ? (
                <button
                  onClick={resubmitOrder}
                  className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-sm"
                >
                  <RotateCcw size={14} /> Переотправить
                </button>
              ) : (
                <button
                  onClick={submitWorkflowOrder}
                  disabled={!isSales}
                  className={`w-full mt-2 py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-sm transition-colors ${
                    !isSales 
                      ? `${t.bgButton} cursor-not-allowed ${t.textMuted}` 
                      : theme === 'light' 
                        ? 'bg-[#1A73E8] hover:bg-[#1557B0] text-white'
                        : 'bg-primary-600 hover:bg-primary-500 text-white'
                  }`}
                >
                  <Send size={14} /> Отправить
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {queue.map(wf => {
              const discount = getOrderDiscount(wf.items);
              return (
              <div key={wf.id} className={`${t.bgCard} border ${discount.hasDiscount ? 'border-amber-500/50' : t.border} rounded-xl p-3 ${t.shadow}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`${t.text} font-bold text-sm`}>{wf.customerName}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>ID: {wf.id}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={statusBadge(wf.status)}>{statusLabel(wf.status)}</span>
                    {discount.hasDiscount && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        -{discount.discountPercent.toFixed(1)}% скидка
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-0.5 text-xs">
                  {(Array.isArray(wf.items) ? wf.items : []).slice(0, 3).map((it, idx) => {
                    const product = products.find(p => p.id === it.productId);
                    const priceListPrice = product?.pricePerUnit || it.priceAtSale;
                    const itemDiscount = priceListPrice > it.priceAtSale;
                    return (
                    <div key={idx} className={`flex justify-between ${t.textSecondary}`}>
                      <span className="truncate max-w-[140px]">
                        {it.productName}
                        <span className={`${t.textMuted} ml-1`}>× {it.quantity}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {itemDiscount && (
                          <span className="text-[9px] text-amber-500 line-through">${priceListPrice.toFixed(2)}</span>
                        )}
                        <span className={`font-mono text-[10px] ${itemDiscount ? 'text-amber-400 font-bold' : t.textMuted}`}>
                          ${it.priceAtSale.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                  {Array.isArray(wf.items) && wf.items.length > 3 && <div className={`text-[10px] ${t.textMuted}`}>+ ещё {wf.items.length - 3}</div>}
                </div>

                {/* Показываем инфо о скидке */}
                {discount.hasDiscount && (
                  <div className={`mt-2 p-1.5 rounded ${theme === 'light' ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                    <div className="flex justify-between text-[10px]">
                      <span className={t.textMuted}>По прайсу:</span>
                      <span className={`${t.textMuted} line-through font-mono`}>${discount.priceListTotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-amber-500 font-medium">Скидка:</span>
                      <span className="text-amber-500 font-mono font-bold">-${discount.totalDiscount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div className={`font-mono font-bold ${t.success} text-sm`}>{wf.totalAmountUZS.toLocaleString()} сум</div>
                  {wf.status === 'sent_to_procurement' && (
                    <button onClick={onNavigateToProcurement} className={`px-2 py-1 rounded ${t.warningBg} border ${theme === 'light' ? 'border-amber-200' : 'border-amber-500/20'} ${t.warning} text-[10px] font-medium`}>
                      В закуп
                    </button>
                  )}
                </div>

                {isCashier && wf.status === 'sent_to_cash' && (
                  <button onClick={() => approveAndConvert(wf)} className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-sm">
                    <BadgeCheck size={14} /> Подтвердить
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {queue.length === 0 && (
            <div className={`text-center ${t.textMuted} py-8`}>Заявок нет</div>
          )}
        </div>
      )}

      {tab === 'cancelled' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className={`${t.dangerBg} border ${theme === 'light' ? 'border-red-200' : 'border-red-500/20'} rounded-lg p-3 mb-3`}>
            <div className={`flex items-center gap-2 ${t.danger} text-sm`}>
              <XCircle size={14} />
              <span className="font-medium">Аннулированные заказы</span>
            </div>
            <p className={`text-xs ${t.textMuted} mt-1`}>Можно отредактировать и переотправить.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {cancelledOrders.map(wf => (
<div key={wf.id} className={`${t.bgCard} border ${theme === 'light' ? 'border-red-200' : 'border-red-500/30'} rounded-xl p-3 ${t.shadow}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`${t.text} font-bold text-sm`}>{wf.customerName}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    {wf.cancellationReason && (
                      <div className={`text-[10px] ${t.danger} mt-1 ${t.dangerBg} px-1.5 py-0.5 rounded truncate max-w-[180px]`}>
                        {wf.cancellationReason}
                      </div>
                    )}
                  </div>
                  <span className={statusBadge('cancelled')}>{statusLabel('cancelled')}</span>
                </div>

                <div className="mt-2 space-y-0.5 text-xs">
                  {(Array.isArray(wf.items) ? wf.items : []).slice(0, 3).map((it, idx) => (
                    <div key={idx} className={`flex justify-between ${t.textSecondary}`}>
                      <span className="truncate max-w-[160px]">
                        {it.productName} × {it.quantity}
                      </span>
                      <span className={`font-mono ${t.textMuted} text-[10px]`}>{toUZS(it.total).toLocaleString()}</span>
                    </div>
                  ))}
                  {Array.isArray(wf.items) && wf.items.length > 3 && <div className={`text-[10px] ${t.textMuted}`}>+ ещё {wf.items.length - 3}</div>}
                </div>

                <div className={`mt-2 font-mono font-bold ${t.textMuted} line-through text-sm`}>{wf.totalAmountUZS.toLocaleString()} сум</div>

                {isSales && (
                  <button onClick={() => startEditCancelled(wf)} className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-sm">
                    <Edit3 size={14} /> Редактировать
                  </button>
                )}
              </div>
            ))}
          </div>

          {cancelledOrders.length === 0 && (
            <div className={`text-center ${t.textMuted} py-8`}>Аннулированных заказов нет</div>
          )}
        </div>
      )}
    </div>
  );
};


