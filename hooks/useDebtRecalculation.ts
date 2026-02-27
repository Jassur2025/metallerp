/**
 * useDebtRecalculation — real-time client debt recalculation effect.
 * Uses refs to access latest data without causing re-triggers,
 * and a running guard to prevent overlapping/cyclic updates.
 */
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Client, Order, Transaction } from '../types';
import { logger } from '../utils/logger';

interface UseDebtRecalculationParams {
  clients: Client[];
  orders: Order[];
  transactions: Transaction[];
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
}

export function useDebtRecalculation({
  clients, orders, transactions, updateClient,
}: UseDebtRecalculationParams) {
  const clientsRef = useRef(clients);
  const ordersRef = useRef(orders);
  const transactionsRef = useRef(transactions);
  const updateClientRef = useRef(updateClient);
  const isRecalculatingRef = useRef(false);

  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { updateClientRef.current = updateClient; }, [updateClient]);

  const checkDebts = useCallback(async () => {
    if (isRecalculatingRef.current) return;
    isRecalculatingRef.current = true;

    try {
      const currentClients = clientsRef.current;
      const currentOrders = ordersRef.current;
      const currentTransactions = transactionsRef.current;
      let updatesCount = 0;

      for (const client of currentClients) {
        let calculatedDebt = 0;
        const clientName = (client.name || '').toLowerCase().trim();
        const companyName = (client.companyName || '').toLowerCase().trim();

        // Find unpaid orders for this client (strict matching: clientId or exact name)
        const clientOrders = currentOrders.filter(o => {
          const orderClientName = (o.customerName || '').toLowerCase().trim();
          const matchesClient = o.clientId === client.id ||
            (clientName && orderClientName === clientName) ||
            (companyName && orderClientName === companyName);

          const hasUnpaidBalance = ((o.totalAmount || 0) - (o.amountPaid || 0)) > 0.01;
          const isDebtPayment = o.paymentMethod === 'debt' ||
            o.paymentStatus === 'unpaid' ||
            o.paymentStatus === 'partial';

          return matchesClient && (isDebtPayment || hasUnpaidBalance);
        });
        const clientOrderIds = clientOrders.map(o => o.id.toLowerCase());

        // Sum unpaid amounts from orders
        clientOrders.forEach(order => {
          const paidUSD = order.amountPaid || 0;
          const openAmount = (order.totalAmount || 0) - paidUSD;
          calculatedDebt += Math.max(0, openAmount);
        });

        // Add debt_obligation transactions not linked to counted orders
        const debtTransactions = currentTransactions.filter(t => {
          if (t.type !== 'debt_obligation') return false;
          const desc = (t.description || '').toLowerCase();
          const txOrderId = (t.orderId || '').toLowerCase();
          const matchesClient = t.relatedId === client.id ||
            (clientName && desc.includes(clientName)) ||
            (companyName && desc.includes(companyName));
          const relatedToExistingOrder = clientOrderIds.some(orderId =>
            orderId === txOrderId ||
            desc.includes(orderId) ||
            t.relatedId?.toLowerCase() === orderId
          );
          return matchesClient && !t.orderId && !relatedToExistingOrder;
        });
        debtTransactions.forEach(t => {
          calculatedDebt += t.amount;
        });

        // Subtract direct client payments (not linked to specific orders)
        const debtTxIds = debtTransactions.map(t => t.id.toLowerCase());
        const paymentTransactions = currentTransactions.filter(t => {
          if (t.orderId) return false; // Order-linked payments are already reflected in order.amountPaid

          const desc = (t.description || '').toLowerCase();
          const relatedIdLower = (t.relatedId || '').toLowerCase();
          const isPayment = t.type === 'client_payment' || desc.includes('погашение');

          const isForClientDirectly = t.relatedId === client.id;
          const isForDebtObligation = debtTxIds.includes(relatedIdLower);
          const isForKnownOrder = clientOrderIds.includes(relatedIdLower);

          return isPayment && (isForClientDirectly || isForDebtObligation) && !isForKnownOrder;
        });
        paymentTransactions.forEach(t => {
          let amountUSD = t.amount;
          if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
            amountUSD = t.amount / t.exchangeRate;
          }
          calculatedDebt -= amountUSD;
        });

        // Subtract debt-method returns
        const returnTransactions = currentTransactions.filter(t =>
          t.type === 'client_return' && t.method === 'debt' && t.relatedId === client.id
        );
        returnTransactions.forEach(t => {
          let amountUSD = t.amount;
          if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
            amountUSD = t.amount / t.exchangeRate;
          }
          calculatedDebt -= amountUSD;
        });

        const finalDebt = Math.max(0, calculatedDebt);

        if (Math.abs(finalDebt - (client.totalDebt || 0)) > 0.01) {
          await updateClientRef.current(client.id, { totalDebt: finalDebt });
          updatesCount++;
        }
      }

      if (updatesCount > 0) {
        logger.debug('DebtRecalc', `Updated debt for ${updatesCount} clients`);
      }
    } finally {
      isRecalculatingRef.current = false;
    }
  }, []);

  // Build a hash of relevant data to detect actual changes (not just .length)
  const dataHash = useMemo(() => {
    const orderHash = orders.map(o => `${o.id}:${o.totalAmount}:${o.amountPaid}:${o.paymentStatus}:${o.paymentMethod}`).join('|');
    const txHash = transactions.map(t => `${t.id}:${t.amount}:${t.type}:${t.relatedId || ''}:${t.orderId || ''}`).join('|');
    const clientHash = clients.map(c => `${c.id}:${c.totalDebt}`).join('|');
    return `${orderHash}##${txHash}##${clientHash}`;
  }, [orders, transactions, clients]);

  useEffect(() => {
    if (clients.length === 0 || orders.length === 0) return;

    const timeoutId = setTimeout(checkDebts, 2000);
    return () => clearTimeout(timeoutId);
  }, [dataHash, checkDebts]); // eslint-disable-line react-hooks/exhaustive-deps
}
