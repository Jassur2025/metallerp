import React from 'react';
import { Order } from '../../types';
import { PaymentMethod } from './types';

interface OrderEditModalProps {
  editingOrderId: string;
  editOrderData: {
    totalAmount: string;
    amountPaid: string;
    paymentMethod: string;
    paymentCurrency: string;
  };
  setEditOrderData: React.Dispatch<React.SetStateAction<{
    totalAmount: string;
    amountPaid: string;
    paymentMethod: string;
    paymentCurrency: string;
  }>>;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  onSaveOrders?: (orders: Order[]) => Promise<boolean | void>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = React.memo(({
  editingOrderId, editOrderData, setEditOrderData, orders, setOrders,
  onSaveOrders, onClose, onSuccess
}) => {
  const handleSave = async () => {
    const updated = orders.map(o =>
      o.id === editingOrderId
        ? {
            ...o,
            totalAmount: parseFloat(editOrderData.totalAmount) || 0,
            amountPaid: parseFloat(editOrderData.amountPaid) || 0,
            paymentMethod: editOrderData.paymentMethod as PaymentMethod,
            paymentCurrency: editOrderData.paymentCurrency as 'USD' | 'UZS'
          }
        : o
    );
    await onSaveOrders?.(updated);
    setOrders(updated);
    onSuccess('Заказ обновлён');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          ✎ Редактирование заказа
        </h3>

        <div className="text-sm text-slate-400 mb-4">ID: <span className="text-white font-mono">{editingOrderId}</span></div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Сумма (totalAmount) в USD</label>
            <input
              type="number"
              value={editOrderData.totalAmount}
              onChange={(e) => setEditOrderData(prev => ({ ...prev, totalAmount: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Оплачено (amountPaid) в USD</label>
            <input
              type="number"
              value={editOrderData.amountPaid}
              onChange={(e) => setEditOrderData(prev => ({ ...prev, amountPaid: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Метод оплаты</label>
            <select
              value={editOrderData.paymentMethod}
              onChange={(e) => setEditOrderData(prev => ({ ...prev, paymentMethod: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
              <option value="debt">Debt</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Валюта оплаты</label>
            <select
              value={editOrderData.paymentCurrency}
              onChange={(e) => setEditOrderData(prev => ({ ...prev, paymentCurrency: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
            >
              <option value="USD">USD</option>
              <option value="UZS">UZS</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
});

OrderEditModal.displayName = 'OrderEditModal';
