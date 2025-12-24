import React from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { Order } from '../../types';

interface ReceiptModalProps {
  order: Order;
  onPrint: (order: Order) => void;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps & {
  onPrintInvoice?: (order: Order) => void;
  onPrintWaybill?: (order: Order) => void;
}> = ({ order, onPrint, onClose, onPrintInvoice, onPrintWaybill }) => {
  const handleBrowserPrint = () => {
    const printContent = document.getElementById('receipt-preview');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Чек ${order.id}</title>
              <style>
                body { 
                  margin: 0; 
                  padding: 20px; 
                  font-family: Arial, sans-serif; 
                  background: white;
                  color: black;
                }
                @media print {
                  @page { 
                    size: 80mm auto; 
                    margin: 0; 
                  }
                  body { padding: 10px; }
                }
              </style>
            </head>
            <body>${printContent.innerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md border border-gray-200 shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" /> Чек продажи
            </h3>
            <p className="text-sm text-gray-600 mt-1">Заказ #{order.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div id="receipt-preview" className="bg-white text-black space-y-4">
            <div className="text-center border-b-2 border-gray-300 pb-4">
              <h2 className="text-2xl font-bold text-gray-900">METAL ERP</h2>
              <p className="text-sm text-gray-600 mt-1">Чек продажи</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Заказ:</span>
                <span className="font-semibold">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Дата:</span>
                <span>{new Date(order.date).toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Клиент:</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Продавец:</span>
                <span>{order.sellerName}</span>
              </div>
            </div>

            <div className="border-t border-b border-gray-300 py-4 space-y-3">
              {order.items.map((item, idx) => {
                const itemTotalUZS = item.total * order.exchangeRate;
                const itemPriceUZS = item.priceAtSale * order.exchangeRate;
                return (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {item.productName}
                        {item.dimensions && <span className="text-xs text-gray-500 ml-1">({item.dimensions})</span>}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {item.quantity} {item.unit} × {itemPriceUZS.toLocaleString()} сўм
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-gray-900">{itemTotalUZS.toLocaleString()} сўм</div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Подытог:</span>
                <span className="font-mono">{(order.subtotalAmount * order.exchangeRate).toLocaleString()} сўм</span>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>НДС ({order.vatRateSnapshot}%):</span>
                <span className="font-mono">+{(order.vatAmount * order.exchangeRate).toLocaleString()} сўм</span>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-gray-300 font-bold text-lg text-emerald-600">
                <span>ИТОГО:</span>
                <span className="font-mono">{order.totalAmountUZS.toLocaleString()} сўм</span>
              </div>
            </div>

            <div className="border-t border-gray-300 pt-4 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Способ оплаты:</span>
                <span className="font-medium">
                  {order.paymentMethod === 'cash'
                    ? `Наличные (${order.paymentCurrency || 'UZS'})`
                    : order.paymentMethod === 'card'
                      ? 'Карта (UZS)'
                      : order.paymentMethod === 'bank'
                        ? 'Перечисление (UZS)'
                        : 'Долг (USD)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Статус:</span>
                <span className={`font-medium ${order.paymentStatus === 'paid' ? 'text-emerald-600' :
                    order.paymentStatus === 'unpaid' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                  {order.paymentStatus === 'paid' ? 'Оплачено' :
                    order.paymentStatus === 'unpaid' ? 'Не оплачено' : 'Частично оплачено'}
                </span>
              </div>
            </div>

            <div className="text-center pt-4 border-t border-dashed border-gray-300 text-xs text-gray-500">
              <p>Спасибо за покупку!</p>
              <p className="mt-1">{new Date().toLocaleString('ru-RU')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onPrint(order)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-105"
            title="Скачать чек в формате PDF"
          >
            <FileText size={18} />
            Скачать PDF
          </button>
          <button
            onClick={handleBrowserPrint}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-105"
            title="Распечатать чек"
          >
            <Printer size={18} />
            Печать
          </button>
        </div>
        <div className="px-6 pb-6 pt-0 bg-gradient-to-r from-gray-50 to-blue-50 flex flex-col sm:flex-row gap-3">
          {onPrintInvoice && (
            <button
              onClick={() => onPrintInvoice(order)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:scale-105"
            >
              <FileText size={18} /> Счет на оплату
            </button>
          )}
          {onPrintWaybill && (
            <button
              onClick={() => onPrintWaybill(order)}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30 hover:shadow-xl hover:scale-105"
            >
              <FileText size={18} /> Накладная
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all hover:scale-105"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};







