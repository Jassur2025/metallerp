/**
 * useDebtRecalculation — real-time client debt recalculation effect.
 * Uses refs to access latest data without causing re-triggers,
 * and a running guard to prevent overlapping/cyclic updates.
 * 
 * Optimized: detects WHICH clients are affected by changes and only
 * recalculates those, instead of iterating all clients every time.
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

/**
 * Calculate debt for a single client given orders and transactions.
 * Pure function — no side effects.
 */
/**
 * Find all orders belonging to a client (by ID or name match).
 */
function findClientOrders(
  client: Client,
  allOrders: Order[],
): Order[] {
  const clientName = (client.name || '').toLowerCase().trim();
  const companyName = (client.companyName || '').toLowerCase().trim();
  return allOrders.filter(o => {
    const orderClientName = (o.customerName || '').toLowerCase().trim();
    return o.clientId === client.id ||
      (clientName && orderClientName === clientName) ||
      (companyName && orderClientName === companyName);
  });
}

/**
 * Calculate totalPurchases for a client (sum of all order totals).
 */
function calculateClientTotalPurchases(
  client: Client,
  allOrders: Order[],
): number {
  return findClientOrders(client, allOrders)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
}

function calculateClientDebt(
  client: Client,
  allOrders: Order[],
  allTransactions: Transaction[]
): number {
  let calculatedDebt = 0;
  const clientName = (client.name || '').toLowerCase().trim();
  const companyName = (client.companyName || '').toLowerCase().trim();

  // Find unpaid orders for this client (strict matching: clientId or exact name)
  const clientOrders = allOrders.filter(o => {
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
  const debtTransactions = allTransactions.filter(t => {
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
  const paymentTransactions = allTransactions.filter(t => {
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
  const returnTransactions = allTransactions.filter(t =>
    t.type === 'client_return' && t.method === 'debt' && t.relatedId === client.id
  );
  returnTransactions.forEach(t => {
    let amountUSD = t.amount;
    if (t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0) {
      amountUSD = t.amount / t.exchangeRate;
    }
    calculatedDebt -= amountUSD;
  });

  return Math.max(0, calculatedDebt);
}

export function useDebtRecalculation({
  clients, orders, transactions, updateClient,
}: UseDebtRecalculationParams) {
  const clientsRef = useRef(clients);
  const ordersRef = useRef(orders);
  const transactionsRef = useRef(transactions);
  const updateClientRef = useRef(updateClient);
  const isRecalculatingRef = useRef(false);
  const prevOrderHashRef = useRef('');
  const prevTxHashRef = useRef('');

  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { updateClientRef.current = updateClient; }, [updateClient]);

  /**
   * Recalculate debt for a single client by ID.
   * Can be called externally for targeted recalculation.
   */
  const recalculateForClient = useCallback(async (clientId: string) => {
    const client = clientsRef.current.find(c => c.id === clientId);
    if (!client) return;

    const finalDebt = calculateClientDebt(client, ordersRef.current, transactionsRef.current);
    const finalPurchases = calculateClientTotalPurchases(client, ordersRef.current);
    const updates: Partial<Client> = {};
    if (Math.abs(finalDebt - (client.totalDebt || 0)) > 0.01) {
      updates.totalDebt = finalDebt;
    }
    if (Math.abs(finalPurchases - (client.totalPurchases || 0)) > 0.01) {
      updates.totalPurchases = finalPurchases;
    }
    if (Object.keys(updates).length > 0) {
      await updateClientRef.current(client.id, updates);
      logger.debug('DebtRecalc', `Updated client ${client.name}: debt ${client.totalDebt}→${updates.totalDebt ?? client.totalDebt}, purchases ${client.totalPurchases}→${updates.totalPurchases ?? client.totalPurchases}`);
    }
  }, []);

  /**
   * Determine which client IDs are affected by changes in orders/transactions,
   * then recalculate only those.
   */
  const checkDebts = useCallback(async () => {
    if (isRecalculatingRef.current) return;
    isRecalculatingRef.current = true;

    try {
      const currentClients = clientsRef.current;
      const currentOrders = ordersRef.current;
      const currentTransactions = transactionsRef.current;

      // Build current hashes
      const orderHash = currentOrders.map(o => `${o.id}:${o.totalAmount}:${o.amountPaid}:${o.paymentStatus}:${o.paymentMethod}:${o.clientId || ''}`).join('|');
      const txHash = currentTransactions.map(t => `${t.id}:${t.amount}:${t.type}:${t.relatedId || ''}:${t.orderId || ''}`).join('|');

      // Collect affected client IDs from changed orders
      const affectedClientIds = new Set<string>();

      // If this is the first run (no previous hash), recalculate all
      if (!prevOrderHashRef.current && !prevTxHashRef.current) {
        currentClients.forEach(c => affectedClientIds.add(c.id));
      } else {
        // Find changed orders → affected clients
        if (orderHash !== prevOrderHashRef.current) {
          currentOrders.forEach(o => {
            if (o.clientId) affectedClientIds.add(o.clientId);
            // Also match by name for orders without clientId
            const orderName = (o.customerName || '').toLowerCase().trim();
            if (orderName) {
              currentClients.forEach(c => {
                const cName = (c.name || '').toLowerCase().trim();
                const cCompany = (c.companyName || '').toLowerCase().trim();
                if (cName === orderName || cCompany === orderName) {
                  affectedClientIds.add(c.id);
                }
              });
            }
          });
        }

        // Find changed transactions → affected clients
        if (txHash !== prevTxHashRef.current) {
          currentTransactions.forEach(t => {
            if (t.relatedId) {
              // relatedId could be a client or order; if it's a client, add directly
              if (currentClients.some(c => c.id === t.relatedId)) {
                affectedClientIds.add(t.relatedId);
              }
            }
          });
        }
      }

      prevOrderHashRef.current = orderHash;
      prevTxHashRef.current = txHash;

      if (affectedClientIds.size === 0) return;

      let updatesCount = 0;
      for (const clientId of affectedClientIds) {
        const client = currentClients.find(c => c.id === clientId);
        if (!client) continue;

        const finalDebt = calculateClientDebt(client, currentOrders, currentTransactions);
        const finalPurchases = calculateClientTotalPurchases(client, currentOrders);
        const updates: Partial<Client> = {};
        if (Math.abs(finalDebt - (client.totalDebt || 0)) > 0.01) {
          updates.totalDebt = finalDebt;
        }
        if (Math.abs(finalPurchases - (client.totalPurchases || 0)) > 0.01) {
          updates.totalPurchases = finalPurchases;
        }
        if (Object.keys(updates).length > 0) {
          await updateClientRef.current(client.id, updates);
          updatesCount++;
        }
      }

      if (updatesCount > 0) {
        logger.debug('DebtRecalc', `Updated debt for ${updatesCount}/${affectedClientIds.size} affected clients`);
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

  return { recalculateForClient };
}
