import React, { useState } from 'react';
import { Product, ProductType, Unit } from '../../types';
import { Plus } from 'lucide-react';

interface ProductCreateModalProps {
    onClose: () => void;
    onCreate: (product: Partial<Product>) => void;
}

export const ProductCreateModal = React.memo<ProductCreateModalProps>(({
    onClose,
    onCreate,
}) => {
    const [newProduct, setNewProduct] = useState<Partial<Product>>({
        name: '', type: 'Прочее' as ProductType, unit: 'шт' as Unit, dimensions: '-', steelGrade: '-', origin: 'import'
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl animate-scale-in">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="text-emerald-500" /> Создать новый товар
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Название товара *</label>
                        <input
                            type="text"
                            placeholder="Например: Труба 80x80x3"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={newProduct.name || ''}
                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Тип</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProduct.type || 'Прочее'}
                                onChange={e => setNewProduct({ ...newProduct, type: e.target.value as ProductType })}
                            >
                                <option value="Труба">Труба</option>
                                <option value="Профиль">Профиль</option>
                                <option value="Лист">Лист</option>
                                <option value="Балка">Балка</option>
                                <option value="Прочее">Прочее</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Ед. измерения</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProduct.unit || 'шт'}
                                onChange={e => setNewProduct({ ...newProduct, unit: e.target.value as Unit })}
                            >
                                <option value="м">метр</option>
                                <option value="т">тонна</option>
                                <option value="шт">шт</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Размеры</label>
                            <input
                                type="text"
                                placeholder="50x50"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProduct.dimensions || ''}
                                onChange={e => setNewProduct({ ...newProduct, dimensions: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Марка стали</label>
                            <input
                                type="text"
                                placeholder="St3sp"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProduct.steelGrade || ''}
                                onChange={e => setNewProduct({ ...newProduct, steelGrade: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Происхождение</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={newProduct.origin || 'import'}
                                onChange={e => setNewProduct({ ...newProduct, origin: e.target.value as 'import' | 'local' })}
                            >
                                <option value="import">Импорт</option>
                                <option value="local">Местный</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => onCreate(newProduct)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all"
                    >
                        Создать Товар
                    </button>
                </div>
            </div>
        </div>
    );
});

ProductCreateModal.displayName = 'ProductCreateModal';
