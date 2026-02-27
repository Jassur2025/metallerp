import React from 'react';
import { WorkflowOrder } from '../../types';
import { XCircle, Edit3 } from 'lucide-react';

interface WorkflowCancelledTabProps {
    cancelledOrders: WorkflowOrder[];
    isSales: boolean;
    theme: string;
    t: Record<string, string>;
    startEditCancelled: (wf: WorkflowOrder) => void;
    toUZS: (usd: number) => number;
    statusBadge: (status: WorkflowOrder['status']) => string;
    statusLabel: (status: WorkflowOrder['status']) => string;
}

export const WorkflowCancelledTab = React.memo<WorkflowCancelledTabProps>(({
    cancelledOrders,
    isSales,
    theme,
    t,
    startEditCancelled,
    toUZS,
    statusBadge,
    statusLabel,
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className={`${t.dangerBg} border ${theme === 'light' ? 'border-red-200' : 'border-red-500/20'} rounded-lg p-3 mb-3`}>
            <div className={`flex items-center gap-2 ${t.danger} text-sm`}>
              <XCircle size={14} />
              <span className="font-medium">Аннулированные заказы</span>
            </div>
            <p className={`text-xs ${t.textMuted} mt-1`}>Можно отредактировать и переотправить.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {cancelledOrders.map(wf => (
              <div key={wf.id} className={`${t.bgCard} border ${theme === 'light' ? 'border-red-200' : 'border-red-500/30'} rounded-xl p-3 ${t.shadow}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`${t.text} font-bold text-sm`}>{wf.customerName}</div>
                    <div className={`text-[10px] ${t.textMuted}`}>{new Date(wf.date).toLocaleString('ru-RU')}</div>
                    {wf.cancellationReason && (
                      <div className={`text-[10px] ${t.danger} mt-1 ${t.dangerBg} px-1.5 py-0.5 rounded truncate max-w-[180px]`}>
                        {wf.cancellationReason}
                      </div>
                    )}
                  </div>
                  <span className={statusBadge('cancelled')}>{statusLabel('cancelled')}</span>
                </div>

                <div className="mt-2 space-y-0.5 text-xs">
                  {(Array.isArray(wf.items) ? wf.items : []).slice(0, 3).map((it, idx) => (
                    <div key={idx} className={`flex justify-between ${t.textSecondary}`}>
                      <span className="truncate max-w-[160px]">
                        {it.productName} × {it.quantity}
                      </span>
                      <span className={`font-mono ${t.textMuted} text-[10px]`}>{toUZS(it.total).toLocaleString()}</span>
                    </div>
                  ))}
                  {Array.isArray(wf.items) && wf.items.length > 3 && <div className={`text-[10px] ${t.textMuted}`}>+ ещё {wf.items.length - 3}</div>}
                </div>

                <div className={`mt-2 font-mono font-bold ${t.textMuted} line-through text-sm`}>{wf.totalAmountUZS.toLocaleString()} сум</div>

                {isSales && (
                  <button onClick={() => startEditCancelled(wf)} className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-sm">
                    <Edit3 size={14} /> Редактировать
                  </button>
                )}
              </div>
            ))}
          </div>

          {cancelledOrders.length === 0 && (
            <div className={`text-center ${t.textMuted} py-8`}>Аннулированных заказов нет</div>
          )}
        </div>
    );
});

WorkflowCancelledTab.displayName = 'WorkflowCancelledTab';
