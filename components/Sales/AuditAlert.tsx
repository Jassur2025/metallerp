import React from 'react';
import { Order, Transaction, Expense } from '../../types';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { num, getSafeRate } from '../../utils/finance';

interface AuditAlertProps {
  suspicious: {
    orders: Order[];
    transactions: Transaction[];
    expenses: Expense[];
  };
  showAuditAlert: boolean;
  setShowAuditAlert: (v: boolean) => void;
  exchangeRate: number;
  t: Record<string, string>;
  theme: string;
}

export const AuditAlert: React.FC<AuditAlertProps> = React.memo(({
  suspicious, showAuditAlert, setShowAuditAlert, exchangeRate, t, theme
}) => {
  const totalCount = suspicious.orders.length + suspicious.transactions.length + suspicious.expenses.length;
  if (totalCount === 0) return null;

  const getRate = (rate: unknown) => getSafeRate(rate, num(exchangeRate));

  return (
    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setShowAuditAlert(!showAuditAlert)}
        className="w-full flex items-center justify-between p-3 px-4 hover:bg-red-500/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
          <AlertTriangle size={16} />
          <span>Аномальные записи ({totalCount})</span>
        </div>
        {showAuditAlert ? <ChevronUp size={16} className="text-red-400" /> : <ChevronDown size={16} className="text-red-400" />}
      </button>
      {showAuditAlert && (
        <div className="px-4 pb-3 space-y-2 animate-fade-in">
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
            {suspicious.orders.map(o => (
              <div key={o.id} className={`text-xs ${theme === 'light' ? 'bg-red-50' : 'bg-slate-900/50'} p-2 rounded-lg flex justify-between border border-red-500/20`}>
                <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-300'}>Заказ {o.id} ({o.customerName})</span>
                <span className="text-red-400 font-bold font-mono">${num(o.totalAmount).toLocaleString()}</span>
              </div>
            ))}
            {suspicious.transactions.map(tx => (
              <div key={tx.id} className={`text-xs ${theme === 'light' ? 'bg-red-50' : 'bg-slate-900/50'} p-2 rounded-lg flex justify-between border border-red-500/20`}>
                <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-300'}>Транзакция {tx.id} ({tx.type})</span>
                <span className="text-red-400 font-bold font-mono">${(tx.currency === 'USD' ? num(tx.amount) : num(tx.amount) / getRate(tx.exchangeRate)).toLocaleString()}</span>
              </div>
            ))}
            {suspicious.expenses.map(e => (
              <div key={e.id} className={`text-xs ${theme === 'light' ? 'bg-red-50' : 'bg-slate-900/50'} p-2 rounded-lg flex justify-between border border-red-500/20`}>
                <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-300'}>Расход {e.id} ({e.description})</span>
                <span className="text-red-400 font-bold font-mono">${(e.currency === 'USD' ? num(e.amount) : num(e.amount) / getRate(e.exchangeRate)).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'} italic`}>* Измените валюту на UZS или исправьте сумму.</p>
        </div>
      )}
    </div>
  );
});

AuditAlert.displayName = 'AuditAlert';
