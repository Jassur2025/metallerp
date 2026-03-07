import React from 'react';
import { FileText, Printer, X, Wallet, CreditCard, Building2, AlertCircle, Calendar, Hash, User, UserCheck, Package, Receipt, Download, FileCheck, Truck } from 'lucide-react';
import { Order } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface ReceiptModalProps {
  order: Order;
  onPrint: (order: Order) => void;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps & {
  onPrintInvoice?: (order: Order) => void;
  onPrintWaybill?: (order: Order) => void;
}> = ({ order, onPrint, onClose, onPrintInvoice, onPrintWaybill }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';

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

  // Payment method display
  const getPaymentMethodInfo = () => {
    switch (order.paymentMethod) {
      case 'cash': return {
        label: `Наличные (${order.paymentCurrency || 'UZS'})`,
        icon: <Wallet size={14} />,
        color: isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50'
      };
      case 'card': return {
        label: 'Карта (UZS)',
        icon: <CreditCard size={14} />,
        color: isDark ? 'text-purple-400 bg-purple-500/10' : 'text-purple-600 bg-purple-50'
      };
      case 'bank': return {
        label: 'Перечисление (UZS)',
        icon: <Building2 size={14} />,
        color: isDark ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-50'
      };
      case 'debt': return {
        label: 'В долг',
        icon: <AlertCircle size={14} />,
        color: isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-50'
      };
      case 'mixed': return {
        label: 'Смешанная оплата',
        icon: <Wallet size={14} />,
        color: isDark ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50'
      };
      default: return {
        label: order.paymentMethod || 'Не указано',
        icon: <Wallet size={14} />,
        color: isDark ? 'text-slate-400 bg-slate-500/10' : 'text-slate-600 bg-slate-50'
      };
    }
  };

  const paymentInfo = getPaymentMethodInfo();

  const statusConfig = order.paymentStatus === 'paid'
    ? { label: 'Оплачено', color: isDark ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    : order.paymentStatus === 'partial'
      ? { label: 'Частично оплачено', color: isDark ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200' }
      : { label: 'Не оплачено', color: isDark ? 'text-red-400 bg-red-500/15 border-red-500/30' : 'text-red-600 bg-red-50 border-red-200' };

  // Calculate if there was a discount (subtotal before VAT vs raw item totals)
  const rawItemsTotal = order.items.reduce((sum, item) => sum + item.total, 0);
  const discountUSD = rawItemsTotal - order.subtotalAmount;
  const hasDiscount = discountUSD > 0.01;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl w-full max-w-md border shadow-2xl overflow-hidden animate-fade-in`}>
        {/* Header */}
        <div className={`px-5 py-4 ${isDark ? 'bg-slate-800/80 border-b border-slate-700/60' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200'} flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/15' : 'bg-blue-100'}`}>
              <Receipt size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${t.text} leading-tight`}>Чек продажи</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  №{order.reportNo || order.id.slice(-6)}
                </span>
                <span className={`text-[10px] ${t.textMuted}`}>
                  {new Date(order.date).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
          {/* Hidden print content */}
          <div id="receipt-preview" className="hidden">
            <div style={{ fontFamily: 'Arial, sans-serif', background: 'white', color: 'black', padding: 20 }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 15 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>METAL ERP</h2>
                <p style={{ margin: '5px 0', fontSize: 12 }}>Чек продажи</p>
              </div>
              <div style={{ marginBottom: 15, fontSize: 12 }}>
                <p style={{ margin: '3px 0' }}><strong>Отчёт №:</strong> {order.reportNo || order.id.slice(-6)}</p>
                <p style={{ margin: '3px 0' }}><strong>Дата:</strong> {new Date(order.date).toLocaleString('ru-RU')}</p>
                <p style={{ margin: '3px 0' }}><strong>Клиент:</strong> {order.customerName}</p>
                <p style={{ margin: '3px 0' }}><strong>Продавец:</strong> {order.sellerName}</p>
              </div>
              <div style={{ borderTop: '1px solid #ccc', borderBottom: '1px solid #ccc', padding: '10px 0', margin: '15px 0' }}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold' }}>{item.productName}</span>
                      <span>{(item.total * order.exchangeRate).toLocaleString()} сўм</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      {item.quantity} {item.unit} × {(item.priceAtSale * order.exchangeRate).toLocaleString()} сўм
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Подытог:</span>
                  <span>{(order.subtotalAmount * order.exchangeRate).toLocaleString()} сўм</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>НДС ({order.vatRateSnapshot}%):</span>
                  <span>{(order.vatAmount * order.exchangeRate).toLocaleString()} сўм</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: 5 }}>
                  <span>ИТОГО:</span>
                  <span>{order.totalAmountUZS.toLocaleString()} сўм</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#666' }}>
                <p>Спасибо за покупку!</p>
              </div>
            </div>
          </div>

          {/* Visible receipt content */}
          <div className="p-5 space-y-4">
            {/* Client & Seller Info */}
            <div className={`grid grid-cols-2 gap-3`}>
              <div className={`${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'} border rounded-xl p-3`}>
                <div className={`flex items-center gap-1.5 mb-1`}>
                  <User size={12} className={t.textMuted} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Клиент</span>
                </div>
                <p className={`text-sm font-bold ${t.text} truncate`}>{order.customerName}</p>
              </div>
              <div className={`${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'} border rounded-xl p-3`}>
                <div className={`flex items-center gap-1.5 mb-1`}>
                  <UserCheck size={12} className={t.textMuted} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Продавец</span>
                </div>
                <p className={`text-sm font-bold ${t.text} truncate`}>{order.sellerName}</p>
              </div>
            </div>

            {/* Date & Report */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Calendar size={13} className={t.textMuted} />
                <span className={`text-xs ${t.textMuted}`}>
                  {new Date(order.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={13} className={t.textMuted} />
                <span className={`text-xs font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {order.reportNo || order.id.slice(-6)}
                </span>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className={`flex items-center gap-1.5 mb-2`}>
                <Package size={13} className={t.textMuted} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Товары ({order.items.length})</span>
              </div>
              <div className={`${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'} border rounded-xl overflow-hidden`}>
                {order.items.map((item, idx) => {
                  const itemTotalUZS = Math.round(item.total * order.exchangeRate);
                  const itemPriceUZS = Math.round(item.priceAtSale * order.exchangeRate);
                  return (
                    <div key={idx} className={`px-3 py-2.5 ${idx > 0 ? (isDark ? 'border-t border-slate-700/40' : 'border-t border-slate-200') : ''}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-semibold ${t.text} block truncate`}>
                            {item.productName}
                            {item.dimensions && item.dimensions !== '-' && (
                              <span className={`text-[10px] ${t.textMuted} ml-1 font-normal`}>({item.dimensions})</span>
                            )}
                          </span>
                          <span className={`text-[11px] ${t.textMuted} font-mono`}>
                            {item.quantity} {item.unit} × {itemPriceUZS.toLocaleString()} сўм
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'} whitespace-nowrap`}>
                          {itemTotalUZS.toLocaleString()} <span className="text-[10px] opacity-60">сўм</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals */}
            <div className={`${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'} border rounded-xl p-3 space-y-2`}>
              <div className={`flex justify-between text-xs ${t.textMuted}`}>
                <span>Подытог:</span>
                <span className="font-mono">{Math.round(order.subtotalAmount * order.exchangeRate).toLocaleString()} сўм</span>
              </div>
              <div className={`flex justify-between text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                <span>НДС ({order.vatRateSnapshot}%):</span>
                <span className="font-mono">+{Math.round(order.vatAmount * order.exchangeRate).toLocaleString()} сўм</span>
              </div>
              {hasDiscount && (
                <div className={`flex justify-between text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                  <span>Скидка:</span>
                  <span className="font-mono">−{Math.round(discountUSD * order.exchangeRate).toLocaleString()} сўм (−${discountUSD.toFixed(2)})</span>
                </div>
              )}
              <div className={`flex justify-between items-center pt-2 border-t ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                <span className={`font-bold text-sm ${t.text}`}>ИТОГО:</span>
                <div className="text-right">
                  <span className={`font-mono font-extrabold text-xl ${hasDiscount ? (isDark ? 'text-orange-400' : 'text-orange-600') : (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>
                    {order.totalAmountUZS.toLocaleString()} <span className="text-xs opacity-70">сўм</span>
                  </span>
                  <span className={`block text-[11px] font-mono ${t.textMuted}`}>${order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment & Status */}
            <div className="flex gap-3">
              <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl ${paymentInfo.color} border ${isDark ? 'border-transparent' : ''}`}>
                {paymentInfo.icon}
                <span className="text-xs font-bold">{paymentInfo.label}</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${statusConfig.color}`}>
                <span className="text-xs font-bold">{statusConfig.label}</span>
              </div>
            </div>

            {/* Paid amount info */}
            {order.amountPaid != null && order.amountPaid > 0 && order.paymentStatus !== 'paid' && (
              <div className={`text-xs ${t.textMuted} flex justify-between px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                <span>Оплачено:</span>
                <span className="font-mono font-bold">${order.amountPaid.toFixed(2)} из ${order.totalAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Payment due date */}
            {order.paymentDueDate && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial') && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <Calendar size={14} />
                <span className="text-xs font-bold">Срок оплаты: {new Date(order.paymentDueDate).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={`p-4 ${isDark ? 'bg-slate-800/60 border-t border-slate-700/60' : 'bg-slate-50 border-t border-slate-200'}`}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => onPrint(order)}
              className={`${isDark ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'} text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg`}
            >
              <Download size={15} /> PDF
            </button>
            <button
              onClick={handleBrowserPrint}
              className={`${isDark ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'} text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg`}
            >
              <Printer size={15} /> Печать
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {onPrintInvoice && (
              <button
                onClick={() => onPrintInvoice(order)}
                className={`${isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-500 hover:bg-indigo-600'} text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all`}
              >
                <FileCheck size={13} /> Счёт
              </button>
            )}
            {onPrintWaybill && (
              <button
                onClick={() => onPrintWaybill(order)}
                className={`${isDark ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-500 hover:bg-purple-600'} text-white py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all`}
              >
                <Truck size={13} /> Накладная
              </button>
            )}
            <button
              onClick={onClose}
              className={`${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} py-2 rounded-xl font-bold text-xs transition-all`}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};







