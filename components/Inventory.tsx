
import React, { useState } from 'react';
import { Product, ProductType, Unit } from '../types';
import { geminiService } from '../services/geminiService';
import { Plus, Search, Loader2, BrainCircuit, Trash2, DollarSign, Pencil, TrendingUp } from 'lucide-react';

interface InventoryProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ products, setProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // State to track which item is being edited (null means creating new)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Product Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    type: ProductType.PIPE,
    unit: Unit.METER,
    quantity: 0,
    pricePerUnit: 0,
    costPrice: 0
  });

  // Smart Add Text
  const [smartInput, setSmartInput] = useState('');

  const handleDelete = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      type: ProductType.PIPE,
      unit: Unit.METER,
      quantity: 0,
      pricePerUnit: 0,
      costPrice: 0,
      name: '',
      dimensions: '',
      steelGrade: '',
    });
    setShowAddModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setFormData({ ...product });
    setShowAddModal(true);
  };

  const handleSaveProduct = () => {
    if (!formData.name) return;

    if (editingId) {
      // Edit Mode
      const updatedProducts = products.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            name: formData.name!,
            type: formData.type as ProductType,
            dimensions: formData.dimensions || '-',
            steelGrade: formData.steelGrade || 'Ст3',
            quantity: Number(formData.quantity) || 0,
            unit: formData.unit as Unit,
            pricePerUnit: Number(formData.pricePerUnit) || 0,
            costPrice: Number(formData.costPrice) || 0,
          };
        }
        return p;
      });
      setProducts(updatedProducts);
    } else {
      // Create Mode
      const product: Product = {
        id: Date.now().toString(),
        name: formData.name!,
        type: formData.type as ProductType || ProductType.OTHER,
        dimensions: formData.dimensions || '-',
        steelGrade: formData.steelGrade || 'Ст3',
        quantity: Number(formData.quantity) || 0,
        unit: formData.unit as Unit || Unit.METER,
        pricePerUnit: Number(formData.pricePerUnit) || 0,
        costPrice: Number(formData.costPrice) || 0,
        minStockLevel: 0
      };
      setProducts([...products, product]);
    }

    setShowAddModal(false);
    setEditingId(null);
  };

  const handleSmartParse = async () => {
    if (!smartInput.trim()) return;
    setIsAiLoading(true);
    try {
      const parsedItems = await geminiService.parseProductInput(smartInput);
      if (parsedItems && parsedItems.length > 0) {
        const first = parsedItems[0];
        setFormData({
          ...formData,
          ...first
        });
      }
    } catch (e) {
      alert('Ошибка распознавания текста');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.dimensions.includes(searchTerm)
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Складской Учет</h2>
          <p className="text-slate-400">Управление остатками труб и профиля (Цены в USD)</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-primary-600/20"
        >
          <Plus size={20} /> Добавить товар
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Поиск по названию или размерам..."
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-4">Наименование</th>
                <th className="px-6 py-4">Тип</th>
                <th className="px-6 py-4">Размеры</th>
                <th className="px-6 py-4">Сталь</th>
                <th className="px-6 py-4 text-right">Остаток</th>
                <th className="px-6 py-4 text-right">Себест.</th>
                <th className="px-6 py-4 text-right">Цена</th>
                <th className="px-6 py-4 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">
                    <div>{product.name}</div>
                    {product.origin === 'import' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 mt-1">
                        ИМПОРТ
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${product.type === ProductType.PIPE ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      product.type === ProductType.PROFILE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                      {product.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">{product.dimensions}</td>
                  <td className="px-6 py-4 text-slate-400">{product.steelGrade}</td>
                  <td className={`px-6 py-4 text-right font-mono ${product.quantity <= product.minStockLevel ? 'text-red-400' : 'text-slate-200'}`}>
                    {product.quantity} <span className="text-xs text-slate-500">{product.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-400">
                    ${(product.costPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">
                    ${product.pricePerUnit.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="text-slate-500 hover:text-primary-400 transition-colors p-2 rounded-lg hover:bg-primary-400/10"
                        title="Редактировать"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    Товары не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-xl font-bold text-white">
                {editingId ? 'Редактировать товар' : 'Новый товар'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* AI Input Section - Only show for new items */}
              {!editingId && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-medium">
                    <BrainCircuit size={18} />
                    <span>AI Автозаполнение</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder='Например: "Труба 50мм сталь 20 100м по $3.5"'
                      value={smartInput}
                      onChange={e => setSmartInput(e.target.value)}
                    />
                    <button
                      onClick={handleSmartParse}
                      disabled={isAiLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
                    >
                      {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : 'Распознать'}
                    </button>
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-slate-400">Название <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className={`w-full bg-slate-700 border rounded-lg px-3 py-2 focus:ring-2 focus:outline-none ${!formData.name && showAddModal ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-600 focus:ring-primary-500'
                      }`}
                    placeholder="Введите название товара"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                  {!formData.name && (
                    <p className="text-xs text-red-400 mt-1">Обязательное поле</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Тип</label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 outline-none"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as ProductType })}
                  >
                    {Object.values(ProductType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Размеры</label>
                  <input
                    type="text"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 outline-none"
                    value={formData.dimensions || ''}
                    onChange={e => setFormData({ ...formData, dimensions: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Марка стали</label>
                  <input
                    type="text"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 outline-none"
                    value={formData.steelGrade || ''}
                    onChange={e => setFormData({ ...formData, steelGrade: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Ед. измерения</label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 outline-none"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value as Unit })}
                  >
                    {Object.values(Unit).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* Origin selector removed: Default is Local */}

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-slate-400">Количество</label>
                  <input
                    type="number"
                    disabled
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 outline-none text-slate-500 cursor-not-allowed"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  />
                </div>

                {/* Prices Row */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Себестоимость (USD)</label>
                  <div className="relative">
                    <TrendingUp className="absolute left-2 top-2.5 text-slate-400" size={14} />
                    <input
                      type="number"
                      disabled
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 outline-none text-slate-500 cursor-not-allowed"
                      placeholder="0.00"
                      value={formData.costPrice}
                      onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Цена продажи (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 text-slate-400" size={14} />
                    <input
                      type="number"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-7 pr-3 py-2 outline-none"
                      placeholder="0.00"
                      value={formData.pricePerUnit}
                      onChange={e => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveProduct}
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-primary-600/25 transition-all transform active:scale-95"
              >
                {editingId ? 'Обновить' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
