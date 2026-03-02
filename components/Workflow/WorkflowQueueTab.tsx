import React from 'react';
import { Product, WorkflowOrder, OrderItem } from '../../types';
import { BadgeCheck } from 'lucide-react';

interface WorkflowQueueTabProps {
    queue: WorkflowOrder[];
    products: Product[];
    isCashier: boolean;
    theme: string;
    t: Record<string, string>;
    approveAndConvert: (wf: WorkflowOrder) => void;
    onNavigateToProcurement?: () => void;
    getOrderDiscount: (items: OrderItem[]) => {
        hasDiscount: boolean;
        totalDiscount: number;
        discountPercent: number;
        priceListTotal?: number;
    };
    statusBadge: (status: WorkflowOrder['status']) => string;
    statusLabel: (status: WorkflowOrder['status']) => string;
}

export const WorkflowQueueTab = React.memo<WorkflowQueueTabProps>(({
    queue,
    products,
    isCashier,
    theme,
    t,
    approveAndConvert,
    onNavigateToProcurement,
    getOrderDiscount,
    statusBadge,
    statusLabel,
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {queue.map(wf => {
              const discount = getOrderDiscount(wf.items);
              return (
              <div key={wf.id} className={`${t.bgCard} border ${discount.hasDiscount ? 'border-amber-500/50' : t.border} rounded-xl p-3 ${t.shadow}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`${t.text} font-bold text-sm`}>{wf.customerName}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>ID: {wf.id}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={statusBadge(wf.status)}>{statusLabel(wf.status)}</span>
                    {discount.hasDiscount && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        -{discount.discountPercent.toFixed(1)}% скидка
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-0.5 text-xs">
                  {(Array.isArray(wf.items) ? wf.items : []).slice(0, 3).map((it, idx) => {
                    const product = products.find(p => p.id === it.productId);
                    const priceListPrice = product?.pricePerUnit || it.priceAtSale;
                    const itemDiscount = priceListPrice > it.priceAtSale;
                    return (
                    <div key={idx} className={`flex justify-between ${t.textSecondary}`}>
                      <span className="truncate max-w-[140px]">
                        {it.productName}
                        <span className={`${t.textMuted} ml-1`}>× {it.quantity}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {itemDiscount && (
                          <span className="text-[9px] text-amber-500 line-through">${priceListPrice.toFixed(2)}</span>
                        )}
                        <span className={`font-mono text-[10px] ${itemDiscount ? 'text-amber-400 font-bold' : t.textMuted}`}>
                          ${it.priceAtSale.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                  {Array.isArray(wf.items) && wf.items.length > 3 && <div className={`text-[10px] ${t.textMuted}`}>+ ещё {wf.items.length - 3}</div>}
                </div>

                {/* Показываем инфо о скидке */}
                {discount.hasDiscount && (
                  <div className={`mt-2 p-1.5 rounded ${theme === 'light' ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                    <div className="flex justify-between text-[10px]">
                      <span className={t.textMuted}>По прайсу:</span>
                      <span className={`${t.textMuted} line-through font-mono`}>${discount.priceListTotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-amber-500 font-medium">Скидка:</span>
                      <span className="text-amber-500 font-mono font-bold">-${discount.totalDiscount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div className={`font-mono font-bold ${t.success} text-sm`}>{wf.totalAmountUZS.toLocaleString()} сум</div>
                  {wf.status === 'sent_to_procurement' && (
                    <button onClick={onNavigateToProcurement} className={`px-2 py-1 rounded ${t.warningBg} border ${theme === 'light' ? 'border-amber-200' : 'border-amber-500/20'} ${t.warning} text-[10px] font-medium`}>
                      В закуп
                    </button>
                  )}
                </div>

                {isCashier && wf.status === 'sent_to_cash' && (
                  <button onClick={() => approveAndConvert(wf)} className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-sm">
                    <BadgeCheck size={14} /> Подтвердить
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {queue.length === 0 && (
            <div className={`text-center ${t.textMuted} py-8`}>Заявок нет</div>
          )}
        </div>
    );
});

WorkflowQueueTab.displayName = 'WorkflowQueueTab';
