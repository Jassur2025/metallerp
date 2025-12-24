import React, { useState, useMemo } from 'react';
import { Product, ProductType } from '../types';
import { Search, FileText, Filter, Package, Save, Percent, Edit, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface PriceListProps {
    products: Product[];
    onSaveProducts: (products: Product[]) => Promise<void>;
}

export const PriceList: React.FC<PriceListProps> = ({ products, onSaveProducts }) => {
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showBulkPanel, setShowBulkPanel] = useState(false);

    // Bulk Update State
    const [bulkValue, setBulkValue] = useState<string>('');
    const [bulkType, setBulkType] = useState<'percent' | 'manual'>('percent');

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.steelGrade.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.dimensions.includes(searchTerm);
            const matchesType = typeFilter === 'all' || product.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [products, searchTerm, typeFilter]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handlePriceChange = (id: string, value: string) => {
        setEditingPrices(prev => ({ ...prev, [id]: value }));
    };

    const handleBulkUpdate = () => {
        if (selectedIds.size === 0) {
            toast.warning('Выберите товары для массового обновления');
            return;
        }

        const value = parseFloat(bulkValue);
        if (isNaN(value)) {
            toast.error('Введите корректное число');
            return;
        }

        const newEditingPrices = { ...editingPrices };
        selectedIds.forEach(id => {
            const product = products.find(p => p.id === id);
            if (product) {
                let newPrice: number;
                if (bulkType === 'percent') {
                    // Calculate based on costPrice as requested
                    const base = product.costPrice || 0;
                    if (base === 0) {
                        toast.warning(`У товара "${product.name}" не задана себестоимость. Процент не применен.`);
                        return;
                    }
                    newPrice = base * (1 + value / 100);
                } else {
                    newPrice = value;
                }
                newEditingPrices[id] = newPrice.toFixed(2);
            }
        });

        setEditingPrices(newEditingPrices);
        toast.info(`Обновлены цены для ${selectedIds.size} товаров (база: себест., не забудьте сохранить)`);
        setBulkValue('');
    };

    const handleSave = async () => {
        const changedIds = Object.keys(editingPrices);
        if (changedIds.length === 0) {
            toast.info('Нет изменений для сохранения');
            return;
        }

        setIsSaving(true);
        try {
            const updatedProducts = products.map(p => {
                if (editingPrices[p.id] !== undefined) {
                    const newPrice = parseFloat(editingPrices[p.id]);
                    if (!isNaN(newPrice)) {
                        return { ...p, pricePerUnit: newPrice };
                    }
                }
                return p;
            });

            await onSaveProducts(updatedProducts);
            setEditingPrices({});
            setSelectedIds(new Set());
            toast.success('Цены успешно обновлены');
        } catch (error) {
            toast.error('Ошибка при сохранении цен');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                        <FileText className="text-primary-500" size={32} />
                        Система Прайс
                    </h2>
                    <p className="text-slate-400 mt-1">Управление ценами на основе себестоимости</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving || Object.keys(editingPrices).length === 0}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${Object.keys(editingPrices).length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    <Save size={20} className={isSaving ? 'animate-pulse' : ''} />
                    {isSaving ? 'Сохранение...' : `Сохранить (${Object.keys(editingPrices).length})`}
                </button>
            </div>

            {/* Filters and Search */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Поиск по номенклатуре..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:border-primary-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <Filter size={20} className="text-slate-400" />
                        <select
                            className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none focus:border-primary-500"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <option value="all">Все типы</option>
                            {Object.values(ProductType).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Bulk Update Panel */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <button
                    onClick={() => setShowBulkPanel(!showBulkPanel)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                >
                    <div className="flex items-center gap-2 font-semibold">
                        <Percent size={20} className="text-primary-400" />
                        <span>Массовое изменение ({selectedIds.size})</span>
                    </div>
                    {showBulkPanel ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {showBulkPanel && (
                    <div className="p-4 border-t border-slate-700 bg-slate-900/20 animate-slide-down">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex bg-slate-700 rounded-lg p-1">
                                <button
                                    onClick={() => setBulkType('percent')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${bulkType === 'percent' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    Наценка на себест. (%)
                                </button>
                                <button
                                    onClick={() => setBulkType('manual')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${bulkType === 'manual' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    Фикс. цена ($)
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder={bulkType === 'percent' ? "+/- %" : "0.00"}
                                    className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 w-32 outline-none focus:border-primary-500"
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleBulkUpdate}
                                className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={selectedIds.size === 0 || !bulkValue}
                            >
                                Применить к выбранным
                            </button>

                            <p className="text-xs text-slate-500 md:ml-auto">
                                * При выборе %, новая цена = Себестоимость + %.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden bg-slate-800 rounded-xl border border-slate-700 shadow-xl relative">
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/80 sticky top-0 z-10 font-bold text-slate-300 backdrop-blur-md">
                            <tr>
                                <th className="p-4 border-b border-slate-700 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/20"
                                        checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-4 border-b border-slate-700">Наименование</th>
                                <th className="p-4 border-b border-slate-700">Размеры / Сталь</th>
                                <th className="p-4 border-b border-slate-700 text-right">Себест. (USD)</th>
                                <th className="p-4 border-b border-slate-700 text-right">Остаток</th>
                                <th className="p-4 border-b border-slate-700 text-right w-48">Цена прод. (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product) => (
                                    <tr
                                        key={product.id}
                                        className={`hover:bg-slate-700/30 transition-colors ${selectedIds.has(product.id) ? 'bg-primary-500/5' : ''}`}
                                    >
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500/20"
                                                checked={selectedIds.has(product.id)}
                                                onChange={() => toggleSelect(product.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-medium text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="hidden sm:block p-2 bg-slate-800 rounded-lg text-primary-400">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-white text-sm">{product.name}</div>
                                                    <div className="text-[10px] text-slate-500">{product.type}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-slate-300 font-mono text-[10px]">{product.dimensions}</div>
                                            <div className="text-slate-500 text-[10px]">{product.steelGrade}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-slate-400 text-sm">
                                            ${(product.costPrice || 0).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-mono text-sm ${product.quantity > product.minStockLevel ? 'text-slate-300' : 'text-red-400'}`}>
                                                {product.quantity.toLocaleString()}
                                            </span>
                                            <span className="text-slate-500 text-[10px] ml-1">{product.unit}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 group">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className={`bg-slate-900/50 border rounded-lg pl-6 pr-3 py-2 w-32 text-right font-mono text-lg transition-all outline-none ${editingPrices[product.id] !== undefined
                                                            ? 'border-emerald-500/50 text-emerald-400 ring-2 ring-emerald-500/10'
                                                            : 'border-slate-700 group-hover:border-slate-500 text-white'
                                                            }`}
                                                        value={editingPrices[product.id] ?? product.pricePerUnit.toFixed(2)}
                                                        onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">
                                        Товары не найдены
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
