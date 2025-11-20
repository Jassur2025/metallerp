
import React, { useState, useMemo } from 'react';
import { Product, Purchase, PurchaseItem, PurchaseOverheads } from '../types';
import { Plus, Trash2, Save, Calculator, Container, DollarSign, AlertTriangle, Truck, Scale, FileText } from 'lucide-react';

interface ImportProps {
    products: Product[];
    onCompletePurchase: (purchase: Purchase) => void;
}

export const Import: React.FC<ImportProps> = ({ products, onCompletePurchase }) => {
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Cart logic
    const [selectedProductId, setSelectedProductId] = useState('');
    const [inputQty, setInputQty] = useState<number>(0);
    const [inputInvoicePrice, setInputInvoicePrice] = useState<number>(0);

    const [cart, setCart] = useState<PurchaseItem[]>([]);

    // Overheads
    const [overheads, setOverheads] = useState<PurchaseOverheads>({
        logistics: 0,
        customsDuty: 0,
        importVat: 0,
        other: 0
    });

    // --- Logic to Add Item ---
    const handleAddItem = () => {
        if (!selectedProductId || inputQty <= 0 || inputInvoicePrice <= 0) return;

        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        // Check if item already in cart, if so update it (simplified: just remove old and add new or block)
        // Let's allow multiple lines or just block duplicates for simplicity
        if (cart.some(i => i.productId === product.id)) {
            alert('Этот товар уже добавлен в список. Удалите его, чтобы добавить заново с новыми параметрами.');
            return;
        }

        const newItem: PurchaseItem = {
            productId: product.id,
            productName: product.name,
            quantity: inputQty,
            unit: product.unit,
            invoicePrice: inputInvoicePrice,
            landedCost: inputInvoicePrice, // Placeholder, updated dynamically
            totalLineCost: inputQty * inputInvoicePrice
        };

        setCart([...cart, newItem]);

        // Reset inputs
        setSelectedProductId('');
        setInputQty(0);
        setInputInvoicePrice(0);
    };

    const removeItem = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    // --- Calculation Logic ---
    const totals = useMemo(() => {
        const totalInvoiceValue = cart.reduce((sum, item) => sum + (item.quantity * item.invoicePrice), 0);
        const totalOverheads = overheads.logistics + overheads.customsDuty + overheads.importVat + overheads.other;
        const totalLandedValue = totalInvoiceValue + totalOverheads;

        // Recalculate Landed Cost per item (weighted by value)
        // Formula: Cost allocation based on value contribution

        const itemsWithLandedCost = cart.map(item => {
            if (totalInvoiceValue === 0) return item;

            const lineValue = item.quantity * item.invoicePrice;
            // Proportion of this item's value to total invoice
            const proportion = lineValue / totalInvoiceValue;

            // Allocated overhead for this line
            const allocatedOverhead = totalOverheads * proportion;

            // Landed Cost per unit = InvoicePrice + (AllocatedOverhead / Qty)
            const landedCostPerUnit = item.invoicePrice + (allocatedOverhead / item.quantity);

            return {
                ...item,
                landedCost: landedCostPerUnit,
                totalLineCost: (landedCostPerUnit * item.quantity)
            };
        });

        return {
            totalInvoiceValue,
            totalOverheads,
            totalLandedValue,
            itemsWithLandedCost
        };
    }, [cart, overheads]);

    const handleComplete = () => {
        if (!supplierName || cart.length === 0) return;

        const purchase: Purchase = {
            id: `PUR-${Date.now()}`,
            date: new Date(date).toISOString(),
            supplierName,
            status: 'completed',
            items: totals.itemsWithLandedCost,
            overheads,
            totalInvoiceAmount: totals.totalInvoiceValue,
            totalLandedAmount: totals.totalLandedValue
        };

        onCompletePurchase(purchase);

        // Reset
        setCart([]);
        setSupplierName('');
        setOverheads({ logistics: 0, customsDuty: 0, importVat: 0, other: 0 });
        alert('Закупка успешно проведена! Остатки и себестоимость обновлены.');
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Импорт и Закупка</h2>
                    <p className="text-slate-400 mt-1">Оформление прихода с расчетом себестоимости</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">

                {/* Left: Inputs & Overheads */}
                <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-20">

                    {/* Document Info */}
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <FileText size={18} className="text-primary-500" /> Основное
                        </h3>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400">Поставщик</label>
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="Название поставщика"
                                value={supplierName}
                                onChange={e => setSupplierName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400">Дата прихода</label>
                            <input
                                type="date"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Add Item Form */}
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Plus size={18} className="text-emerald-500" /> Добавить товар
                        </h3>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400">Товар</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={selectedProductId}
                                onChange={e => setSelectedProductId(e.target.value)}
                            >
                                <option value="">-- Выберите товар --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.dimensions}) {p.origin === 'import' ? '[Imp]' : '[Loc]'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Кол-во</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="0"
                                    value={inputQty || ''}
                                    onChange={e => setInputQty(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Цена Invoice (USD)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="0.00"
                                    value={inputInvoicePrice || ''}
                                    onChange={e => setInputInvoicePrice(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleAddItem}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20"
                        >
                            Добавить в список
                        </button>
                    </div>

                    {/* Overheads Form */}
                    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 shadow-lg relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 text-slate-700 opacity-20">
                            <Container size={100} />
                        </div>
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Truck size={18} className="text-amber-500" /> Накладные расходы (USD)
                        </h3>
                        <p className="text-xs text-slate-500">Распределяются на себестоимость пропорционально сумме.</p>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Логистика</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                    value={overheads.logistics || ''}
                                    onChange={e => setOverheads({ ...overheads, logistics: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Тамож. Пошлина</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                    value={overheads.customsDuty || ''}
                                    onChange={e => setOverheads({ ...overheads, customsDuty: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Тамож. НДС</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                    value={overheads.importVat || ''}
                                    onChange={e => setOverheads({ ...overheads, importVat: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Прочее</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                    value={overheads.other || ''}
                                    onChange={e => setOverheads({ ...overheads, other: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Items Table & Summary */}
                <div className="lg:col-span-2 flex flex-col h-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Scale className="text-blue-500" /> Список товаров к приходу
                        </h3>
                        <div className="bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                            <span className="text-xs text-blue-300">Позиций: </span>
                            <span className="font-mono font-bold text-white">{cart.length}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Товар</th>
                                    <th className="px-4 py-3 text-right">Кол-во</th>
                                    <th className="px-4 py-3 text-right">Цена (Inv.)</th>
                                    <th className="px-4 py-3 text-right bg-amber-500/5 text-amber-200">Себест. (Landed)</th>
                                    <th className="px-4 py-3 text-right">Сумма</th>
                                    <th className="px-4 py-3 text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {totals.itemsWithLandedCost.map((item) => (
                                    <tr key={item.productId} className="hover:bg-slate-700/30">
                                        <td className="px-4 py-3 font-medium text-slate-200">{item.productName}</td>
                                        <td className="px-4 py-3 text-right font-mono">{item.quantity} <span className="text-xs text-slate-500">{item.unit}</span></td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-400">${item.invoicePrice.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 bg-amber-500/5">${item.landedCost.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-200">${item.totalLineCost.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => removeItem(item.productId)} className="text-slate-600 hover:text-red-400 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {cart.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            Список пуст. Добавьте товары слева.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Summary */}
                    <div className="bg-slate-900 p-6 border-t border-slate-700">
                        <div className="grid grid-cols-3 gap-8 mb-6">
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Сумма по Инвойсу</p>
                                <p className="text-xl font-mono font-bold text-slate-300">${totals.totalInvoiceValue.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Накладные расходы</p>
                                <p className="text-xl font-mono font-bold text-amber-400">+${totals.totalOverheads.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase">Итого Себестоимость</p>
                                <p className="text-2xl font-mono font-bold text-white border-b-2 border-primary-500 inline-block">
                                    ${totals.totalLandedValue.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                            <p className="text-xs text-amber-200/80">
                                При проведении документа остатки товаров увеличатся, а их учетная цена (Cost Price) будет пересчитана по методу <strong>средневзвешенной</strong> стоимости с учетом всех расходов.
                            </p>
                        </div>

                        <button
                            onClick={handleComplete}
                            disabled={cart.length === 0 || !supplierName}
                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-600/20"
                        >
                            <Save size={22} /> Провести закупку
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
