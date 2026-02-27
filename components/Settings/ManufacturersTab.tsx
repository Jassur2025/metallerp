import React, { useState, useCallback } from 'react';
import { AppSettings } from '../../types';
import { Save, Plus, Trash2, Factory } from 'lucide-react';

interface ManufacturersTabProps {
    formData: AppSettings;
    setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
    handleSave: () => void;
    t: Record<string, string>;
}

export const ManufacturersTab = React.memo<ManufacturersTabProps>(({
    formData,
    setFormData,
    handleSave,
    t,
}) => {
    const [newManufacturer, setNewManufacturer] = useState('');

    const addManufacturer = useCallback(() => {
        if (!newManufacturer.trim()) return;
        const name = newManufacturer.trim();
        if ((formData.manufacturers || []).includes(name)) return;
        setFormData(prev => ({
            ...prev,
            manufacturers: [...(prev.manufacturers || []), name]
        }));
        setNewManufacturer('');
    }, [newManufacturer, formData.manufacturers, setFormData]);

    return (
        <div className={`${t.bgCard} rounded-2xl border ${t.border} shadow-lg overflow-hidden h-[calc(100vh-280px)] max-h-[600px] flex flex-col`}>
            <div className={`p-6 border-b ${t.border} ${t.bgCard} bg-opacity-50`}>
                <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                    <Factory size={24} className="text-emerald-400" />
                    Производители
                </h3>
                <p className={`text-sm ${t.textMuted} mt-1`}>Управление списком производителей для товаров</p>
            </div>

            {/* Add new manufacturer */}
            <div className={`p-4 border-b ${t.border} ${t.bgCard} bg-opacity-50`}>
                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <label className={`block text-xs ${t.textMuted} mb-1`}>Название производителя</label>
                        <input
                            type="text"
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} text-sm`}
                            value={newManufacturer}
                            onChange={(e) => setNewManufacturer(e.target.value)}
                            placeholder="Например: STEEL CORP"
                            onKeyDown={(e) => e.key === 'Enter' && addManufacturer()}
                        />
                    </div>
                    <button
                        onClick={addManufacturer}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                    >
                        <Plus size={16} /> Добавить
                    </button>
                </div>
            </div>

            {/* Manufacturers list - scrollable */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className={`${t.bgCard} text-xs ${t.textMuted} uppercase sticky top-0`}>
                        <tr>
                            <th className="px-4 py-3 text-left w-12">#</th>
                            <th className="px-4 py-3 text-left">Производитель</th>
                            <th className="px-4 py-3 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${t.border} divide-opacity-50`}>
                        {(formData.manufacturers || []).map((m, idx) => (
                            <tr key={m} className={`hover:${t.hover}`}>
                                <td className={`px-4 py-2 ${t.textMuted} text-xs`}>{idx + 1}</td>
                                <td className={`px-4 py-2 ${t.text} font-medium`}>{m}</td>
                                <td className="px-4 py-2 text-center">
                                    <button
                                        onClick={() => setFormData(prev => ({
                                            ...prev,
                                            manufacturers: (prev.manufacturers || []).filter(x => x !== m)
                                        }))}
                                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                        title="Удалить"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {(!formData.manufacturers || formData.manufacturers.length === 0) && (
                            <tr>
                                <td colSpan={3} className={`px-4 py-8 text-center ${t.textMuted}`}>
                                    Нет производителей. Добавьте первого.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t ${t.border} ${t.bgCard} bg-opacity-50 flex items-center justify-between`}>
                <div className={`text-xs ${t.textMuted}`}>
                    Всего: <span className={`${t.text} font-medium`}>{(formData.manufacturers || []).length}</span> производителей
                </div>
                <button
                    onClick={handleSave}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                    <Save size={18} />
                    Сохранить
                </button>
            </div>
        </div>
    );
});

ManufacturersTab.displayName = 'ManufacturersTab';
