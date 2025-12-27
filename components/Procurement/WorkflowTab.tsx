import React from 'react';
import { ClipboardList, Plus, Send, XCircle } from 'lucide-react';
import type { Product, WorkflowOrder, OrderItem } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';

interface MissingRow {
  item: OrderItem;
  available: number;
  missingQty: number;
}

interface WorkflowTabProps {
  workflowQueue: WorkflowOrder[];
  products: Product[];
  getMissingItems: (items: OrderItem[]) => MissingRow[];
  createDraftPurchaseFromWorkflow: (wf: WorkflowOrder) => void;
  sendWorkflowToCash: (wf: WorkflowOrder) => void;
  onCancelWorkflow?: (wf: WorkflowOrder) => void;
}

export const WorkflowTab: React.FC<WorkflowTabProps> = ({
  workflowQueue,
  products,
  getMissingItems,
  createDraftPurchaseFromWorkflow,
  sendWorkflowToCash,
  onCancelWorkflow,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className={`flex-1 ${t.bgCard} rounded-xl border ${t.border} shadow-lg overflow-hidden flex flex-col`}>
      <div className={`p-4 border-b ${t.border} flex justify-between items-center ${t.bg}`}>
        <h3 className={`font-bold ${t.text} flex items-center gap-2`}>
          <ClipboardList size={18} className="text-amber-400" /> Workflow заявки в закуп
        </h3>
        <div className={`text-xs ${t.textMuted}`}>{workflowQueue.length} заявок</div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {workflowQueue.length === 0 ? (
          <div className={`p-12 text-center ${t.textMuted}`}>Заявок из Workflow нет.</div>
        ) : (
          <div className={`divide-y ${t.divide}`}>
            {workflowQueue.map((wf) => {
              const missing = getMissingItems(wf.items);
              const ready = missing.length === 0;
              return (
                <div key={wf.id} className={`p-5 hover:${t.bgHover} transition-colors`}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className={`${t.text} font-bold`}>{wf.customerName}</div>
                      <div className={`text-xs ${t.textMuted} mt-1`}>
                        {new Date(wf.date).toLocaleString('ru-RU')} • {wf.id}
                      </div>
                      <div className={`text-xs ${t.textMuted} mt-1`}>Создал: {wf.createdBy}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ready ? (
                        <span className="text-[11px] font-bold px-2 py-1 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          Всё в наличии
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-1 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Не хватает: {missing.length}
                        </span>
                      )}
                      <span className="text-sm font-mono text-emerald-300">
                        {wf.totalAmountUZS.toLocaleString()} сум
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className={`${t.bg} border ${t.border} rounded-xl p-4`}>
                      <div className={`text-xs ${t.textMuted} font-medium mb-2`}>Недостающие позиции</div>
                      {missing.length === 0 ? (
                        <div className={`text-sm ${t.textMuted}`}>Нет недостачи</div>
                      ) : (
                        <div className="space-y-1 text-sm">
                          {missing.slice(0, 8).map((m, idx) => {
                            const prod = products.find((p) => p.id === m.item.productId);
                            const dims = prod?.dimensions || m.item.dimensions || '';
                            return (
                              <div key={idx} className={`flex justify-between ${t.text}`}>
                                <span className="truncate max-w-[280px]">
                                  {m.item.productName}
                                  {dims && dims !== '-' && (
                                    <span className={`text-slate-500 ml-1`}>({dims})</span>
                                  )}
                                </span>
                                <span className="font-mono text-amber-300">
                                  {m.missingQty} / в наличии {m.available}
                                </span>
                              </div>
                            );
                          })}
                          {missing.length > 8 && (
                            <div className={`text-xs ${t.textMuted}`}>+ ещё {missing.length - 8} поз.</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => createDraftPurchaseFromWorkflow(wf)}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                      >
                        <Plus size={18} /> Создать черновик закупки (по недостаче)
                      </button>
                      <button
                        onClick={() => sendWorkflowToCash(wf)}
                        disabled={!ready}
                        className={`w-full bg-emerald-600 hover:bg-emerald-500 disabled:${t.bg} disabled:${t.textMuted} disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2`}
                      >
                        <Send size={18} /> Отправить в кассу
                      </button>                      {onCancelWorkflow && (
                        <button
                          onClick={() => onCancelWorkflow(wf)}
                          className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 py-3 rounded-xl font-medium flex items-center justify-center gap-2 border border-red-600/30"
                        >
                          <XCircle size={18} /> Аннулировать заказ
                        </button>
                      )}                      <div className={`text-xs ${t.textMuted}`}>
                        “Отправить в кассу” доступно только когда все позиции есть в наличии.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};








