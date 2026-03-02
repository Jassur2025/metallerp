import { useMemo } from 'react';
import { Client, Order, Transaction } from '../types';
import type { HistoryItem } from '../components/CRM/DebtHistoryModal';

export interface PaymentRecord {
  date: string;
  amount: number;
  amountUSD: number;
  currency: string;
  method: string;
}

export interface UnpaidOrderItem {
  id: string;
  date: string;
  totalAmount: number;
  amountPaid: number;
  debtAmount: number;
  items: string;
  reportNo?: number;
  paymentDueDate?: string;
  payments: PaymentRecord[];
}

// Helper: paid USD from an order
const getOrderPaidUSD = (order: Order): number => {
  const anyOrder = order as unknown as Record<string, unknown>;
  if (typeof anyOrder.amountPaidUSD === 'number') return anyOrder.amountPaidUSD as number;
  if (order.paymentCurrency === 'USD') return order.amountPaid || 0;
  return order.amountPaid || 0;
};

const hasOpenBalance = (order: Order): boolean => {
  const paidUSD = getOrderPaidUSD(order);
  return ((order.totalAmount || 0) - paidUSD) > 0.01;
};

export const isDebtOrder = (order: Order): boolean => {
  const status = order.paymentStatus;
  return order.paymentMethod === 'debt' || status === 'unpaid' || status === 'partial' || hasOpenBalance(order);
};

// Strict order-to-client matching: by clientId, then exact name match
export const orderMatchesClient = (order: Order, client: Client): boolean => {
  if (order.clientId && order.clientId === client.id) return true;
  const orderName = (order.customerName || '').toLowerCase().trim();
  const clientName = (client.name || '').toLowerCase().trim();
  if (clientName && orderName === clientName) return true;
  const companyName = (client.companyName || '').toLowerCase().trim();
  if (companyName && orderName === companyName) return true;
  return false;
};

// Strict transaction-to-client matching
const txMatchesClient = (tx: Transaction, clientId: string, clientOrderIds: string[]): boolean => {
  if (tx.relatedId === clientId) return true;
  if (tx.relatedId && clientOrderIds.includes(tx.relatedId)) return true;
  return false;
};

// Convert tx amount to USD
const txToUSD = (tx: Transaction): number => {
  if (tx.currency === 'UZS' && tx.exchangeRate) {
    return (tx.amount || 0) / tx.exchangeRate;
  }
  return tx.amount || 0;
};

const toPaymentRecord = (r: Transaction): PaymentRecord => ({
  date: r.date,
  amount: r.amount || 0,
  amountUSD: txToUSD(r),
  currency: r.currency || 'USD',
  method: r.method || 'cash'
});

interface UseCRMDebtParams {
  orders: Order[];
  transactions: Transaction[];
  selectedClientForRepayment: Client | null;
  selectedClientForHistory: Client | null;
}

export function useCRMDebt({ orders, transactions, selectedClientForRepayment, selectedClientForHistory }: UseCRMDebtParams) {

  // Total purchases for a client
  const calculateClientPurchases = (client: Client): number => {
    let totalPurchases = 0;
    orders.forEach(order => {
      if (orderMatchesClient(order, client)) {
        totalPurchases += order.totalAmount || 0;
      }
    });
    return totalPurchases;
  };

  // Actual debt from orders and transactions
  const calculateClientDebt = (client: Client): number => {
    const clientId = client.id;
    let totalDebt = 0;
    let totalRepaid = 0;

    const debtOrderIds = new Set<string>();
    orders.forEach(order => {
      if (!orderMatchesClient(order, client)) return;
      const wasDebtOrder = order.paymentMethod === 'debt' ||
        order.paymentStatus === 'unpaid' ||
        order.paymentStatus === 'partial';
      if (wasDebtOrder) {
        totalDebt += (order.totalAmount || 0);
        debtOrderIds.add(order.id);
      }
    });

    transactions.forEach(tx => {
      if (tx.type !== 'client_payment') return;
      const isDebtOrderPayment = tx.relatedId ? debtOrderIds.has(tx.relatedId) : false;
      let isDirectDebtRepayment = false;
      if (tx.relatedId === clientId) {
        const orderIdInDesc = tx.description?.match(/заказа\s+(\S+)/i);
        if (orderIdInDesc) {
          const orderId = orderIdInDesc[1].replace(/\s*\(.*$/, '');
          isDirectDebtRepayment = debtOrderIds.has(orderId);
        } else {
          isDirectDebtRepayment = true;
        }
      }
      if (!isDirectDebtRepayment && !isDebtOrderPayment) return;
      let amountInUSD = tx.amount || 0;
      if (tx.currency === 'UZS' && tx.exchangeRate) {
        amountInUSD = (tx.amount || 0) / tx.exchangeRate;
      }
      totalRepaid += amountInUSD;
    });

    return Math.max(0, totalDebt - totalRepaid);
  };

  // Unpaid orders for repayment modal (FIFO allocation)
  const unpaidOrders = useMemo((): UnpaidOrderItem[] => {
    if (!selectedClientForRepayment) return [];
    const clientId = selectedClientForRepayment.id;
    const result: UnpaidOrderItem[] = [];

    orders.forEach(order => {
      if (!orderMatchesClient(order, selectedClientForRepayment)) return;
      const wasDebtOrder = order.paymentMethod === 'debt' ||
        order.paymentStatus === 'unpaid' ||
        order.paymentStatus === 'partial';
      if (!wasDebtOrder) return;

      const repayments = transactions.filter(t =>
        t.type === 'client_payment' && t.relatedId === order.id
      );
      const payments: PaymentRecord[] = repayments.map(toPaymentRecord);
      let totalRepaidUSD = 0;
      repayments.forEach(r => { totalRepaidUSD += txToUSD(r); });

      const debtAmount = (order.totalAmount || 0) - totalRepaidUSD;
      if (debtAmount > 0.01) {
        result.push({
          id: order.id, date: order.date,
          totalAmount: order.totalAmount || 0, amountPaid: totalRepaidUSD,
          debtAmount,
          items: (order.items || []).map(it => it.productName).slice(0, 2).join(', ') + (order.items && order.items.length > 2 ? '...' : ''),
          reportNo: order.reportNo, paymentDueDate: order.paymentDueDate, payments
        });
      }
    });

    // Check debt_obligation transactions
    transactions.forEach(tx => {
      if (tx.type !== 'debt_obligation') return;
      if (tx.relatedId !== clientId) return;
      if (result.find(o => o.id === tx.id)) return;

      const repayments = transactions.filter(t =>
        t.type === 'client_payment' && t.relatedId === tx.id
      );
      const payments: PaymentRecord[] = repayments.map(toPaymentRecord);
      let totalRepaidUSD = 0;
      repayments.forEach(r => { totalRepaidUSD += txToUSD(r); });

      const debtAmount = (tx.amount || 0) - totalRepaidUSD;
      if (debtAmount > 0.01) {
        result.push({
          id: tx.id, date: tx.date,
          totalAmount: tx.amount || 0, amountPaid: totalRepaidUSD,
          debtAmount, items: tx.description || '', payments
        });
      }
    });

    // FIFO sort
    result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Distribute unallocated payments (FIFO)
    const orderIdsSet = new Set(result.map(o => o.id));
    const clientPaymentsWithoutOrder = transactions.filter(t =>
      t.type === 'client_payment' &&
      t.relatedId === clientId &&
      !orderIdsSet.has(t.relatedId!)
    );
    let unallocatedPaymentsUSD = 0;
    clientPaymentsWithoutOrder.forEach(t => { unallocatedPaymentsUSD += txToUSD(t); });

    if (unallocatedPaymentsUSD > 0) {
      for (const order of result) {
        if (unallocatedPaymentsUSD <= 0) break;
        const canPay = Math.min(unallocatedPaymentsUSD, order.debtAmount);
        order.amountPaid += canPay;
        order.debtAmount -= canPay;
        unallocatedPaymentsUSD -= canPay;
      }
    }

    const stillUnpaid = result.filter(o => o.debtAmount > 0.01);

    // Fallback: if no orders found but calculated debt exists
    const calculatedDebt = selectedClientForRepayment ? calculateClientDebt(selectedClientForRepayment) : 0;
    if (stillUnpaid.length === 0 && calculatedDebt > 0.01) {
      stillUnpaid.push({
        id: `DEBT-${clientId}`, date: new Date().toISOString(),
        totalAmount: calculatedDebt, amountPaid: 0, debtAmount: calculatedDebt,
        items: 'Общий долг клиента', payments: []
      });
    }

    return stillUnpaid;
  }, [selectedClientForRepayment, orders, transactions]);

  // Full debt history for a client
  const debtHistory = useMemo((): HistoryItem[] => {
    if (!selectedClientForHistory) return [];
    const clientId = selectedClientForHistory.id;
    const allHistory: HistoryItem[] = [];

    // 1. Debt orders
    orders.forEach(order => {
      if (!orderMatchesClient(order, selectedClientForHistory)) return;
      const wasDebtOrder = order.paymentMethod === 'debt' ||
        order.paymentStatus === 'unpaid' ||
        order.paymentStatus === 'partial';
      if (!wasDebtOrder) return;

      allHistory.push({
        id: order.id, date: order.date, type: 'order',
        description: order.reportNo ? `Отчёт №${order.reportNo}` : `Заказ #${order.id.slice(-6)}`,
        items: (order.items || []).map(it => ({
          name: it.productName || 'Товар', qty: it.quantity || 0, price: it.priceAtSale || 0
        })),
        totalAmount: order.totalAmount || 0, amountPaid: 0,
        debtChange: order.totalAmount || 0, balance: 0,
        reportNo: order.reportNo, paymentDueDate: order.paymentDueDate
      });
    });

    // 2. Collect debt order IDs
    const debtOrderIds = new Set<string>();
    orders.forEach(order => {
      if (!orderMatchesClient(order, selectedClientForHistory)) return;
      const wasDebt = order.paymentMethod === 'debt' || order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial';
      if (wasDebt) debtOrderIds.add(order.id);
    });

    // 3. Find debt-related transactions
    transactions.forEach(tx => {
      if (tx.type !== 'client_payment' && tx.type !== 'debt_obligation') return;
      const isDebtRelatedBasic = tx.relatedId === clientId || (tx.relatedId ? debtOrderIds.has(tx.relatedId) : false);
      if (tx.type === 'debt_obligation' && !isDebtRelatedBasic) return;

      if (tx.type === 'client_payment') {
        const isDebtOrderPayment = tx.relatedId ? debtOrderIds.has(tx.relatedId) : false;
        let isDirectDebtRepayment = false;
        if (tx.relatedId === clientId) {
          const orderIdInDesc = tx.description?.match(/заказа\s+(\S+)/i);
          if (orderIdInDesc) {
            const orderId = orderIdInDesc[1].replace(/\s*\(.*$/, '');
            isDirectDebtRepayment = debtOrderIds.has(orderId);
          } else {
            isDirectDebtRepayment = true;
          }
        }
        if (!isDirectDebtRepayment && !isDebtOrderPayment) return;
      }

      if (tx.type === 'debt_obligation') {
        const descOrderMatch = tx.description?.match(/заказу?\s+(\S+)/i);
        const mentionedOrderId = descOrderMatch ? descOrderMatch[1] : null;
        const orderExistsInDB = mentionedOrderId ? orders.some(o => o.id === mentionedOrderId) : false;
        const alreadyInHistory = allHistory.some(h =>
          h.id === tx.id ||
          (tx.relatedId && h.id === tx.relatedId && h.type === 'order') ||
          (mentionedOrderId && h.id === mentionedOrderId && h.type === 'order')
        );
        if (orderExistsInDB || alreadyInHistory) return;

        allHistory.push({
          id: tx.id, date: tx.date, type: 'order',
          description: tx.description || 'Начальный долг / Обязательство',
          totalAmount: tx.amount || 0, amountPaid: 0,
          debtChange: tx.amount || 0, balance: 0,
        });
      } else if (tx.type === 'client_payment') {
        let amountInUSD = tx.amount || 0;
        if (tx.currency === 'UZS' && tx.exchangeRate) {
          amountInUSD = (tx.amount || 0) / tx.exchangeRate;
        }
        allHistory.push({
          id: tx.id, date: tx.date, type: 'repayment',
          description: tx.description || 'Погашение долга',
          totalAmount: tx.amount || 0, amountPaid: tx.amount || 0,
          debtChange: -amountInUSD, balance: 0,
          paymentMethod: tx.method, currency: tx.currency || 'USD',
          exchangeRate: tx.exchangeRate, amountInUSD
        });
      }
    });

    // 4. Sort by date
    allHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 5. Running balance
    let runningBalance = 0;
    allHistory.forEach(item => {
      runningBalance += item.debtChange;
      item.balance = Math.max(0, runningBalance);
    });

    return allHistory.reverse();
  }, [selectedClientForHistory, orders, transactions]);

  // Total debt from debt history orders
  const totalDebtFromOrders = useMemo(() => {
    if (!Array.isArray(debtHistory)) return 0;
    return debtHistory.filter(h => h.type === 'order').reduce((sum, h) => sum + h.debtChange, 0);
  }, [debtHistory]);

  return {
    calculateClientPurchases,
    calculateClientDebt,
    unpaidOrders,
    debtHistory,
    totalDebtFromOrders,
    orderMatchesClient,
    isDebtOrder,
    getOrderPaidUSD
  };
}
