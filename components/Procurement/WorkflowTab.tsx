import React from 'react';
import { ClipboardList, Plus, Send, XCircle, AlertCircle, CheckCircle2, Package, User, Calendar, Hash } from 'lucide-react';
import type { Product, WorkflowOrder, OrderItem } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';
import { getMissingItems } from '../../utils/inventoryHelpers';

interface WorkflowTabProps {
  workflowQueue: WorkflowOrder[];
  products: Product[];
  createDraftPurchaseFromWorkflow: (wf: WorkflowOrder) => void;
  sendWorkflowToCash: (wf: WorkflowOrder) => void;
  onCancelWorkflow?: (wf: WorkflowOrder) => void;
}

export const WorkflowTab: React.FC<WorkflowTabProps> = ({
  workflowQueue,
  products,
  createDraftPurchaseFromWorkflow,
  sendWorkflowToCash,
  onCancelWorkflow,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';

  // Расчёт скидки для заказа относительно прайс-листа
  const getOrderDiscount = (items: OrderItem[]) => {
    if (!Array.isArray(items) || items.length === 0) return { hasDiscount: false, totalDiscount: 0, discountPercent: 0 };
    
    let priceListTotal = 0;
    let actualTotal = 0;
    
    items.forEach(it => {
      const product = products.find(p => p.id === it.productId);
      const priceListPrice = product?.pricePerUnit || it.priceAtSale;
      priceListTotal += priceListPrice * it.quantity;
      actualTotal += it.priceAtSale * it.quantity;
    });
    
    const totalDiscount = priceListTotal - actualTotal;
    const discountPercent = priceListTotal > 0 ? (totalDiscount / priceListTotal) * 100 : 0;
    
    return {
      hasDiscount: totalDiscount > 0.01,
      totalDiscount,
      discountPercent,
      priceListTotal,
      actualTotal
    };
  };

  return (
    <div className={`flex-1 ${isDark ? 'bg-gradient-to-b from-slate-800/90 to-slate-900/90' : 'bg-white'} rounded-2xl border ${t.border} shadow-lg overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex justify-between items-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <ClipboardList size={16} className="text-amber-500" />
          </div>
          <h3 className={`font-bold ${t.text}`}>Workflow заявки в закуп</h3>
        </div>
        <div className={`${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'} px-3 py-1.5 rounded-full border`}>
          <span className="text-xs text-amber-500 font-semibold">{workflowQueue.length} заявок</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {workflowQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}>
              <ClipboardList size={28} className={t.textMuted} />
            </div>
            <p className={`${t.textMuted} text-sm font-medium`}>Заявок пока нет</p>
            <p className={`${t.textMuted} text-xs mt-1`}>Заявки из Workflow появятся здесь</p>
          </div>
        ) : (
          workflowQueue.map((wf) => {
            const missing = getMissingItems(wf.items, products);
            const ready = missing.length === 0;
            const discount = getOrderDiscount(wf.items);
            
            return (
              <div
                key={wf.id}
                className={`${isDark ? 'bg-slate-800/60' : 'bg-white'} rounded-2xl border ${t.border} overflow-hidden transition-all duration-200 hover:shadow-md ${discount.hasDiscount ? 'ring-1 ring-amber-500/30' : ''}`}
              >
                {/* Card Header */}
                <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${t.border}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${ready ? 'bg-emerald-500/10' : 'bg-amber-500/10'} flex items-center justify-center`}>
                      {ready ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-amber-500" />}
                    </div>
                    <div>
                      <div className={`${t.text} font-bold flex items-center gap-2`}>
                        <User size={14} className={t.textMuted} /> {wf.customerName}
                      </div>
                      <div className={`text-xs ${t.textMuted} mt-0.5 flex items-center gap-3 flex-wrap`}>
                        <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(wf.date).toLocaleString('ru-RU')}</span>
                        <span className="flex items-center gap-1"><Hash size={11} /> {wf.id}</span>
                        <span>Создал: {wf.createdBy}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {discount.hasDiscount && (
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-200'} border`}>
                        🏷️ -{discount.discountPercent.toFixed(1)}%
                      </span>
                    )}
                    {ready ? (
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} border flex items-center gap-1`}>
                        <CheckCircle2 size={12} /> Всё в наличии
                      </span>
                    ) : (
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200'} border flex items-center gap-1`}>
                        <AlertCircle size={12} /> Не хватает: {missing.length}
                      </span>
                    )}
                    <span className={`text-sm font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {wf.totalAmountUZS.toLocaleString()} сум
                    </span>
                  </div>
                </div>

                {/* Discount Details */}
                {discount.hasDiscount && (
                  <div className={`px-5 py-2.5 ${isDark ? 'bg-amber-500/5' : 'bg-amber-50/50'} border-b ${t.border}`}>
                    <div className="flex items-center gap-5 text-xs">
                      <div>
                        <span className={t.textMuted}>По прайсу: </span>
                        <span className={`${t.textMuted} line-through font-mono`}>${discount.priceListTotal?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className={t.textMuted}>Продано: </span>
                        <span className="text-amber-500 font-mono font-bold">${discount.actualTotal?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className={t.textMuted}>Скидка: </span>
                        <span className="text-amber-500 font-mono font-bold">-${discount.totalDiscount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Body */}
                <div className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Missing Items */}
                    <div className={`${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-xl p-4 border ${t.border}`}>
                      <div className={`text-xs ${t.textMuted} font-semibold mb-3 uppercase tracking-wider flex items-center gap-1.5`}>
                        <Package size={12} /> Недостающие позиции
                      </div>
                      {missing.length === 0 ? (
                        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          <CheckCircle2 size={16} /> Все позиции в наличии
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {missing.slice(0, 6).map((m, idx) => {
                            const prod = products.find((p) => p.id === m.item.productId);
                            const dims = prod?.dimensions || m.item.dimensions || '';
                            return (
                              <div key={idx} className={`flex justify-between items-center text-sm py-1`}>
                                <span className={`${t.text} truncate max-w-[250px]`}>
                                  {m.item.productName}
                                  {dims && dims !== '-' && (
                                    <span className={`text-xs ${t.textMuted} ml-1`}>({dims})</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span className="text-xs font-mono text-red-400 font-semibold">-{m.missingQty}</span>
                                  <span className={`text-[10px] ${t.textMuted}`}>/ есть {m.available}</span>
                                </div>
                              </div>
                            );
                          })}
                          {missing.length > 6 && (
                            <div className={`text-xs ${t.textMuted} pt-1`}>+ ещё {missing.length - 6} поз.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2.5">
                      <button
                        onClick={() => createDraftPurchaseFromWorkflow(wf)}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 
                          bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/20 active:scale-[0.98]`}
                      >
                        <Plus size={16} /> Создать черновик закупки
                      </button>
                      <button
                        onClick={() => sendWorkflowToCash(wf)}
                        disabled={!ready}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200
                          ${!ready
                            ? `${isDark ? 'bg-slate-800/60 text-slate-500 border border-slate-700/60' : 'bg-slate-100 text-slate-400 border border-slate-200'} cursor-not-allowed`
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
                          }`}
                      >
                        <Send size={16} /> Отправить в кассу
                      </button>
                      {onCancelWorkflow && (
                        <button
                          onClick={() => onCancelWorkflow(wf)}
                          className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200
                            ${isDark ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'}`}
                        >
                          <XCircle size={15} /> Аннулировать заказ
                        </button>
                      )}
                      <p className={`text-[11px] ${t.textMuted} text-center`}>
                        Отправка в кассу доступна при наличии всех позиций
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

