import React, { useMemo, useState } from 'react';
import { Product, WorkflowOrder, OrderItem, Order, Client, Transaction, AppSettings, Employee, JournalEvent } from '../types';
import { useToast } from '../contexts/ToastContext';
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

  const currentEmployee = useMemo(
    () => employees.find(e => e.email?.toLowerCase() === (currentUserEmail || '').toLowerCase()),
    [employees, currentUserEmail]
  );

  const isSales = currentEmployee?.role === 'sales' || currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';
  const isCashier = currentEmployee?.role === 'accountant' || currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  const [tab, setTab] = useState<'create' | 'queue' | 'cancelled'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<WorkflowOrder | null>(null);

  // Create form
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [exchangeRate, setExchangeRate] = useState(settings.defaultExchangeRate || 12800);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('UZS');

  const toUZS = (usd: number) => Math.round(usd * (exchangeRate || 1));

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
    setWorkflowOrders(next);
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

    const missing = getMissingItems(cart);
    const status: WorkflowOrder['status'] = missing.length > 0 ? 'sent_to_procurement' : 'sent_to_cash';

    const isDebt = paymentMethod === 'debt';
    const amountPaid = isDebt ? 0 : totalUSD;
    const paymentStatus: WorkflowOrder['paymentStatus'] = isDebt ? 'unpaid' : 'paid';
    const finalCurrency: Currency | undefined =
      paymentMethod === 'cash' ? paymentCurrency : paymentMethod === 'debt' ? 'USD' : 'UZS';

    const wf: WorkflowOrder = {
      id: `WF-${Date.now()}`,
      date: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      createdBy: currentEmployee?.name || currentEmployee?.email || currentUserEmail || 'sales',
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
      const next = workflowOrders.map(o => o.id === wf.id ? { ...o, status: 'sent_to_procurement' } : o);
      await saveWorkflowOrders(next);
      onNavigateToProcurement?.();
      return;
    }

    // Create Order (real sale)
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString(),
      customerName: wf.customerName,
      sellerName: typeof wf.createdBy === 'string' ? wf.createdBy : 'Sales',
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
    setProducts(updatedProducts);
    await onSaveProducts?.(updatedProducts);

    // Update clients stats (auto-create if missing)
    let currentClients = [...clients];
    let idx = currentClients.findIndex(c => c.name.toLowerCase() === wf.customerName.toLowerCase());
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

    // Save orders
    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    await onSaveOrders?.(updatedOrders);

    // Update workflow status
    const nextWorkflow = workflowOrders.map(o =>
      o.id === wf.id ? { ...o, status: 'completed', convertedToOrderId: newOrder.id, convertedAt: new Date().toISOString() } : o
    );
    await saveWorkflowOrders(nextWorkflow);

    // Journal
    await onAddJournalEvent?.({
      id: `JE-${Date.now()}`,
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

    // Обновляем существующий заказ
    const updatedWf: WorkflowOrder = {
      ...editingOrder,
      date: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
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
      id: `JE-${Date.now()}`,
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
    <div className="p-6 space-y-6 animate-fade-in pb-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="text-primary-500" /> Workflow (Заявки продаж)
          </h2>
          <p className="text-slate-400 mt-1">Отдел продаж → касса/закуп → подтверждение</p>
        </div>
        <div className="flex gap-2 bg-slate-800 border border-slate-700 rounded-lg p-1">
          <button
            onClick={() => setTab('create')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'create' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Создать
          </button>
          <button
            onClick={() => setTab('queue')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'queue' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Очередь ({queue.length})
          </button>
          <button
            onClick={() => setTab('cancelled')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'cancelled' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="flex items-center gap-1">
              <XCircle size={14} /> Аннулированные {cancelledOrders.length > 0 && `(${cancelledOrders.length})`}
            </span>
          </button>
        </div>
      </div>

      {tab === 'create' && (
        <>
        {editingOrder && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Edit3 className="text-amber-400" size={20} />
              <div>
                <div className="text-amber-400 font-medium">Редактирование аннулированного заказа #{editingOrder.id}</div>
                <div className="text-amber-400/70 text-sm">Внесите изменения и переотправьте заказ</div>
              </div>
            </div>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Отмена редактирования
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Поиск товара..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.slice(0, 40).map(p => (
                <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{p.dimensions} • {p.steelGrade}</div>
                      <div className="text-xs text-slate-500 mt-2">Остаток: {p.quantity} {p.unit}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-mono font-bold">${p.pricePerUnit.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">{toUZS(p.pricePerUnit).toLocaleString()} сум</div>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    className="mt-3 w-full bg-slate-700 hover:bg-primary-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus size={16} /> В корзину
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-700 bg-slate-900/50">
              <div className="text-white font-bold">Заявка</div>
              <div className="text-xs text-slate-400 mt-1">Себестоимость скрыта для продавцов</div>
            </div>

            <div className="p-5 space-y-3">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                placeholder="Клиент"
                list="wf-clients"
              />
              <datalist id="wf-clients">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                placeholder="Телефон клиента (опц.)"
              />
              <input
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                placeholder="Курс (USD→UZS)"
                type="number"
              />

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMethod('cash')} className={`px-3 py-2 rounded-lg text-sm border ${paymentMethod === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                  <Wallet size={14} className="inline mr-2" />Нал
                </button>
                <button onClick={() => setPaymentMethod('bank')} className={`px-3 py-2 rounded-lg text-sm border ${paymentMethod === 'bank' ? 'bg-purple-500/10 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                  <Building2 size={14} className="inline mr-2" />Банк
                </button>
                <button onClick={() => setPaymentMethod('card')} className={`px-3 py-2 rounded-lg text-sm border ${paymentMethod === 'card' ? 'bg-blue-500/10 border-blue-500 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                  <CreditCard size={14} className="inline mr-2" />Карта
                </button>
                <button onClick={() => setPaymentMethod('debt')} className={`px-3 py-2 rounded-lg text-sm border ${paymentMethod === 'debt' ? 'bg-red-500/10 border-red-500 text-red-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                  <AlertTriangle size={14} className="inline mr-2" />Долг
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div className="flex gap-2">
                  <button onClick={() => setPaymentCurrency('UZS')} className={`flex-1 py-2 rounded-lg text-xs border ${paymentCurrency === 'UZS' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>UZS</button>
                  <button onClick={() => setPaymentCurrency('USD')} className={`flex-1 py-2 rounded-lg text-xs border ${paymentCurrency === 'USD' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>USD</button>
                </div>
              )}

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none h-20 resize-none"
                placeholder="Комментарий (опц.)"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
              {cart.length === 0 ? (
                <div className="text-slate-500 text-center py-6">Корзина пуста</div>
              ) : cart.map(it => (
                <div key={it.productId} className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white text-sm font-semibold">{it.productName}</div>
                      {it.dimensions && it.dimensions !== '-' && (
                        <div className="text-xs text-slate-400">{it.dimensions}</div>
                      )}
                    </div>
                    <button onClick={() => removeItem(it.productId)} className="text-slate-400 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <input
                      type="number"
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                      value={it.quantity}
                      onChange={(e) => updateQty(it.productId, Number(e.target.value))}
                    />
                    <div className="text-right">
                      <div className="text-emerald-300 font-mono font-bold">{toUZS(it.total).toLocaleString()} сум</div>
                      <div className="text-xs text-slate-500">${it.total.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-slate-700 bg-slate-900/50 space-y-2">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Подытог</span><span className="font-mono">${subtotalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-300">
                <span>НДС ({settings.vatRate}%)</span><span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-white">
                <span>ИТОГО</span><span className="font-mono">{totalUZS.toLocaleString()} сум</span>
              </div>
              {editingOrder ? (
                <button
                  onClick={resubmitOrder}
                  className="w-full mt-3 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> Переотправить заказ
                </button>
              ) : (
                <button
                  onClick={submitWorkflowOrder}
                  disabled={!isSales}
                  className="w-full mt-3 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Send size={18} /> Отправить
                </button>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {queue.map(wf => (
              <div key={wf.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white font-bold">{wf.customerName}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    <div className="text-xs text-slate-500 mt-1">ID: {wf.id}</div>
                  </div>
                  <span className={statusBadge(wf.status)}>{statusLabel(wf.status)}</span>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  {wf.items.slice(0, 4).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span className="truncate max-w-[220px]">
                        {it.productName}
                        {it.dimensions && it.dimensions !== '-' && <span className="text-slate-500 ml-1">({it.dimensions})</span>}
                        <span className="text-slate-400 ml-1">× {it.quantity}</span>
                      </span>
                      <span className="font-mono text-slate-400">{toUZS(it.total).toLocaleString()} сум</span>
                    </div>
                  ))}
                  {wf.items.length > 4 && <div className="text-xs text-slate-500">+ ещё {wf.items.length - 4} поз.</div>}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Итого</div>
                    <div className="font-mono font-bold text-emerald-300">{wf.totalAmountUZS.toLocaleString()} сум</div>
                  </div>
                  {wf.status === 'sent_to_procurement' && (
                    <button
                      onClick={onNavigateToProcurement}
                      className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium"
                    >
                      В закуп
                    </button>
                  )}
                </div>

                {isCashier && wf.status === 'sent_to_cash' && (
                  <button
                    onClick={() => approveAndConvert(wf)}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <BadgeCheck size={18} /> Подтвердить и продать
                  </button>
                )}
              </div>
            ))}
          </div>

          {queue.length === 0 && (
            <div className="text-center text-slate-500 py-12">Заявок нет</div>
          )}
        </div>
      )}

      {tab === 'cancelled' && (
        <div className="space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle size={18} />
              <span className="font-medium">Аннулированные заказы</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Здесь находятся заказы, которые были аннулированы кассой или закупом. Вы можете отредактировать и переотправить их.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cancelledOrders.map(wf => (
              <div key={wf.id} className="bg-slate-800 border border-red-500/30 rounded-2xl p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white font-bold">{wf.customerName}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    <div className="text-xs text-slate-500 mt-1">ID: {wf.id}</div>
                    {wf.cancellationReason && (
                      <div className="text-xs text-red-400 mt-2 bg-red-500/10 px-2 py-1 rounded">
                        Причина: {wf.cancellationReason}
                      </div>
                    )}
                  </div>
                  <span className={statusBadge('cancelled')}>{statusLabel('cancelled')}</span>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  {wf.items.slice(0, 4).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span className="truncate max-w-[220px]">
                        {it.productName}
                        {it.dimensions && it.dimensions !== '-' && <span className="text-slate-500 ml-1">({it.dimensions})</span>}
                        <span className="text-slate-400 ml-1">× {it.quantity}</span>
                      </span>
                      <span className="font-mono text-slate-400">{toUZS(it.total).toLocaleString()} сум</span>
                    </div>
                  ))}
                  {wf.items.length > 4 && <div className="text-xs text-slate-500">+ ещё {wf.items.length - 4} поз.</div>}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Итого</div>
                    <div className="font-mono font-bold text-slate-400 line-through">{wf.totalAmountUZS.toLocaleString()} сум</div>
                  </div>
                </div>

                {isSales && (
                  <button
                    onClick={() => startEditCancelled(wf)}
                    className="w-full mt-4 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Edit3 size={18} /> Редактировать и переотправить
                  </button>
                )}
              </div>
            ))}
          </div>

          {cancelledOrders.length === 0 && (
            <div className="text-center text-slate-500 py-12">Аннулированных заказов нет</div>
          )}
        </div>
      )}
    </div>
  );
};


