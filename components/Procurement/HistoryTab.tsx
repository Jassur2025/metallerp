import React, { useState } from 'react';
import { ChevronDown, ChevronRight, History, Wallet, Edit, Save, X, Trash2, Warehouse, DollarSign, TrendingDown, Clock } from 'lucide-react';
import type { Product, Purchase, Transaction, PurchaseItem, WarehouseType } from '../../types';
import { WarehouseLabels, Unit } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';
import { useConfirm } from '../ConfirmDialog';

interface HistoryTabProps {
  purchases: Purchase[];
  products: Product[];
  transactions: Transaction[];
  expandedPurchaseIds: Set<string>;
  togglePurchaseExpand: (id: string) => void;
  handleOpenRepayModal: (purchase: Purchase) => void;
  onUpdatePurchaseItem?: (purchaseId: string, itemIndex: number, updates: Partial<PurchaseItem>) => void;
  onDeletePurchaseItem?: (purchaseId: string, itemIndex: number) => void;
  onAddPurchaseItem?: (purchaseId: string, item: PurchaseItem) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  purchases,
  products,
  transactions,
  expandedPurchaseIds,
  togglePurchaseExpand,
  handleOpenRepayModal,
  onUpdatePurchaseItem,
  onDeletePurchaseItem,
  onAddPurchaseItem,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';
  const totalPaid = purchases.reduce((sum, p) => sum + (p.amountPaidUSD ?? p.amountPaid ?? 0), 0);
  const totalDebt = purchases.reduce((sum, p) => sum + (Math.max(0, (p.totalInvoiceAmount || 0) - (p.amountPaidUSD ?? p.amountPaid ?? 0))), 0);
  const totalInvoices = purchases.reduce((sum, p) => sum + (p.totalInvoiceAmount || 0), 0);

  // Editing state
  const [editingItem, setEditingItem] = useState<{ purchaseId: string; itemIndex: number } | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editProductId, setEditProductId] = useState<string>('');

  const startEditItem = (purchaseId: string, itemIndex: number, item: PurchaseItem) => {
    setEditingItem({ purchaseId, itemIndex });
    setEditQty(item.quantity);
    setEditPrice(item.invoicePrice || 0);
    setEditProductId(item.productId);
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveEdit = () => {
    if (!editingItem || !onUpdatePurchaseItem) return;
    const product = products.find(p => p.id === editProductId);
    onUpdatePurchaseItem(editingItem.purchaseId, editingItem.itemIndex, {
      productId: editProductId,
      productName: product?.name || '',
      quantity: editQty,
      invoicePrice: editPrice,
      landedCost: editPrice,
      totalLineCost: editQty * editPrice,
      unit: product?.unit || Unit.PIECE
    });
    setEditingItem(null);
  };

  const { confirm: confirmDialog } = useConfirm();

  const handleDeleteItem = async (purchaseId: string, itemIndex: number) => {
    if (!onDeletePurchaseItem) return;
    if (await confirmDialog({ title: 'Удалить позицию?', message: 'Удалить эту позицию из закупки?', variant: 'danger', confirmText: 'Удалить' })) {
      onDeletePurchaseItem(purchaseId, itemIndex);
    }
  };

  return (
    <div className={`flex-1 ${isDark ? 'bg-gradient-to-b from-slate-800/90 to-slate-900/90' : 'bg-white'} rounded-2xl border ${t.border} shadow-lg overflow-hidden flex flex-col`}>
      {/* Header with Summary Cards */}
      <div className={`px-5 py-4 border-b ${t.border} ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10">
              <History size={16} className={t.textMuted} />
            </div>
            <h3 className={`font-bold ${t.text}`}>История закупок и Долги</h3>
          </div>
          <div className={`${isDark ? 'bg-slate-700/50 border-slate-600/50' : 'bg-slate-100 border-slate-200'} px-3 py-1.5 rounded-full border`}>
            <span className={`text-xs ${t.textMuted} font-semibold`}>{purchases.length} закупок</span>
          </div>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'} border`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={13} className={t.textMuted} />
              <span className={`text-[10px] ${t.textMuted} uppercase font-semibold tracking-wider`}>Всего закупок</span>
            </div>
            <p className={`text-lg font-mono font-bold ${t.text}`}>${totalInvoices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} border`}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={13} className="text-emerald-500" />
              <span className="text-[10px] text-emerald-500 uppercase font-semibold tracking-wider">Оплачено</span>
            </div>
            <p className={`text-lg font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'} border`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={13} className="text-red-500" />
              <span className="text-[10px] text-red-500 uppercase font-semibold tracking-wider">Общий долг</span>
            </div>
            <p className={`text-lg font-mono font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className={`${isDark ? 'bg-slate-800/40' : 'bg-slate-50'} text-xs uppercase ${t.textMuted} font-semibold sticky top-0 z-10`}>
            <tr>
              <th className="px-6 py-4">Дата</th>
              <th className="px-6 py-4">Поставщик</th>
              <th className="px-4 py-4 text-center">Склад</th>
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
                const debt = (purchase.totalInvoiceAmount || 0) - (purchase.amountPaidUSD ?? purchase.amountPaid ?? 0);
                const isExpanded = expandedPurchaseIds.has(purchase.id);
                const purchaseWarehouse = purchase.warehouse || 'main';
                return (
                  <React.Fragment key={purchase.id}>
                    <tr
                      className={`hover:${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/50'} transition-colors duration-150 cursor-pointer`}
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
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${purchaseWarehouse === 'cloud'
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/20'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
                          }`}>
                          {purchaseWarehouse === 'cloud' ? '☁️ Облачный' : '🏭 Основной'}
                        </span>
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
                        ${(purchase.amountPaidUSD ?? purchase.amountPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                        {debt > 0 ? `$${debt.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {debt > 0 && (
                          <button
                            onClick={() => handleOpenRepayModal(purchase)}
                            className="text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-3.5 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ml-auto shadow-sm hover:shadow-md font-semibold"
                          >
                            <Wallet size={13} /> Оплатить
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr className={t.bg}>
                        <td colSpan={9} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Payment details for Mixed */}
                            {purchase.paymentMethod === 'mixed' && (
                              <div className={`${t.bgCard} rounded-xl border ${t.border} p-4`}>
                                <div className={`text-[10px] font-bold ${t.textMuted} mb-3 uppercase tracking-wider`}>Детализация оплаты (МИКС)</div>
                                <div className="flex flex-wrap gap-4">
                                  {transactions.filter(tx => tx.relatedId === purchase.id).map(tx => (
                                    <div key={tx.id} className={`${t.bg} p-3 rounded-lg border ${t.border} min-w-[140px]`}>
                                      <div className={`text-[10px] ${t.textMuted} uppercase mb-1`}>{tx.method === 'cash' ? 'Наличные' : tx.method === 'card' ? 'Карта' : 'Банк'}</div>
                                      <div className={`text-sm font-mono font-bold ${tx.method === 'cash' && tx.currency === 'USD' ? (theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600') : (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}`}>
                                        {tx.currency === 'UZS' ? `${tx.amount.toLocaleString()} UZS` : `$${tx.amount.toFixed(2)}`}
                                      </div>
                                    </div>
                                  ))}
                                  {transactions.filter(tx => tx.relatedId === purchase.id).length === 0 && (
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
                                    {onUpdatePurchaseItem && <th className="px-4 py-2 text-center w-24">Действия</th>}
                                  </tr>
                                </thead>
                                <tbody className={`divide-y ${t.divide}`}>
                                  {(purchase.items || []).map((item, idx) => {
                                    const prod = products.find((p) => p.id === item.productId);
                                    const dims = prod?.dimensions || '-';
                                    const isEditing = editingItem?.purchaseId === purchase.id && editingItem?.itemIndex === idx;

                                    if (isEditing) {
                                      return (
                                        <tr key={idx} className="bg-indigo-500/10">
                                          <td className="px-4 py-2">
                                            <select
                                              className={`w-full ${t.bg} border ${t.border} rounded px-2 py-1 ${t.text} text-sm`}
                                              value={editProductId}
                                              onChange={(e) => setEditProductId(e.target.value)}
                                            >
                                              {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.dimensions})</option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className={`px-4 py-2 ${t.textMuted}`}>
                                            {products.find(p => p.id === editProductId)?.dimensions || '-'}
                                          </td>
                                          <td className="px-4 py-2">
                                            <input
                                              type="number"
                                              className={`w-20 ${t.bg} border ${t.border} rounded px-2 py-1 text-right ${t.text} text-sm`}
                                              value={editQty}
                                              onChange={(e) => setEditQty(Number(e.target.value))}
                                              min={1}
                                            />
                                          </td>
                                          <td className="px-4 py-2">
                                            <div className="flex items-center justify-end gap-1">
                                              <span className={t.textMuted}>$</span>
                                              <input
                                                type="number"
                                                className={`w-20 ${t.bg} border ${t.border} rounded px-2 py-1 text-right ${t.text} text-sm`}
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                                step={0.01}
                                                min={0}
                                              />
                                            </div>
                                          </td>
                                          <td className={`px-4 py-2 text-right font-mono ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                                            ${editPrice.toFixed(2)}
                                          </td>
                                          <td className={`px-4 py-2 text-right font-mono font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                            ${(editQty * editPrice).toFixed(2)}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                onClick={saveEdit}
                                                className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                                                title="Сохранить"
                                              >
                                                <Save size={14} />
                                              </button>
                                              <button
                                                onClick={cancelEdit}
                                                className="p-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded"
                                                title="Отмена"
                                              >
                                                <X size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }

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
                                        {onUpdatePurchaseItem && (
                                          <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                onClick={() => startEditItem(purchase.id, idx, item)}
                                                className={`p-1.5 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} rounded`}
                                                title="Редактировать"
                                              >
                                                <Edit size={14} className={t.textMuted} />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteItem(purchase.id, idx)}
                                                className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded"
                                                title="Удалить"
                                              >
                                                <Trash2 size={14} className="text-red-500" />
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                  {(!purchase.items || purchase.items.length === 0) && (
                                    <tr>
                                      <td colSpan={onUpdatePurchaseItem ? 7 : 6} className={`px-4 py-4 text-center ${t.textMuted}`}>
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
                                    {onUpdatePurchaseItem && <td className="px-4 py-2"></td>}
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


    </div >
  );
};
