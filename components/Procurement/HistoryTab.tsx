import React from 'react';
import { ChevronDown, ChevronRight, History, Wallet } from 'lucide-react';
import type { Product, Purchase, Transaction } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const totalPaid = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalDebt = purchases.reduce((sum, p) => sum + (Math.max(0, (p.totalInvoiceAmount || 0) - (p.amountPaid || 0))), 0);

  return (
    <div className={`flex-1 ${t.bgCard} rounded-xl border ${t.border} shadow-lg overflow-hidden flex flex-col`}>
      <div className={`p-4 border-b ${t.border} flex justify-between items-center ${t.bg}`}>
        <h3 className={`font-bold ${t.text} flex items-center gap-2`}>
          <History size={18} className={t.textMuted} /> История закупок и Долги
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className={`${t.bg} text-xs uppercase ${t.textMuted} font-medium sticky top-0`}>
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
          <tbody className={`divide-y ${t.divide}`}>
            {purchases
              .slice()
              .reverse()
              .map((purchase) => {
                const debt = purchase.totalInvoiceAmount - purchase.amountPaid;
                const isExpanded = expandedPurchaseIds.has(purchase.id);
                return (
                  <React.Fragment key={purchase.id}>
                    <tr
                      className={`hover:${t.bgHover} transition-colors cursor-pointer`}
                      onClick={() => togglePurchaseExpand(purchase.id)}
                    >
                      <td className={`px-6 py-4 ${t.textMuted}`}>
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown size={16} className={t.textMuted} />
                          ) : (
                            <ChevronRight size={16} className={t.textMuted} />
                          )}
                          {new Date(purchase.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className={`px-6 py-4 font-medium ${t.text}`}>
                        {purchase.supplierName}
                        <div className={`text-xs ${t.textMuted}`}>{purchase.items?.length || 0} поз.</div>
                      </td>
                      <td className={`px-6 py-4 text-right font-mono ${t.textMuted}`}>
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
                      <td className={`px-6 py-4 text-right font-mono ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        ${purchase.amountPaid.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                        {debt > 0 ? `$${debt.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {debt > 0 && (
                          <button
                            onClick={() => handleOpenRepayModal(purchase)}
                            className={`text-xs ${t.bgHover} hover:bg-emerald-600 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1 ml-auto`}
                          >
                            <Wallet size={14} /> Оплатить
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr className={t.bg}>
                        <td colSpan={8} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Payment details for Mixed */}
                            {purchase.paymentMethod === 'mixed' && (
                              <div className={`${t.bgCard} rounded-xl border ${t.border} p-4`}>
                                <div className={`text-[10px] font-bold ${t.textMuted} mb-3 uppercase tracking-wider`}>Детализация оплаты (МИКС)</div>
                                <div className="flex flex-wrap gap-4">
                                  {transactions.filter(t => t.relatedId === purchase.id).map(t => (
                                    <div key={t.id} className={`${t.bg} p-3 rounded-lg border ${t.border} min-w-[140px]`}>
                                      <div className={`text-[10px] ${t.textMuted} uppercase mb-1`}>{t.method === 'cash' ? 'Наличные' : t.method === 'card' ? 'Карта' : 'Банк'}</div>
                                      <div className={`text-sm font-mono font-bold ${t.method === 'cash' && t.currency === 'USD' ? (theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}`}>
                                        {t.currency === 'UZS' ? `${t.amount.toLocaleString()} UZS` : `$${t.amount.toFixed(2)}`}
                                      </div>
                                    </div>
                                  ))}
                                  {transactions.filter(t => t.relatedId === purchase.id).length === 0 && (
                                    <div className={`text-xs ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>Транзакции не найдены</div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden`}>
                              <div className={`px-4 py-2 ${t.bg} border-b ${t.border} text-xs font-bold ${t.textMuted} uppercase`}>                                Товары в закупке #{purchase.id}
                              </div>
                              <table className="w-full text-sm">
                                <thead className={`${t.bg} text-xs ${t.textMuted}`}>
                                  <tr>
                                    <th className="px-4 py-2 text-left">Наименование</th>
                                    <th className="px-4 py-2 text-left">Размеры</th>
                                    <th className="px-4 py-2 text-right">Кол-во</th>
                                    <th className="px-4 py-2 text-right">Цена закупки</th>
                                    <th className="px-4 py-2 text-right">Landed Cost</th>
                                    <th className="px-4 py-2 text-right">Сумма</th>
                                  </tr>
                                </thead>
                                <tbody className={`divide-y ${t.divide}`}>
                                  {(purchase.items || []).map((item, idx) => {
                                    const prod = products.find((p) => p.id === item.productId);
                                    const dims = prod?.dimensions || '-';
                                    return (
                                      <tr key={idx} className={`hover:${t.bgHover}`}>
                                        <td className={`px-4 py-2 ${t.text} font-medium`}>{item.productName}</td>
                                        <td className={`px-4 py-2 ${t.textMuted}`}>{dims}</td>
                                        <td className={`px-4 py-2 text-right font-mono ${t.text}`}>
                                          {item.quantity}{' '}
                                          <span className={`text-xs ${t.textMuted}`}>{item.unit}</span>
                                        </td>
                                        <td className={`px-4 py-2 text-right font-mono ${t.text}`}>
                                          ${item.invoicePrice?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className={`px-4 py-2 text-right font-mono ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                                          ${item.landedCost?.toFixed(2) || item.invoicePrice?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className={`px-4 py-2 text-right font-mono font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                          ${(item.totalLineCost || item.quantity * (item.invoicePrice || 0)).toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {(!purchase.items || purchase.items.length === 0) && (
                                    <tr>
                                      <td colSpan={6} className={`px-4 py-4 text-center ${t.textMuted}`}>
                                        Нет данных о товарах
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot className={`${t.bg} border-t ${t.border}`}>
                                  <tr>
                                    <td colSpan={3} className={`px-4 py-2 text-right text-xs ${t.textMuted}`}>
                                      Итого по накладной:
                                    </td>
                                    <td className={`px-4 py-2 text-right font-mono ${t.text}`}>
                                      ${purchase.totalInvoiceAmount?.toFixed(2)}
                                    </td>
                                    <td className={`px-4 py-2 text-right font-mono ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
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
                <td colSpan={7} className={`px-6 py-12 text-center ${t.textMuted}`}>
                  История закупок пуста.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <div className={`p-4 border-t ${t.border} ${t.bg} flex justify-end gap-8`}>
        <div className="text-right">
          <div className={`text-xs uppercase ${t.textMuted} font-bold mb-1`}>Всего Оплачено</div>
          <div className={`text-xl font-mono font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
            ${totalPaid.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs uppercase ${t.textMuted} font-bold mb-1`}>Общий Долг</div>
          <div className={`text-xl font-mono font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
            ${totalDebt.toLocaleString()}
          </div>
        </div>
      </div>
    </div >
  );
};








