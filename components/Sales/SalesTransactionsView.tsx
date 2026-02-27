import React from 'react';
import { Order, Transaction, Expense, JournalEvent } from '../../types';
import { num } from '../../utils/finance';
import { DEFAULT_EXCHANGE_RATE } from '../../constants';
import { TransactionsManager } from './TransactionsManager';

interface SalesTransactionsViewProps {
  orders: Order[];
  transactions: Transaction[];
  expenses: Expense[];
  setOrders: (o: Order[]) => void;
  setTransactions?: (t: Transaction[]) => void;
  setExpenses?: (e: Expense[]) => void;
  onSaveOrders?: (orders: Order[]) => Promise<boolean | void>;
  onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
  onSaveExpenses?: (expenses: Expense[]) => Promise<void>;
  onDeleteTransaction?: (id: string) => Promise<boolean>;
  onDeleteExpense?: (id: string) => Promise<boolean>;
  onAddJournalEvent?: (event: JournalEvent) => Promise<void>;
  currentUserEmail?: string;
  exchangeRate: number;
  t: Record<string, string>;
  theme: string;
  setEditingOrderId: (id: string | null) => void;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

export const SalesTransactionsView: React.FC<SalesTransactionsViewProps> = React.memo(({
  orders, transactions, expenses, setOrders, setTransactions, setExpenses,
  onSaveOrders, onSaveTransactions, onSaveExpenses, onDeleteTransaction, onDeleteExpense,
  onAddJournalEvent, currentUserEmail, exchangeRate, t, theme,
  setEditingOrderId, onToast
}) => {
  return (
    <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
      {/* Detailed cash balance report */}
      <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
        <h3 className={`${t.text} font-bold mb-4 flex items-center gap-2`}>
          📊 Детализация баланса кассы USD
        </h3>

        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
          <div className={`text-xs ${t.textMuted} font-bold border-b ${t.border} pb-2 grid grid-cols-6 gap-2`}>
            <span>ID Заказа</span>
            <span>Клиент</span>
            <span>Метод</span>
            <span>Валюта</span>
            <span className="text-right">Сумма (к балансу USD)</span>
            <span className="text-right">Действия</span>
          </div>

          {(orders || [])
            .filter(o => o.paymentMethod !== 'mixed' && o.paymentMethod !== 'debt')
            .map(o => {
              const rate = num(o.exchangeRate) > 100 ? num(o.exchangeRate) : DEFAULT_EXCHANGE_RATE;
              let paidUSD = num(o.amountPaid);
              if (paidUSD > 100000) paidUSD = paidUSD / rate;
              let totalUSD = num(o.totalAmount);
              if (totalUSD > 100000) totalUSD = totalUSD / rate;
              const finalAmount = paidUSD > 0 ? paidUSD : totalUSD;

              const isCashUSD = o.paymentMethod === 'cash' && o.paymentCurrency !== 'UZS';
              const isLargeAmount = finalAmount > 10000;

              return (
                <div key={o.id} className={`text-xs grid grid-cols-6 gap-2 py-2 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/50'} ${isLargeAmount ? 'bg-red-500/20 border-red-500/30' : isCashUSD ? 'bg-emerald-500/10' : t.bgPanelAlt}`}>
                  <span className={`${t.textSecondary} font-mono`}>{o.id}</span>
                  <span className={`${t.textMuted} truncate`}>{o.customerName}</span>
                  <span className={t.textMuted}>{o.paymentMethod}</span>
                  <span className={t.textMuted}>{o.paymentCurrency || 'USD'}</span>
                  <span className={`text-right font-mono font-bold ${isLargeAmount ? 'text-red-500' : isCashUSD ? 'text-emerald-500' : t.textMuted}`}>
                    {isCashUSD ? `+$${finalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                  </span>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditingOrderId(o.id)}
                      className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded text-[10px] font-bold"
                    >
                      ✎
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Удалить заказ ${o.id}?`)) {
                          const updated = orders.filter(ord => ord.id !== o.id);
                          await onSaveOrders?.(updated);
                          setOrders(updated);
                          onToast('success', 'Заказ удалён');
                        }
                      }}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[10px] font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <div className={`mt-4 pt-4 border-t ${t.border} flex justify-between items-center`}>
          <span className={t.textMuted}>Итого в кассе USD (из заказов):</span>
          <span className="text-emerald-500 font-mono font-bold text-xl">
            ${(orders || [])
              .filter(o => o.paymentMethod === 'cash' && o.paymentCurrency !== 'UZS')
              .reduce((sum, o) => {
                const rate = num(o.exchangeRate) > 100 ? num(o.exchangeRate) : DEFAULT_EXCHANGE_RATE;
                let paidUSD = num(o.amountPaid);
                if (paidUSD > 100000) paidUSD = paidUSD / rate;
                let totalUSD = num(o.totalAmount);
                if (totalUSD > 100000) totalUSD = totalUSD / rate;
                return sum + (paidUSD > 0 ? paidUSD : totalUSD);
              }, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className={`mt-2 text-xs ${theme === 'light' ? 'text-slate-600' : 'text-amber-500'} bg-amber-500/10 p-2 rounded-lg`}>
          💡 Зелёные строки добавляются к балансу USD. Если видите огромные суммы - это ошибки в данных.
        </div>
      </div>

      <TransactionsManager
        transactions={transactions}
        onUpdateTransactions={setTransactions}
        onSaveTransactions={onSaveTransactions}
        onDeleteTransaction={onDeleteTransaction}
        expenses={expenses}
        onUpdateExpenses={setExpenses}
        onSaveExpenses={onSaveExpenses}
        onDeleteExpense={onDeleteExpense}
        onAddJournalEvent={onAddJournalEvent}
        currentUserEmail={currentUserEmail}
        exchangeRate={exchangeRate}
      />
    </div>
  );
});

SalesTransactionsView.displayName = 'SalesTransactionsView';
