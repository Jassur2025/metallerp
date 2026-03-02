import React, { createContext, useContext, useMemo } from 'react';
import type { SalesProps } from '../components/Sales/types';

/**
 * SalesContext eliminates prop-drilling from App → Sales → sub-components.
 * All data and handlers that Sales needs are provided through this context.
 * Sub-components within Sales can also call useSalesContext() directly
 * instead of receiving the same props through multiple levels.
 */

const SalesContext = createContext<SalesProps | undefined>(undefined);

export interface SalesProviderProps extends SalesProps {
  children: React.ReactNode;
}

export const SalesProvider: React.FC<SalesProviderProps> = ({ children, ...value }) => {
  const ctx = useMemo<SalesProps>(() => value, [
    value.products,
    value.orders,
    value.setOrders,
    value.settings,
    value.setSettings,
    value.expenses,
    value.employees,
    value.onNavigateToStaff,
    value.clients,
    value.onSaveClients,
    value.transactions,
    value.workflowOrders,
    value.onSaveWorkflowOrders,
    value.currentUserEmail,
    value.onNavigateToProcurement,
    value.onSaveOrders,
    value.onSaveTransactions,
    value.onSaveProducts,
    value.onSaveExpenses,
    value.onAddExpense,
    value.onAddJournalEvent,
    value.onDeleteTransaction,
    value.onDeleteExpense,
  ]);

  return <SalesContext.Provider value={ctx}>{children}</SalesContext.Provider>;
};

export function useSalesContext(): SalesProps {
  const ctx = useContext(SalesContext);
  if (!ctx) {
    throw new Error('useSalesContext must be used within a <SalesProvider>');
  }
  return ctx;
}
