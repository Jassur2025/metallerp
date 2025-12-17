import React, { useState } from 'react';
import { FixedAsset, FixedAssetCategory, Transaction } from '../types';
import { Plus, Trash2, RefreshCw, Landmark, Calendar, DollarSign, TrendingDown, Edit2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface FixedAssetsProps {
    assets: FixedAsset[];
    setAssets: (assets: FixedAsset[]) => void;
    onSaveAssets?: (assets: FixedAsset[]) => Promise<void>;
    transactions?: Transaction[];
    setTransactions?: (t: Transaction[]) => void;
    onSaveTransactions?: (t: Transaction[]) => Promise<boolean | void>;
    defaultExchangeRate?: number;
}

export const FixedAssets: React.FC<FixedAssetsProps> = ({
    assets, setAssets, onSaveAssets,
    transactions = [], setTransactions, onSaveTransactions,
    defaultExchangeRate = 12800
}) => {
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRevalModalOpen, setIsRevalModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState<FixedAssetCategory>(FixedAssetCategory.COMPUTER);
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [purchaseCost, setPurchaseCost] = useState('');
    const [revalValue, setRevalValue] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card'>('cash');
    const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'UZS'>('UZS');
    const [customExchangeRate, setCustomExchangeRate] = useState(defaultExchangeRate.toString());

    const getDepreciationRate = (cat: FixedAssetCategory): number => {
        switch (cat) {
            case FixedAssetCategory.BUILDING: return 5;
            case FixedAssetCategory.STRUCTURE: return 5;
            case FixedAssetCategory.MACHINERY: return 15;
            case FixedAssetCategory.VEHICLE: return 15;
            case FixedAssetCategory.COMPUTER: return 20;
            case FixedAssetCategory.OFFICE_EQUIPMENT: return 20;
            case FixedAssetCategory.FURNITURE: return 10;
            case FixedAssetCategory.INVENTORY: return 10;
            case FixedAssetCategory.APPLIANCES: return 15;
            case FixedAssetCategory.SPECIAL_EQUIPMENT: return 20;
            case FixedAssetCategory.LAND: return 0;
            default: return 0;
        }
    };

    const handleAddAsset = async () => {
        if (!name || !purchaseCost) return;

        const cost = parseFloat(purchaseCost);
        const rate = parseFloat(customExchangeRate) || defaultExchangeRate;
        const depreciationRate = getDepreciationRate(category);
        const assetId = `FA-${Date.now()}`;
        const currency = paymentMethod === 'cash' ? paymentCurrency : 'UZS';

        const newAsset: FixedAsset = {
            id: assetId,
            name,
            category,
            purchaseDate,
            purchaseCost: cost,
            currentValue: cost,
            accumulatedDepreciation: 0,
            depreciationRate: depreciationRate,
            paymentMethod,
            paymentCurrency: currency,
        };

        const updatedAssets = [...assets, newAsset];
        setAssets(updatedAssets);
        if (onSaveAssets) {
            await onSaveAssets(updatedAssets);
        }

        // Создаём транзакцию расхода для кассового учёта
        if (setTransactions && onSaveTransactions) {
            // Рассчитываем сумму в валюте оплаты
            const transactionAmount = currency === 'UZS' ? cost * rate : cost;

            const newTransaction: Transaction = {
                id: `TRX-${Date.now()}`,
                date: purchaseDate,
                type: 'expense',
                amount: transactionAmount,
                currency: currency,
                exchangeRate: currency === 'UZS' ? rate : undefined,
                method: paymentMethod,
                description: `Покупка ОС: ${name} (${category})`,
                relatedId: assetId
            };

            const updatedTransactions = [...transactions, newTransaction];
            setTransactions(updatedTransactions);
            await onSaveTransactions(updatedTransactions);
        }

        setIsModalOpen(false);
        resetForm();
        toast.success('Основное средство добавлено и списано из кассы!');
    };

    const handleDelete = (id: string) => {
        if (confirm('Вы уверены, что хотите удалить это основное средство?')) {
            const updatedAssets = assets.filter(a => a.id !== id);
            setAssets(updatedAssets);
            if (onSaveAssets) {
                onSaveAssets(updatedAssets);
            }
        }
    };

    const resetForm = () => {
        setName('');
        setCategory(FixedAssetCategory.COMPUTER);
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        setPurchaseCost('');
        setPaymentMethod('cash');
        setPaymentCurrency('UZS');
        setCustomExchangeRate(defaultExchangeRate.toString());
    };

    const runMonthlyDepreciation = () => {
        if (!confirm('Рассчитать амортизацию за 1 месяц для всех активов?')) return;

        const updatedAssets = assets.map(asset => {
            if (asset.depreciationRate === 0 || asset.currentValue <= 0) return asset;

            // Monthly Rate = Annual Rate / 12
            const monthlyRate = asset.depreciationRate / 100 / 12;
            const depreciationAmount = asset.purchaseCost * monthlyRate;

            // Ensure we don't depreciate below 0
            const actualDepreciation = Math.min(depreciationAmount, asset.currentValue);

            return {
                ...asset,
                currentValue: asset.currentValue - actualDepreciation,
                accumulatedDepreciation: asset.accumulatedDepreciation + actualDepreciation,
                lastDepreciationDate: new Date().toISOString().split('T')[0]
            };
        });

        setAssets(updatedAssets);
        if (onSaveAssets) {
            onSaveAssets(updatedAssets);
        }
        toast.success('Амортизация успешно начислена!');
    };

    const openRevaluation = (asset: FixedAsset) => {
        setSelectedAsset(asset);
        setRevalValue(asset.currentValue.toString());
        setIsRevalModalOpen(true);
    };

    const handleRevaluation = () => {
        if (!selectedAsset || !revalValue) return;

        const newValue = parseFloat(revalValue);
        const updatedAssets = assets.map(a => {
            if (a.id === selectedAsset.id) {
                // Adjust accumulated depreciation based on new value? 
                // Or just reset current value and keep historical cost?
                // Usually revaluation changes the Book Value. 
                // Let's set Current Value to New Value.
                return { ...a, currentValue: newValue };
            }
            return a;
        });

        setAssets(updatedAssets);
        if (onSaveAssets) {
            onSaveAssets(updatedAssets);
        }
        setIsRevalModalOpen(false);
        setSelectedAsset(null);
        setRevalValue('');
    };

    const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
    const totalDepreciation = assets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);

    return (
        <div className="p-6 h-full flex flex-col space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Landmark className="text-indigo-500" size={32} /> Основные Средства
                    </h2>
                    <p className="text-slate-400 mt-1">Учет и амортизация активов компании</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={runMonthlyDepreciation}
                        className="bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
                    >
                        <TrendingDown size={20} /> Начислить амортизацию
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                    >
                        <Plus size={20} /> Добавить ОС
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Балансовая стоимость</p>
                    <p className="text-2xl font-mono font-bold text-white">${totalValue.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Накопленная амортизация</p>
                    <p className="text-2xl font-mono font-bold text-amber-400">${totalDepreciation.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Всего объектов</p>
                    <p className="text-2xl font-mono font-bold text-indigo-400">{assets.length}</p>
                </div>
            </div>

            {/* Assets Table */}
            <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 text-slate-400 text-sm border-b border-slate-700">
                                <th className="p-4 font-medium">Наименование</th>
                                <th className="p-4 font-medium">Категория</th>
                                <th className="p-4 font-medium">Дата покупки</th>
                                <th className="p-4 font-medium text-right">Стоимость</th>
                                <th className="p-4 font-medium text-right">Тек. Стоимость</th>
                                <th className="p-4 font-medium text-center">Ставка</th>
                                <th className="p-4 font-medium text-center">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-200 text-sm divide-y divide-slate-700">
                            {assets.map(asset => (
                                <tr key={asset.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4 font-medium">{asset.name}</td>
                                    <td className="p-4">
                                        <span className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-300">{asset.category}</span>
                                    </td>
                                    <td className="p-4 text-slate-400">{asset.purchaseDate}</td>
                                    <td className="p-4 text-right font-mono text-slate-400">${asset.purchaseCost.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono font-bold text-white">${asset.currentValue.toLocaleString()}</td>
                                    <td className="p-4 text-center text-amber-400 font-mono">{asset.depreciationRate}%</td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button
                                            onClick={() => openRevaluation(asset)}
                                            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                                            title="Переоценка"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(asset.id)}
                                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                            title="Удалить"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {assets.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        Нет основных средств. Добавьте первое!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Asset Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Новое Основное Средство</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Наименование</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Категория</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                    value={category}
                                    onChange={e => setCategory(e.target.value as FixedAssetCategory)}
                                >
                                    {Object.values(FixedAssetCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Стоимость (USD)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                        value={purchaseCost}
                                        onChange={e => setPurchaseCost(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Дата покупки</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                        value={purchaseDate}
                                        onChange={e => setPurchaseDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Способ оплаты</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        Наличные
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('bank')}
                                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${paymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        Р/С (Банк)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('card')}
                                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${paymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        Карта
                                    </button>
                                </div>
                            </div>

                            {/* Currency (only for cash) */}
                            {paymentMethod === 'cash' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Валюта оплаты</label>
                                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-600">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentCurrency('UZS')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${paymentCurrency === 'UZS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Сум (UZS)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentCurrency('USD')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${paymentCurrency === 'USD' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Доллар (USD)
                                        </button>
                                    </div>

                                    {paymentCurrency === 'UZS' && (
                                        <div className="mt-2">
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Курс обмена (для пересчета)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                                value={customExchangeRate}
                                                onChange={e => setCustomExchangeRate(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {paymentMethod !== 'cash' && (
                                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                                    <p className="text-xs text-slate-400">
                                        {paymentMethod === 'bank' ? 'Р/С (Банк)' : 'Карта'} — оплата только в сумах (UZS)
                                    </p>
                                </div>
                            )}

                            <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                                <p className="text-xs text-indigo-300">
                                    Норма амортизации для "{category}": <strong>{getDepreciationRate(category)}%</strong> в год.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleAddAsset}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-all"
                            >
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Revaluation Modal */}
            {isRevalModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Переоценка Актива</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Введите новую текущую стоимость для <strong>{selectedAsset?.name}</strong>.
                        </p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Новая стоимость (USD)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                value={revalValue}
                                onChange={e => setRevalValue(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsRevalModalOpen(false)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleRevaluation}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
