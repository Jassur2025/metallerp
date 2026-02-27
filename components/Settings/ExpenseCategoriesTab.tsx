import React, { useState } from 'react';
import { AppSettings, ExpensePnLCategory } from '../../types';
import { Save, Plus, Trash2, Receipt } from 'lucide-react';

interface ExpenseCategoriesTabProps {
    formData: AppSettings;
    setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
    handleSave: () => void;
    t: Record<string, string>;
}

const pnlCategoryColor = (cat: ExpensePnLCategory): string => {
    switch (cat) {
        case 'administrative': return 'text-blue-400 border-blue-500/30';
        case 'operational': return 'text-amber-400 border-amber-500/30';
        case 'commercial': return 'text-emerald-400 border-emerald-500/30';
        default: return 'text-slate-400 border-slate-500/30';
    }
};

export const ExpenseCategoriesTab = React.memo<ExpenseCategoriesTabProps>(({
    formData,
    setFormData,
    handleSave,
    t,
}) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryPnL, setNewCategoryPnL] = useState<ExpensePnLCategory>('administrative');

    const addExpenseCategory = () => {
        if (!newCategoryName.trim()) return;
        const newCat = {
            id: `cat_${Date.now()}`,
            name: newCategoryName.trim(),
            pnlCategory: newCategoryPnL
        };
        setFormData(prev => ({
            ...prev,
            expenseCategories: [...(prev.expenseCategories || []), newCat]
        }));
        setNewCategoryName('');
    };

    const removeExpenseCategory = (id: string) => {
        setFormData(prev => ({
            ...prev,
            expenseCategories: (prev.expenseCategories || []).filter(c => c.id !== id)
        }));
    };

    const updateCategoryPnL = (id: string, pnlCategory: ExpensePnLCategory) => {
        setFormData(prev => ({
            ...prev,
            expenseCategories: (prev.expenseCategories || []).map(c =>
                c.id === id ? { ...c, pnlCategory } : c
            )
        }));
    };

    return (
        <div className={`${t.bgCard} rounded-2xl border ${t.border} shadow-lg overflow-hidden h-[calc(100vh-280px)] max-h-[600px] flex flex-col`}>
            <div className={`p-6 border-b ${t.border} ${t.bgCard} bg-opacity-50`}>
                <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                    <Receipt size={24} className="text-purple-400" />
                    Категории расходов (для PnL)
                </h3>
                <p className={`text-sm ${t.textMuted} mt-1`}>Настройте категории расходов и их классификацию для отчёта о прибылях и убытках</p>
            </div>

            {/* Add new category */}
            <div className={`p-4 border-b ${t.border} ${t.bgCard} bg-opacity-50`}>
                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <label className={`block text-xs ${t.textMuted} mb-1`}>Название расхода</label>
                        <input
                            type="text"
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} text-sm`}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Например: Аренда офиса"
                            onKeyDown={(e) => e.key === 'Enter' && addExpenseCategory()}
                        />
                    </div>
                    <div className="w-48">
                        <label className={`block text-xs ${t.textMuted} mb-1`}>Классификация PnL</label>
                        <select
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} text-sm`}
                            value={newCategoryPnL}
                            onChange={(e) => setNewCategoryPnL(e.target.value as ExpensePnLCategory)}
                        >
                            <option value="administrative">Административные</option>
                            <option value="operational">Операционные</option>
                            <option value="commercial">Коммерческие</option>
                        </select>
                    </div>
                    <button
                        onClick={addExpenseCategory}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                    >
                        <Plus size={16} /> Добавить
                    </button>
                </div>
            </div>

            {/* Categories list - scrollable */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className={`${t.bgCard} text-xs ${t.textMuted} uppercase sticky top-0`}>
                        <tr>
                            <th className="px-4 py-3 text-left">Расход</th>
                            <th className="px-4 py-3 text-left w-48">Классификация для PnL</th>
                            <th className="px-4 py-3 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${t.border} divide-opacity-50`}>
                        {(formData.expenseCategories || []).map((cat) => (
                            <tr key={cat.id} className={`hover:${t.hover}`}>
                                <td className={`px-4 py-2 ${t.text}`}>{cat.name}</td>
                                <td className="px-4 py-2">
                                    <select
                                        className={`px-2 py-1 rounded-lg text-xs font-medium border ${pnlCategoryColor(cat.pnlCategory)} bg-transparent cursor-pointer`}
                                        value={cat.pnlCategory}
                                        onChange={(e) => updateCategoryPnL(cat.id, e.target.value as ExpensePnLCategory)}
                                    >
                                        <option value="administrative" className={t.bgCard}>Административные</option>
                                        <option value="operational" className={t.bgCard}>Операционные</option>
                                        <option value="commercial" className={t.bgCard}>Коммерческие</option>
                                    </select>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button
                                        onClick={() => removeExpenseCategory(cat.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                        title="Удалить"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {(!formData.expenseCategories || formData.expenseCategories.length === 0) && (
                            <tr>
                                <td colSpan={3} className={`px-4 py-8 text-center ${t.textMuted}`}>
                                    Нет категорий. Добавьте первую категорию расходов.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer with stats and save button */}
            <div className={`p-4 border-t ${t.border} ${t.bgCard} bg-opacity-50 flex items-center justify-between`}>
                <div className={`text-xs ${t.textMuted}`}>
                    Всего: <span className={`${t.text} font-medium`}>{(formData.expenseCategories || []).length}</span>
                    <span className="mx-2">•</span>
                    <span className="text-blue-400">Адм.: {(formData.expenseCategories || []).filter(c => c.pnlCategory === 'administrative').length}</span>
                    <span className="mx-2">•</span>
                    <span className="text-amber-400">Опер.: {(formData.expenseCategories || []).filter(c => c.pnlCategory === 'operational').length}</span>
                    <span className="mx-2">•</span>
                    <span className="text-emerald-400">Комм.: {(formData.expenseCategories || []).filter(c => c.pnlCategory === 'commercial').length}</span>
                </div>
                <button
                    onClick={handleSave}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all active:scale-95"
                >
                    <Save size={18} />
                    Сохранить категории
                </button>
            </div>
        </div>
    );
});

ExpenseCategoriesTab.displayName = 'ExpenseCategoriesTab';
