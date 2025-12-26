import React from 'react';
import { ChevronDown, ChevronRight, History, Wallet } from 'lucide-react';
import type { Product, Purchase, Transaction } from '../../types';

interface HistoryTabProps {
  purchases: Purchase[];
  products: Product[];
  transactions: Transaction[];
  expandedPurchaseIds: Set<string>;
  togglePurchaseExpand: (id: string) => void;
  handleOpenRepayModal: (purchase: Purchase) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  purchases,
  products,
  transactions,
  expandedPurchaseIds,
  togglePurchaseExpand,
  handleOpenRepayModal,
}) => {
  const totalPaid = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalDebt = purchases.reduce((sum, p) => sum + (Math.max(0, (p.totalInvoiceAmount || 0) - (p.amountPaid || 0))), 0);

  return (
    <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <h3 className="font-bold text-white flex items-center gap-2">
          <History size={18} className="text-slate-400" /> История закупок и Долги
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-400 font-medium sticky top-0">
            <tr>
              <th className="px-6 py-4">Дата</th>
              <th className="px-6 py-4">Поставщик</th>
              <th className="px-6 py-4 text-right">Сумма (Inv.)</th>
              <th className="px-6 py-4 text-center">Метод</th>
              <th className="px-6 py-4 text-center">Статус</th>
              <th className="px-6 py-4 text-right">Оплачено</th>
              <th className="px-6 py-4 text-right">Долг</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {purchases
              .slice()
              .reverse()
              .map((purchase) => {
                const debt = purchase.totalInvoiceAmount - purchase.amountPaid;
                const isExpanded = expandedPurchaseIds.has(purchase.id);
                return (
                  <React.Fragment key={purchase.id}>
                    <tr
                      className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => togglePurchaseExpand(purchase.id)}
                    >
                      <td className="px-6 py-4 text-slate-300">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={16} className="text-slate-400" />
                          )}
                          {new Date(purchase.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        {purchase.supplierName}
                        <div className="text-xs text-slate-500">{purchase.items?.length || 0} поз.</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">
                        ${purchase.totalInvoiceAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${purchase.paymentMethod === 'cash' ? 'bg-emerald-500/20 text-emerald-400' :
                          purchase.paymentMethod === 'bank' ? 'bg-blue-500/20 text-blue-400' :
                            purchase.paymentMethod === 'card' ? 'bg-orange-500/20 text-orange-400' :
                              purchase.paymentMethod === 'mixed' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                          }`}>
                          {purchase.paymentMethod === 'cash' 
                            ? (purchase.paymentCurrency === 'USD' ? '💵 Нал (USD)' : '💰 Нал (UZS)') 
                            : purchase.paymentMethod === 'bank' ? '🏦 Р/С' 
                              : purchase.paymentMethod === 'card' ? '💳 Карта'
                                : purchase.paymentMethod === 'mixed' ? '🔀 Микс' : '📋 Долг'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${purchase.paymentStatus === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : purchase.paymentStatus === 'partial'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                            }`}
                        >
                          {purchase.paymentStatus === 'paid'
                            ? 'Оплачено'
                            : purchase.paymentStatus === 'partial'
                              ? 'Частично'
                              : 'Не оплачено'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-400">
                        ${purchase.amountPaid.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-red-400 font-bold">
                        {debt > 0 ? `$${debt.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {debt > 0 && (
                          <button
                            onClick={() => handleOpenRepayModal(purchase)}
                            className="text-xs bg-slate-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1 ml-auto"
                          >
                            <Wallet size={14} /> Оплатить
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr className="bg-slate-900/50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Payment details for Mixed */}
                            {purchase.paymentMethod === 'mixed' && (
                              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                                <div className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Детализация оплаты (МИКС)</div>
                                <div className="flex flex-wrap gap-4">
                                  {transactions.filter(t => t.relatedId === purchase.id).map(t => (
                                    <div key={t.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 min-w-[140px]">
                                      <div className="text-[10px] text-slate-500 uppercase mb-1">{t.method === 'cash' ? 'Наличные' : t.method === 'card' ? 'Карта' : 'Банк'}</div>
                                      <div className={`text-sm font-mono font-bold ${t.method === 'cash' && t.currency === 'USD' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                        {t.currency === 'UZS' ? `${t.amount.toLocaleString()} UZS` : `$${t.amount.toFixed(2)}`}
                                      </div>
                                    </div>
                                  ))}
                                  {transactions.filter(t => t.relatedId === purchase.id).length === 0 && (
                                    <div className="text-xs text-red-400">Транзакции не найдены</div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                              <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase">
                                Товары в закупке #{purchase.id}
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-slate-900/30 text-xs text-slate-500">
                                  <tr>
                                    <th className="px-4 py-2 text-left">Наименование</th>
                                    <th className="px-4 py-2 text-left">Размеры</th>
                                    <th className="px-4 py-2 text-right">Кол-во</th>
                                    <th className="px-4 py-2 text-right">Цена закупки</th>
                                    <th className="px-4 py-2 text-right">Landed Cost</th>
                                    <th className="px-4 py-2 text-right">Сумма</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                  {(purchase.items || []).map((item, idx) => {
                                    const prod = products.find((p) => p.id === item.productId);
                                    const dims = prod?.dimensions || '-';
                                    return (
                                      <tr key={idx} className="hover:bg-slate-700/20">
                                        <td className="px-4 py-2 text-white font-medium">{item.productName}</td>
                                        <td className="px-4 py-2 text-slate-400">{dims}</td>
                                        <td className="px-4 py-2 text-right font-mono text-slate-300">
                                          {item.quantity}{' '}
                                          <span className="text-xs text-slate-500">{item.unit}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-slate-300">
                                          ${item.invoicePrice?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-amber-400">
                                          ${item.landedCost?.toFixed(2) || item.invoicePrice?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-emerald-400 font-bold">
                                          ${(item.totalLineCost || item.quantity * (item.invoicePrice || 0)).toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {(!purchase.items || purchase.items.length === 0) && (
                                    <tr>
                                      <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                                        Нет данных о товарах
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot className="bg-slate-900/30 border-t border-slate-700">
                                  <tr>
                                    <td colSpan={3} className="px-4 py-2 text-right text-xs text-slate-400">
                                      Итого по накладной:
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-slate-300">
                                      ${purchase.totalInvoiceAmount?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-amber-400">
                                      ${purchase.totalLandedAmount?.toFixed(2) || purchase.totalInvoiceAmount?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  История закупок пуста.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-8">
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500 font-bold mb-1">Всего Оплачено</div>
          <div className="text-xl font-mono text-emerald-400 font-bold">
            ${totalPaid.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500 font-bold mb-1">Общий Долг</div>
          <div className="text-xl font-mono text-red-400 font-bold">
            ${totalDebt.toLocaleString()}
          </div>
        </div>
      </div>
    </div >
  );
};








