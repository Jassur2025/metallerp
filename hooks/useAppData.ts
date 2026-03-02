/**
 * useAppData — aggregate hook that bundles all data-layer hooks.
 * Keeps App.tsx thin by centralising Firestore subscriptions in one place.
 *
 * Lazy subscription: secondary collections only subscribe when their tab is
 * first visited.  Once activated a subscription stays alive for the rest of
 * the session, so switching back to a tab is instant.
 */
import { useRef, useCallback } from 'react';
import { useOrders } from './useOrders';
import { usePurchases } from './usePurchases';
import { useProducts } from './useProducts';
import { useTransactions } from './useTransactions';
import { useExpenses } from './useExpenses';
import { useClients } from './useClients';
import { useEmployees } from './useEmployees';
import { useFixedAssets } from './useFixedAssets';
import { useWorkflowOrders } from './useWorkflowOrders';
import { useJournal } from './useJournal';
import { useSettings } from './useSettings';
import { useBalance } from './useBalance';
import { useAppHandlers } from './useAppHandlers';
import { useDebtRecalculation } from './useDebtRecalculation';
import { defaultSettings } from '../constants';
import { useToast } from '../contexts/ToastContext';

// Which tabs need which secondary collections
const JOURNAL_TABS   = new Set(['journal']);
const WORKFLOW_TABS   = new Set(['import', 'sales', 'workflow']);
const FIXED_TABS      = new Set(['fixedAssets', 'reports', 'balance']);
const PURCHASE_TABS   = new Set(['import', 'reports', 'balance']);

/** Track which tabs have been visited and never "un-visit" them. */
function useVisitedTabs(activeTab: string) {
  const visited = useRef(new Set<string>([activeTab]));
  visited.current.add(activeTab);
  return visited.current;
}

function setsOverlap(a: Set<string>, b: Set<string>) {
  for (const v of a) if (b.has(v)) return true;
  return false;
}

export function useAppData(activeTab: string = 'dashboard') {
  const toast = useToast();
  const visited = useVisitedTabs(activeTab);

  // Compute enabled flags — once a tab is visited the flag stays true forever
  const journalEnabled   = setsOverlap(visited, JOURNAL_TABS);
  const workflowEnabled  = setsOverlap(visited, WORKFLOW_TABS);
  const fixedEnabled     = setsOverlap(visited, FIXED_TABS);
  const purchaseEnabled  = setsOverlap(visited, PURCHASE_TABS);

  // ── Core collections (always active) ──────────────────────
  const { products, addProduct, updateProduct } = useProducts();
  const { orders, setOrders, addOrder, updateOrder, deleteOrder } = useOrders();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses({
    transactions, addTransaction, updateTransaction, deleteTransaction,
  });
  const { clients, addClient, updateClient } = useClients();
  const { employees, addEmployee, updateEmployee } = useEmployees();

  // ── Secondary collections (lazy) ─────────────────────────
  const { fixedAssets, addAsset, updateAsset } = useFixedAssets({ enabled: fixedEnabled });
  const { purchases, addPurchase, updatePurchase } = usePurchases({ enabled: purchaseEnabled });
  const { journalEvents, addEvent: addJournalEvent } = useJournal({ enabled: journalEnabled });
  const { workflowOrders, addWorkflowOrder, updateWorkflowOrder } = useWorkflowOrders({ enabled: workflowEnabled });

  // ── Settings & Balance ────────────────────────────────────
  const { settings, saveSettings: saveSettingsToFirestore } = useSettings(defaultSettings);
  const { balance } = useBalance({
    products, orders, expenses, fixedAssets, settings, transactions, clients, purchases,
  });

  // ── Centralised handlers ──────────────────────────────────
  const handlers = useAppHandlers({
    products, orders, transactions, purchases, clients, employees,
    fixedAssets, workflowOrders,
    addProduct, updateProduct, addOrder, updateOrder, deleteOrder,
    addExpense, addTransaction, addPurchase, updatePurchase,
    updateTransaction,
    addClient, updateClient, addEmployee, updateEmployee,
    addAsset, updateAsset, addWorkflowOrder, updateWorkflowOrder,
    addJournalEvent, saveSettingsToFirestore,
    settings, toast,
  });

  // ── Side-effects ──────────────────────────────────────────
  useDebtRecalculation({ clients, orders, transactions, updateClient });

  return {
    // Raw collections
    products, orders, setOrders, transactions, expenses, fixedAssets,
    clients, employees, purchases, journalEvents, workflowOrders,
    // Single-entity mutators (needed by Sales, Procurement, etc.)
    deleteTransaction, deleteExpense, updatePurchase, updateExpense,
    // Settings + Balance
    settings, saveSettingsToFirestore, balance,
    // Aggregated handlers
    ...handlers,
  };
}
