import React from 'react';
import { OrderItem, WorkflowOrder, Product } from '../../types';
import { ClipboardList, BadgeCheck, AlertTriangle } from 'lucide-react';
import { PaymentDistribution } from './PaymentSplitModal';

interface WorkflowQueueProps {
  workflowCashQueue: WorkflowOrder[];
  products: Product[];
  exchangeRate: number;
  t: Record<string, string>;
  theme: string;
  getOrderDiscount: (items: OrderItem[]) => {
    hasDiscount: boolean;
    totalDiscount: number;
    discountPercent: number;
    priceListTotal?: number;
    actualTotal?: number;
  };
  openCancelModal: (wf: WorkflowOrder) => void;
  openWorkflowPaymentModal: (wf: WorkflowOrder) => void;
}

export const WorkflowQueue: React.FC<WorkflowQueueProps> = React.memo(({
  workflowCashQueue, products, exchangeRate, t, theme,
  getOrderDiscount, openCancelModal, openWorkflowPaymentModal
}) => {
  return (
    <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5 overflow-y-auto custom-scrollbar`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${t.text} font-bold flex items-center gap-2`}>
          <ClipboardList size={18} className="text-indigo-400" /> Заявки из Workflow (в кассу)
        </h3>
        <div className={`text-xs ${t.textMuted}`}>{workflowCashQueue.length} заявок</div>
      </div>

      {workflowCashQueue.length === 0 ? (
        <div className={`${t.textMuted} text-center py-10`}>Пока нет заявок из Workflow</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {workflowCashQueue.map((wf: WorkflowOrder) => {
            const discount = getOrderDiscount(wf.items);
            return (
              <div key={wf.id} className={`${t.bgPanelAlt} border ${t.border} rounded-2xl p-5`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`${t.text} font-bold`}>{wf.customerName}</div>
                    <div className={`text-xs ${t.textMuted} mt-1`}>{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    <div className={`text-xs ${t.textMuted} mt-1`}>ID: {wf.id} • Создал: {wf.createdBy}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-500 font-mono font-bold">{Number(wf.totalAmountUZS || 0).toLocaleString()} сум</div>
                    <div className={`text-xs ${t.textMuted}`}>${Number(wf.totalAmount || 0).toFixed(2)}</div>
                    {discount.hasDiscount && (
                      <div className="text-xs text-orange-400 font-semibold mt-1">
                        🏷️ Скидка: {discount.discountPercent.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  {(wf.items || []).slice(0, 5).map((it: OrderItem, idx: number) => {
                    const prod = products.find(p => p.id === it.productId);
                    const dims = prod?.dimensions || it.dimensions || '';
                    const priceListPrice = prod?.pricePerUnit || it.priceAtSale;
                    const itemDiscount = priceListPrice > 0 ? ((priceListPrice - it.priceAtSale) / priceListPrice) * 100 : 0;
                    const hasItemDiscount = itemDiscount > 0.1;
                    return (
                      <div key={idx} className={`flex justify-between items-center ${t.textSecondary}`}>
                        <span className="truncate max-w-[220px]">
                          {it.productName}
                          {dims && dims !== '-' && <span className={`${t.textMuted} ml-1`}>({dims})</span>}
                          <span className={`${t.textMuted} ml-1`}>× {it.quantity}</span>
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasItemDiscount && (
                            <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                              -{itemDiscount.toFixed(1)}%
                            </span>
                          )}
                          <span className={`font-mono ${t.textMuted}`}>{Math.round(Number(it.total || 0) * Number(wf.exchangeRate || exchangeRate)).toLocaleString()} сум</span>
                        </div>
                      </div>
                    );
                  })}
                  {(wf.items || []).length > 5 && <div className={`text-xs ${t.textMuted}`}>+ ещё {(wf.items || []).length - 5} поз.</div>}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className={`text-xs ${t.textMuted}`}>
                    Оплата: <span className={`${t.text} font-semibold`}>{wf.paymentMethod}</span>
                    {wf.paymentMethod === 'debt' && <span className="ml-2 text-amber-500 font-bold">ДОЛГ</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openCancelModal(wf)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-xl font-medium flex items-center gap-1 border border-red-500/20"
                    >
                      ✕ Аннулировать
                    </button>
                    <button
                      onClick={() => openWorkflowPaymentModal(wf)}
                      className={`${theme === 'light' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2`}
                    >
                      <BadgeCheck size={18} /> Подтвердить
                    </button>
                  </div>
                </div>

                <div className={`mt-3 text-xs ${t.textMuted} flex items-center gap-2`}>
                  <AlertTriangle size={14} className="text-amber-500" />
                  Если остатков не хватит — заявка уйдет обратно в закуп.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

WorkflowQueue.displayName = 'WorkflowQueue';
