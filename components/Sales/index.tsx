import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Order, OrderItem, Expense, Client, Transaction, JournalEvent, WorkflowOrder, Employee } from '../../types';
import { ShoppingCart, ArrowDownRight, ArrowUpRight, RefreshCw, FileText, ClipboardList, List, Eye, EyeOff, Clock, Search, Edit3, Trash2, X, Tag } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { SUPER_ADMIN_EMAILS } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useSalesContext } from '../../contexts/SalesContext';
import { IdGenerator } from '../../utils/idGenerator';


// Sub-components
import { Balances, FlyingItem, SalesMode, PaymentMethod, Currency } from './types';
import { FlyingIcon } from './FlyingIcon';
import { BalanceBar } from './BalanceBar';
import { ProductGrid } from './ProductGrid';
import { CartPanel } from './CartPanel';
import { MobileCartModal } from './MobileCartModal';
import { ExpenseForm } from './ExpenseForm';
import { ReturnModal } from './ReturnModal';
import { ReturnView } from './ReturnView';
import { ReceiptModal } from './ReceiptModal';
import { ClientModal } from './ClientModal';
import { StaffModal } from './StaffModal';
import { generateInvoicePDF, generateWaybillPDF } from '../../utils/DocumentTemplates';
import { PostSalePaymentModal, PaymentDistribution } from './PostSalePaymentModal';
import { PaymentSplitModal } from './PaymentSplitModal';
import { WorkflowQueue } from './WorkflowQueue';
import { OrderEditModal } from './OrderEditModal';
import { SalesTransactionsView } from './SalesTransactionsView';
import { AuditAlert } from './AuditAlert';
import { calculateBaseTotals, num, getSafeRate } from '../../utils/finance';
import { escapeHtml } from '../../utils/escapeHtml';
import { findOrCreateClient } from '../../services/clientService';
import { salesAtomicService } from '../../services/salesAtomicService';
import { employeeService } from '../../services/employeeService';
import { CancelWorkflowModal } from '../CancelWorkflowModal';

import { logger } from '../../utils/logger';
import { getMissingItems } from '../../utils/inventoryHelpers';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) logger.error('Sales', String(args[0]), ...args.slice(1)); };

// --- Order History View (inline component) ---
const OrderHistoryView: React.FC<{
  orders: Order[];
  exchangeRate: number;
  t: ReturnType<typeof getThemeClasses>;
  theme: string;
  onShowReceipt: (order: Order) => void;
  onEditOrder: (orderId: string) => void;
  onDeleteOrder: (orderId: string) => void;
}> = ({ orders, exchangeRate, t, theme, onShowReceipt, onEditOrder, onDeleteOrder }) => {
  const isDark = theme !== 'light';
  const [historySearch, setHistorySearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 15;

  const filteredOrders = React.useMemo(() => {
    if (!historySearch.trim()) return orders;
    const q = historySearch.toLowerCase();
    return orders.filter(o =>
      o.customerName?.toLowerCase().includes(q) ||
      o.sellerName?.toLowerCase().includes(q) ||
      (o.reportNo && `#${o.reportNo}`.includes(q)) ||
      o.id.toLowerCase().includes(q)
    );
  }, [orders, historySearch]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when search changes
  React.useEffect(() => { setCurrentPage(1); }, [historySearch]);

  const toUZS = (usd: number) => Math.round(usd * exchangeRate);

  if (orders.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center ${t.textMuted} gap-3 py-16`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`}>
          <FileText size={32} className="opacity-30" />
        </div>
        <p className="text-sm font-medium opacity-50">Нет продаж</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + Stats */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input
            type="text"
            placeholder="Поиск по клиенту, продавцу, №..."
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-all
              ${isDark ? 'bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-400'} border`}
          />
        </div>
        <div className={`px-3 py-2 rounded-xl text-xs font-mono font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
          {filteredOrders.length} продаж
        </div>
      </div>

      {/* Table Header */}
      <div className={`grid grid-cols-[60px_1fr_1fr_120px_80px_90px_100px] gap-2 px-3 py-2 rounded-t-xl text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
        <span>№</span>
        <span>Клиент</span>
        <span>Продавец</span>
        <span className="text-right">Сумма</span>
        <span className="text-center">Статус</span>
        <span className="text-center">Дата</span>
        <span className="text-right">Действия</span>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {paginatedOrders.map((order, idx) => {
          const statusColor = order.paymentStatus === 'paid'
            ? (isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50')
            : order.paymentStatus === 'partial'
              ? (isDark ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-50')
              : (isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-50');
          const statusLabel = order.paymentStatus === 'paid' ? 'Оплачен' : order.paymentStatus === 'partial' ? 'Частично' : 'Долг';

          return (
            <div
              key={order.id}
              className={`grid grid-cols-[60px_1fr_1fr_120px_80px_90px_100px] gap-2 px-3 py-2.5 items-center border-b transition-colors ${isDark ? 'border-slate-800/60 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'}`}
            >
              <span className={`font-mono font-bold text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                #{order.reportNo || '—'}
              </span>
              <div className="min-w-0">
                <span className={`text-xs font-medium ${t.text} truncate block`}>{order.customerName}</span>
                {order.items.length > 0 && (
                  <span className={`text-[9px] ${t.textMuted} truncate block`}>
                    {order.items.slice(0, 2).map(i => i.productName).join(', ')}{order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
                  </span>
                )}
              </div>
              <span className={`text-xs ${t.textMuted} truncate`}>{order.sellerName}</span>
              <span className={`font-mono font-bold text-xs text-right ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {(order.totalAmountUZS || toUZS(order.totalAmount)).toLocaleString()} <span className="opacity-60">сўм</span>
              </span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold text-center ${statusColor}`}>
                {statusLabel}
              </span>
              <span className={`text-[10px] ${t.textMuted} font-mono text-center`}>
                {new Date(order.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                {' '}
                {new Date(order.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onShowReceipt(order)}
                  title="Просмотр"
                  className={`p-1.5 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => onEditOrder(order.id)}
                  title="Редактировать"
                  className={`p-1.5 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                >
                  <Edit3 size={14} />
                </button>
                {confirmDeleteId === order.id ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { onDeleteOrder(order.id); setConfirmDeleteId(null); }}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                      title="Подтвердить удаление"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className={`p-1.5 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-200'}`}
                      title="Отмена"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(order.id)}
                    title="Удалить"
                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination + Summary */}
      <div className={`flex items-center justify-between mt-2 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-30
              ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:hover:bg-slate-200'}`}
          >
            ←
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let page: number;
            if (totalPages <= 5) {
              page = i + 1;
            } else if (currentPage <= 3) {
              page = i + 1;
            } else if (currentPage >= totalPages - 2) {
              page = totalPages - 4 + i;
            } else {
              page = currentPage - 2 + i;
            }
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page
                  ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                  : (isDark ? 'bg-slate-700/60 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')}`}
              >
                {page}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-30
              ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:hover:bg-slate-200'}`}
          >
            →
          </button>
        </div>
        <span className={`text-xs font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
          Итого: {filteredOrders.reduce((sum, o) => sum + (o.totalAmountUZS || toUZS(o.totalAmount)), 0).toLocaleString()} сўм
        </span>
      </div>
    </div>
  );
};

export const Sales: React.FC = () => {
  const {
    products, orders, setOrders, settings, setSettings, expenses,
    employees, onNavigateToStaff, clients, onSaveClients, transactions,
    workflowOrders, onSaveWorkflowOrders, currentUserEmail, onNavigateToProcurement,
    onSaveOrders, onSaveTransactions, onSaveProducts, onSaveExpenses, onAddExpense, onAddJournalEvent,
    onDeleteTransaction, onDeleteExpense
  } = useSalesContext();
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

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaffData, setNewStaffData] = useState<Partial<Employee>>({
    name: '', email: '', position: '', phone: ''
  });

  // Sale State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [sellerName, setSellerName] = useState(currentUserEmail || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<string>('default');
  const [exchangeRate, setExchangeRate] = useState<number>(settings.defaultExchangeRate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('USD');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountCurrency, setDiscountCurrency] = useState<Currency>('USD');
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

    try {
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

      // Update client (create if missing)
      const { client: foundClient } = findOrCreateClient(
        clients, wf.customerName, wf.customerPhone || '', 'Автоматически создан из Workflow'
      );
      const clientId = foundClient.id;

      // Add clientId to order
      const newOrderWithClient: Order = {
        ...newOrder,
        clientId
      };

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

      if (remainingUSD > 0.05) {
        newTrx.push({
          ...baseTrx, id: IdGenerator.transaction(), type: 'debt_obligation', amount: remainingUSD, currency: 'USD', method: 'debt',
          description: `Долг по заказу ${newOrder.id}`, orderId: newOrder.id
        });
      }

      const convertedAt = new Date().toISOString();
      await salesAtomicService.commitSale({
        order: newOrderWithClient,
        client: foundClient,
        clientPurchaseDeltaUSD: wf.totalAmount || 0,
        transactions: newTrx,
        workflowOrderId: wf.id,
        workflowConvertedAt: convertedAt
      });

      const updatedOrders = [newOrderWithClient, ...orders];
      setOrders(updatedOrders);

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
    } catch (error) {
      errorDev('confirmWorkflowPayment failed:', error);
      toast.error('Ошибка при подтверждении workflow! Попробуйте снова.');
    }
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

  const updatePrice = useCallback((productId: string, price: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, priceAtSale: price, total: item.quantity * price };
      }
      return item;
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter(item => item.productId !== id)), []);

  // Totals — IFRS 15: discount applies to net amount (before VAT)
  const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);

  // Convert discount amount to USD
  const discountAmountUSD = discountCurrency === 'UZS' ? (exchangeRate > 0 ? discountAmount / exchangeRate : 0) : discountAmount;

  // Apply discount to subtotal BEFORE calculating VAT (IFRS 15 - Transaction Price)
  const discountedSubtotal = Math.max(0, subtotalUSD - discountAmountUSD);

  const vatAmountUSD = discountedSubtotal * (settings.vatRate / 100);
  const originalTotalUSD = subtotalUSD + (subtotalUSD * (settings.vatRate / 100));

  const totalAmountUSD = discountedSubtotal + vatAmountUSD;

  const discountPercent = originalTotalUSD > 0 ? (discountAmountUSD / originalTotalUSD) * 100 : 0;

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
      paymentCurrency: method === 'cash' ? (dist.cashUSD > 0 ? 'USD' : 'UZS') : 'USD', // Determined by actual payment
      paymentDueDate, // Payment deadline for debts
    };

    try {
      // Update/Create Client
      const { client: foundClient } = findOrCreateClient(
        clients, customerName, '', 'Автоматически создан при продаже'
      );
      const clientId = foundClient.id;

      // Add clientId to order for proper linking
      const newOrderWithClient = {
        ...newOrder,
        clientId
      };

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

      await salesAtomicService.commitSale({
        order: newOrderWithClient,
        client: foundClient,
        clientPurchaseDeltaUSD: totalAmountUSD,
        transactions: newTrx
      });

      const updatedOrders = [newOrderWithClient, ...orders];
      setOrders(updatedOrders);

      // Clear form
      setCart([]);
      setCustomerName('');
      setSellerName('');
      setPaymentMethod('cash');
      setDiscountAmount(0);
      setDiscountCurrency('USD');
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

    // Always open payment modal for payment method selection
    setSalesPaymentModalOpen(true);
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
          <p style="margin: 3px 0;"><strong>Клиент:</strong> ${escapeHtml(order.customerName)}</p>
          <p style="margin: 3px 0;"><strong>Продавец:</strong> ${escapeHtml(order.sellerName)}</p>
        </div>
        <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 15px 0;">
          ${order.items.map(item => `<div style="margin-bottom: 8px;"><div style="display: flex; justify-content: space-between;"><span style="font-weight: bold;">${escapeHtml(item.productName)}</span><span>${(item.total * order.exchangeRate).toLocaleString()} сўм</span></div><div style="font-size: 11px; color: #666;">${item.quantity} ${item.unit} × ${(item.priceAtSale * order.exchangeRate).toLocaleString()} сўм</div></div>`).join('')}
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

  // 4. Add handleSaveStaff
  const handleSaveStaff = async () => {
    if (!newStaffData.name?.trim() || !newStaffData.email?.trim()) {
      toast.error('Заполните обязательные поля: Имя и Email');
      return;
    }
    const newStaff: Employee = {
      id: IdGenerator.employee(),
      name: newStaffData.name,
      email: newStaffData.email,
      position: newStaffData.position || 'Продавец',
      phone: newStaffData.phone || '',
      role: 'sales',
      hireDate: new Date().toISOString(),
      status: 'active'
    };
    try {
      const { id: _ignoreId, ...employeeData } = newStaff;
      await employeeService.create(employeeData);
      toast.success('Сотрудник добавлен');
      setSellerName(newStaff.name);
      setIsStaffModalOpen(false);
      setNewStaffData({ name: '', email: '', position: '', phone: '' });
    } catch (error) {
      errorDev('Ошибка при сохранении сотрудника:', error);
      toast.error('Ошибка при сохранении сотрудника');
    }
  };

  const [showBalances, setShowBalances] = useState(true);

  // --- Render ---
  return (
    <div className="flex flex-col h-full">
      {/* Balance Toggle + Bar */}
      <div className={`${theme !== 'light' ? 'bg-slate-900/80 border-b border-slate-800' : 'bg-white border-b border-slate-200'}`}>
        <BalanceBar
          balances={balances}
          orders={orders}
          debugStats={debugStats}
          isVisible={showBalances}
          onToggle={() => setShowBalances(!showBalances)}
        />
      </div>



      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 lg:p-5 relative overflow-hidden">
        {flyingItems.map(item => <FlyingIcon key={item.id} {...item} onComplete={() => removeFlyingItem(item.id)} />)}

        <div className={`lg:col-span-2 flex flex-col h-full overflow-hidden transition-all duration-300`}>
          {/* Mode Switcher — Unified Tabs with sliding pill */}
          <div className="relative flex mb-4">
            <div className={`relative flex w-full ${theme !== 'light' ? 'bg-slate-800/50' : 'bg-slate-100'} p-1 rounded-xl`}>
              {/* Sliding pill indicator */}
              <div
                className={`absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-in-out z-0 ${theme !== 'light' ? 'bg-slate-700 shadow-lg shadow-black/20' : 'bg-white shadow-md'}`}
                style={(() => {
                  const allTabs = [
                    { key: 'sale' },
                    { key: 'history' },
                    ...(isCashier ? [{ key: 'workflow' }] : []),
                    ...(isCashier ? [{ key: 'transactions' }] : []),
                    { key: 'expense' },
                    ...(currentEmployee?.permissions?.canProcessReturns !== false ? [{ key: 'return' }] : []),
                  ];
                  const idx = allTabs.findIndex(t => t.key === mode);
                  const count = allTabs.length;
                  return {
                    width: `calc((100% - 8px) / ${count})`,
                    left: `calc(4px + ${idx} * (100% - 8px) / ${count})`,
                  };
                })()}
              />
              {/* Tab buttons */}
              {[
                { key: 'sale' as SalesMode, label: 'Продажа', icon: <ArrowDownRight size={15} /> },
                { key: 'history' as SalesMode, label: `Продажи (${orders.length})`, icon: <Clock size={15} /> },
                ...(isCashier ? [{ key: 'workflow' as SalesMode, label: 'Workflow', icon: <ClipboardList size={15} /> }] : []),
                ...(isCashier ? [{ key: 'transactions' as SalesMode, label: 'Транзакции', icon: <List size={15} /> }] : []),
                { key: 'expense' as SalesMode, label: 'Расходы', icon: <ArrowUpRight size={15} /> },
                ...(currentEmployee?.permissions?.canProcessReturns !== false ? [{ key: 'return' as SalesMode, label: 'Возврат', icon: <RefreshCw size={15} /> }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setMode(tab.key)}
                  className={`relative z-10 flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 text-[13px] transition-colors duration-200
                    ${mode === tab.key
                      ? (theme !== 'light' ? 'text-white' : 'text-slate-800')
                      : (theme !== 'light' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
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
          ) : mode === 'history' ? (
            <OrderHistoryView
              orders={orders} exchangeRate={exchangeRate} t={t} theme={theme}
              onShowReceipt={(order) => { setSelectedOrderForReceipt(order); setShowReceiptModal(true); }}
              onEditOrder={(id) => setEditingOrderId(id)}
              onDeleteOrder={async (id) => {
                const orderToDelete = orders.find(o => o.id === id);
                const updated = orders.filter(o => o.id !== id);
                try {
                  await onSaveOrders?.(updated);
                  setOrders(updated);
                  toast.success(`Заказ №${orderToDelete?.reportNo || id.slice(-6)} удалён`);
                  // Journal event
                  await onAddJournalEvent?.({
                    id: IdGenerator.journalEvent(),
                    date: new Date().toISOString(),
                    type: 'employee_action',
                    employeeName: currentEmployee?.name || currentUserEmail || 'Администратор',
                    action: 'Удалён заказ',
                    description: `Заказ №${orderToDelete?.reportNo || id.slice(-6)} (${orderToDelete?.customerName || 'N/A'}) на сумму $${orderToDelete?.totalAmount.toFixed(2) || 0} удалён.`,
                    module: 'sales',
                    relatedType: 'order',
                    relatedId: id,
                  });
                } catch (err) {
                  toast.error('Ошибка при удалении заказа');
                }
              }}
            />
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
          ) : mode === 'return' ? (
            <ReturnView
              returnClientName={returnClientName} setReturnClientName={setReturnClientName}
              returnProductName={returnProductName} setReturnProductName={setReturnProductName}
              returnQuantity={returnQuantity} setReturnQuantity={setReturnQuantity}
              returnMethod={returnMethod} setReturnMethod={setReturnMethod}
              clients={clients} products={products}
              onSubmit={handleReturnSubmit}
              onSubmitMoneyReturn={handleMoneyReturn}
            />
          ) : null}
        </div>

        {/* Cart Panel (Desktop) */}
        {mode === 'sale' && (
          <CartPanel cart={cart} removeFromCart={removeFromCart} updateQuantity={updateQuantity} updatePrice={updatePrice}
            customerName={customerName} setCustomerName={setCustomerName}
            customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} onSaveClient={onSaveClients}
            sellerName={sellerName} setSellerName={setSellerName} exchangeRate={exchangeRate}
            clients={clients} employees={employees} settings={settings}
            subtotalUSD={subtotalUSD} vatAmountUSD={vatAmountUSD} totalAmountUSD={totalAmountUSD} totalAmountUZS={totalAmountUZS}
            toUZS={toUZS} onCompleteOrder={completeOrder} onOpenClientModal={() => setIsClientModalOpen(true)}
            onNavigateToStaff={() => setIsStaffModalOpen(true)} lastOrder={lastOrder}
            onShowReceipt={() => {
              setLastOrder(null);
            }}
            onPrintReceipt={() => { }}
            onPrintInvoice={order => generateInvoicePDF(order, settings)}
            onPrintWaybill={order => generateWaybillPDF(order, settings)}
            flyingItems={flyingItems}

            // Discount Props (amount-based)
            discountAmount={discountAmount}
            onDiscountAmountChange={setDiscountAmount}
            discountCurrency={discountCurrency}
            onDiscountCurrencyChange={setDiscountCurrency}
            originalTotalUSD={originalTotalUSD}
          />)}
      </div>



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

      {/* Staff Modal */}
      <StaffModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)}
        staffData={newStaffData} setStaffData={setNewStaffData} onSave={handleSaveStaff} />

      {/* Workflow Payment Confirmation Modal (New Split) */}
      <PaymentSplitModal
        isOpen={workflowPaymentModalOpen}
        onClose={() => setWorkflowPaymentModalOpen(false)}
        totalAmountUSD={selectedWorkflowOrder?.totalAmount || 0}
        totalAmountUZS={selectedWorkflowOrder?.totalAmountUZS || 0}
        exchangeRate={selectedWorkflowOrder?.exchangeRate || exchangeRate}
        onConfirm={confirmWorkflowPayment}
      />

      {/* Post-Sale Payment Modal */}
      <PostSalePaymentModal
        isOpen={salesPaymentModalOpen}
        onClose={() => setSalesPaymentModalOpen(false)}
        totalAmountUSD={totalAmountUSD}
        totalAmountUZS={totalAmountUZS}
        exchangeRate={exchangeRate}
        onConfirm={(dist, method, modalDebtDueDate) => {
          const pm = method as PaymentMethod;
          const isDebt = pm === 'debt';
          const isPartial = !dist.isPaid && pm === 'mixed';
          const status = isDebt ? 'unpaid' : isPartial ? 'partial' : 'paid';
          if (modalDebtDueDate) setDebtDueDate(modalDebtDueDate);
          finalizeSale(dist, pm, status);
        }}
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
        cart={cart} removeFromCart={removeFromCart} updateQuantity={updateQuantity} updatePrice={updatePrice}
        customerName={customerName} setCustomerName={setCustomerName}
        customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} onSaveClient={onSaveClients}
        sellerName={sellerName} setSellerName={setSellerName} exchangeRate={exchangeRate}
        clients={clients} employees={employees} settings={settings}
        subtotalUSD={subtotalUSD} vatAmountUSD={vatAmountUSD} totalAmountUSD={totalAmountUSD} totalAmountUZS={totalAmountUZS}
        toUZS={toUZS} onCompleteOrder={completeOrder} onOpenClientModal={() => setIsClientModalOpen(true)}
        onNavigateToStaff={() => setIsStaffModalOpen(true)} flyingItems={flyingItems}
        discountAmount={discountAmount}
        onDiscountAmountChange={setDiscountAmount}
        discountCurrency={discountCurrency}
        onDiscountCurrencyChange={setDiscountCurrency}
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
