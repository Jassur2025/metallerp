import React, { useState } from 'react';
import { WorkflowOrder, JournalEvent } from '../types';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface CancelWorkflowModalProps {
  order: WorkflowOrder;
  workflowOrders: WorkflowOrder[];
  cancelledBy: string;
  onSaveWorkflowOrders: (orders: WorkflowOrder[]) => Promise<boolean | void>;
  onClose: () => void;
  onAddJournalEvent?: (event: JournalEvent) => void;
  journalEvent?: Partial<JournalEvent>;
}

export const CancelWorkflowModal: React.FC<CancelWorkflowModalProps> = ({
  order,
  workflowOrders,
  cancelledBy,
  onSaveWorkflowOrders,
  onClose,
  onAddJournalEvent,
  journalEvent
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const toast = useToast();
  const [cancelReason, setCancelReason] = useState('');

  const handleConfirm = async () => {
    if (!cancelReason.trim()) {
      toast.warning('Укажите причину аннулирования');
      return;
    }

    const updated = workflowOrders.map(o =>
      o.id === order.id
        ? {
            ...o,
            status: 'cancelled' as const,
            cancellationReason: cancelReason.trim(),
            cancelledBy,
            cancelledAt: new Date().toISOString()
          }
        : o
    );

    await onSaveWorkflowOrders(updated);

    if (onAddJournalEvent && journalEvent) {
      onAddJournalEvent({
        ...journalEvent,
        description: `Заказ ${order.id} аннулирован. Причина: ${cancelReason.trim()}`
      } as JournalEvent);
    }

    toast.success('Заказ аннулирован');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className={`${t.bgCard} rounded-2xl border ${t.border} w-full max-w-md p-6`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4 flex items-center gap-2`}>
          <AlertTriangle className="text-red-400" size={24} />
          Аннулирование заказа
        </h3>

        <div className={`${t.bg} rounded-xl p-4 mb-4`}>
          <div className={`text-sm ${t.textMuted}`}>Заказ: <span className={`${t.text} font-mono`}>{order.id}</span></div>
          <div className={`text-sm ${t.textMuted} mt-1`}>Клиент: <span className={t.text}>{order.customerName}</span></div>
          <div className={`text-sm ${t.textMuted} mt-1`}>Сумма: <span className="text-emerald-300 font-mono">{Number(order.totalAmountUZS || 0).toLocaleString()} сум</span></div>
        </div>

        <div className="mb-4">
          <label className={`text-sm ${t.textMuted} mb-2 block`}>Причина аннулирования *</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className={`w-full ${t.bg} border ${t.border} rounded-xl px-4 py-3 ${t.text} outline-none focus:ring-2 focus:ring-red-500/50 h-24 resize-none`}
            placeholder="Укажите причину аннулирования..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 ${t.bgHover} hover:${t.bg} ${t.text} py-3 rounded-xl font-medium`}
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold"
          >
            Аннулировать
          </button>
        </div>
      </div>
    </div>
  );
};
