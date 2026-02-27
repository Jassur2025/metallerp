import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Product, WorkflowOrder, OrderItem, Order, Client, Transaction, AppSettings, Employee, JournalEvent, WarehouseLabels } from '../types';
import { DEFAULT_EXCHANGE_RATE } from '../constants';
import { IdGenerator } from '../utils/idGenerator';
import { findOrCreateClient } from '../services/clientService';
import { getMissingItems } from '../utils/inventoryHelpers';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Trash2, Search, ClipboardList, Send, RotateCcw, XCircle, Edit3, LayoutGrid, List } from 'lucide-react';
import { WorkflowQueueTab } from './Workflow/WorkflowQueueTab';
import { WorkflowCancelledTab } from './Workflow/WorkflowCancelledTab';

interface WorkflowProps {
  products: Product[];
  workflowOrders: WorkflowOrder[];
  orders: Order[];
  setOrders: (o: Order[]) => void;
  clients: Client[];
  onSaveClients: (c: Client[]) => void;
  transactions: Transaction[];
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
  workflowOrders,
  orders,
  setOrders,
  clients,
  onSaveClients,
  transactions,
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
  const [exchangeRate, setExchangeRate] = useState(settings.defaultExchangeRate || DEFAULT_EXCHANGE_RATE);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('UZS');
  const [wfViewMode, setWfViewMode] = useState<'grid' | 'list'>(() => {
    try { return (localStorage.getItem('erp_wf_product_view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; }
  });
  const toggleWfView = (mode: 'grid' | 'list') => {
    setWfViewMode(mode);
    try { localStorage.setItem('erp_wf_product_view', mode); } catch {}
  };

  // === Column resize logic ===
  const defaultColWidths = [100, 100, 60, 90, 90, 80, 60, 36];
  const [colWidths, setColWidths] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('erp_wf_col_widths_v2');
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length === 8) return parsed; }
    } catch {}
    return [...defaultColWidths];
  });
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colIndex;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[colIndex];

    const onMouseMove = (ev: MouseEvent) => {
      if (resizingCol.current === null) return;
      const delta = ev.clientX - resizeStartX.current;
      const newWidth = Math.max(30, resizeStartW.current + delta);
      setColWidths(prev => {
        const next = [...prev];
        next[resizingCol.current!] = newWidth;
        return next;
      });
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setColWidths(prev => {
        try { localStorage.setItem('erp_wf_col_widths_v2', JSON.stringify(prev)); } catch {}
        return prev;
      });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const colTemplate = colWidths.map((w, i) => i === 0 ? `minmax(${w}px, 1fr)` : `${w}px`).join(' ');
  // === End column resize logic ===

  // === Split pane resize (product list vs cart) ===
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try { const v = localStorage.getItem('erp_wf_split'); if (v) return Math.max(30, Math.min(80, Number(v))); } catch {}
    return 60;
  });
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const onSplitStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const onMouseMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(30, Math.min(80, pct));
      setSplitPercent(clamped);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSplitPercent(prev => {
        try { localStorage.setItem('erp_wf_split', String(Math.round(prev))); } catch {}
        return prev;
      });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);
  // === End split pane resize ===

  const toUZS = useCallback((usd: number) => Math.round(usd * (exchangeRate || 1)), [exchangeRate]);

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

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.dimensions.toLowerCase().includes(q))
      .sort((a, b) => b.quantity - a.quantity);
  }, [products, searchTerm]);

  const addToCart = useCallback((p: Product) => {
    setCart(prev => {
      if (prev.some(i => i.productId === p.id)) return prev;
      const item: OrderItem = {
        productId: p.id,
        productName: p.name,
        dimensions: p.dimensions,
        quantity: 1,
        priceAtSale: p.pricePerUnit,
        costAtSale: p.costPrice || 0,
        unit: p.unit,
        total: p.pricePerUnit
      };
      return [...prev, item];
    });
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const valid = Math.max(0, qty);
      return { ...i, quantity: valid, total: valid * i.priceAtSale };
    }));
  }, []);

  const updatePrice = useCallback((productId: string, price: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const validPrice = Math.max(0, price);
      return { ...i, priceAtSale: validPrice, total: i.quantity * validPrice };
    }));
  }, []);

  const removeItem = useCallback((productId: string) => setCart(prev => prev.filter(i => i.productId !== productId)), []);

  const { subtotalUSD, vatAmountUSD, totalUSD, totalUZS } = useMemo(() => {
    const sub = cart.reduce((s, i) => s + i.total, 0);
    const vat = sub * ((settings.vatRate || 0) / 100);
    const total = sub + vat;
    return { subtotalUSD: sub, vatAmountUSD: vat, totalUSD: total, totalUZS: Math.round(total * (exchangeRate || 1)) };
  }, [cart, settings.vatRate, exchangeRate]);

  const saveWorkflowOrders = async (next: WorkflowOrder[]) => {
    // CRITICAL: Save to Sheets FIRST, then update state
    await onSaveWorkflowOrders?.(next);
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

    const missing = getMissingItems(cart, products);
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

    const missing = getMissingItems(wf.items, products);
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

    // Update clients stats (auto-create if missing)
    const { client: foundClient, index: idx, clients: currentClients } = findOrCreateClient(
      clients, wf.customerName, wf.customerPhone || '', 'Автоматически создан из Workflow'
    );
    const clientId = foundClient.id;
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

    const missing = getMissingItems(cart, products);
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

  const statusBadge = useCallback((s: WorkflowOrder['status']) => {
    const base = 'text-[11px] font-bold px-2 py-1 rounded border';
    if (s === 'sent_to_cash') return `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`;
    if (s === 'sent_to_procurement') return `${base} bg-amber-500/10 text-amber-400 border-amber-500/20`;
    if (s === 'completed') return `${base} bg-blue-500/10 text-blue-400 border-blue-500/20`;
    if (s === 'cancelled') return `${base} bg-red-500/10 text-red-400 border-red-500/20`;
    return `${base} bg-slate-700/30 text-slate-300 border-slate-600/30`;
  }, []);

  const statusLabel = useCallback((s: WorkflowOrder['status']) => {
    if (s === 'sent_to_cash') return 'На кассе';
    if (s === 'sent_to_procurement') return 'В закупе';
    if (s === 'completed') return 'Выполнен';
    if (s === 'cancelled') return 'Аннулирован';
    return s;
  }, []);

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
        <div ref={splitContainerRef} className="flex-1 flex min-h-0 gap-0">
          {/* Product List */}
          <div className="flex flex-col min-h-0 min-w-0" style={{ width: `${splitPercent}%` }}>
            <div className="flex gap-2 mb-3 flex-shrink-0">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg pl-9 pr-4 py-2 ${t.text} outline-none ${t.focusRing} text-sm ${t.textPlaceholder}`}
                  placeholder="Поиск товара..."
                />
              </div>
              <div className={`flex ${t.bgInput} border ${t.borderInput} rounded-lg overflow-hidden`}>
                <button
                  onClick={() => toggleWfView('grid')}
                  className={`px-2 py-2 transition-colors ${wfViewMode === 'grid'
                    ? (theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-primary-500/20 text-primary-400')
                    : `${t.textMuted}`}`}
                  title="Сетка"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => toggleWfView('list')}
                  className={`px-2 py-2 transition-colors ${wfViewMode === 'list'
                    ? (theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-primary-500/20 text-primary-400')
                    : `${t.textMuted}`}`}
                  title="Список"
                >
                  <List size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {/* === GRID VIEW === */}
              {wfViewMode === 'grid' && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredProducts.slice(0, 60).map(p => (
                    <div key={p.id} className={`${t.bgCard} border ${t.border} rounded-lg p-2 transition-colors cursor-pointer ${theme === 'light' ? 'hover:border-[#1A73E8]/50 hover:shadow-md' : 'hover:border-primary-500/50'} group`}
                      onClick={() => addToCart(p)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-xs truncate ${t.text}`}>{p.name}</div>
                          <div className={`text-[10px] truncate ${t.textMuted}`}>{p.dimensions} • {p.steelGrade}</div>
                          {(p.manufacturer || p.warehouse) && (
                            <div className={`text-[10px] truncate ${t.textMuted}`}>
                              {p.manufacturer && <span>{p.manufacturer}</span>}
                              {p.manufacturer && p.warehouse && <span> • </span>}
                              {p.warehouse && <span>{WarehouseLabels[p.warehouse]}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-1">
                          <div className={`${t.success} font-mono font-bold text-xs`}>${p.pricePerUnit.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] ${t.textMuted}`}>Ост: {p.quantity}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                          className={`${theme === 'light' ? 'bg-slate-100 hover:bg-[#1A73E8] hover:text-white text-slate-700' : 'bg-slate-700 hover:bg-primary-600 text-white'} px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors`}
                        >
                          <Plus size={10} /> Добавить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* === LIST VIEW === */}
              {wfViewMode === 'list' && (
                <div className={`${t.bgCard} border ${t.border} rounded-lg overflow-hidden`} style={{ overflowX: 'auto' }}>
                  {/* Header */}
                  <div
                    className={`grid gap-0 px-3 py-1.5 ${theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-slate-800/60 border-b border-slate-700'} text-[10px] font-semibold uppercase ${t.textMuted}`}
                    style={{ gridTemplateColumns: colTemplate, minWidth: colWidths.reduce((a, b) => a + b, 0) }}
                  >
                    {['Товар', 'Размер', 'Сталь', 'Произв.', 'Склад', 'Цена', 'Ост.', ''].map((label, idx) => (
                      <span key={idx} className={`relative select-none px-1 ${idx >= 5 && idx <= 6 ? 'text-right' : ''}`}>
                        {label}
                        {idx < 7 && (
                          <span
                            onMouseDown={e => onResizeStart(e, idx)}
                            className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize z-10 hover:bg-blue-400/30"
                            style={{ touchAction: 'none' }}
                          />
                        )}
                      </span>
                    ))}
                  </div>
                  {filteredProducts.slice(0, 60).map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`grid gap-0 items-center px-3 py-1.5 transition-colors cursor-pointer group
                        ${i % 2 === 0 ? '' : (theme === 'light' ? 'bg-slate-50/50' : 'bg-slate-800/30')}
                        ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-slate-700/40'}`}
                      style={{ gridTemplateColumns: colTemplate, minWidth: colWidths.reduce((a, b) => a + b, 0) }}
                    >
                      <span className={`text-xs font-medium ${t.text} truncate px-1`}>{p.name}</span>
                      <span className={`text-xs font-bold font-mono ${t.text} truncate px-1`}>{p.dimensions}</span>
                      <span className={`text-[10px] ${t.textMuted} truncate px-1`}>{p.steelGrade}</span>
                      <span className={`text-[10px] ${t.textMuted} truncate px-1`}>{p.manufacturer || '—'}</span>
                      <span className={`text-[10px] ${t.textMuted} truncate px-1`}>{p.warehouse ? WarehouseLabels[p.warehouse] : '—'}</span>
                      <span className={`text-xs font-bold font-mono ${t.success} text-right truncate px-1`}>${p.pricePerUnit.toFixed(2)}</span>
                      <span className={`text-[10px] ${t.textMuted} text-right truncate px-1`}>{p.quantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100
                          ${theme === 'light' ? 'bg-blue-50 text-blue-500 hover:bg-blue-100' : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'}`}
                        title="Добавить"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Draggable divider */}
          <div
            onMouseDown={onSplitStart}
            className={`flex-shrink-0 w-[6px] cursor-col-resize group flex items-center justify-center hover:bg-blue-400/20 transition-colors mx-1 rounded`}
            title="Перетащите для изменения размера"
          >
            <div className={`w-[2px] h-8 rounded-full ${theme === 'light' ? 'bg-slate-300 group-hover:bg-blue-400' : 'bg-slate-600 group-hover:bg-primary-400'} transition-colors`} />
          </div>

          {/* Cart */}
          <div className={`${t.bgCard} border ${t.border} rounded-xl overflow-hidden flex flex-col min-h-0 min-w-0 ${t.shadow}`} style={{ width: `${100 - splitPercent}%`, maxHeight: 'calc(100vh - 160px)' }}>
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
        <WorkflowQueueTab
          queue={queue}
          products={products}
          isCashier={isCashier}
          theme={theme}
          t={t}
          approveAndConvert={approveAndConvert}
          onNavigateToProcurement={onNavigateToProcurement}
          getOrderDiscount={getOrderDiscount}
          statusBadge={statusBadge}
          statusLabel={statusLabel}
        />
      )}

      {tab === 'cancelled' && (
        <WorkflowCancelledTab
          cancelledOrders={cancelledOrders}
          isSales={isSales}
          theme={theme}
          t={t}
          startEditCancelled={startEditCancelled}
          toUZS={toUZS}
          statusBadge={statusBadge}
          statusLabel={statusLabel}
        />
      )}
    </div>
  );
};


