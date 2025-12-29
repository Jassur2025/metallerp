
import React, { useState } from 'react';
import { Product, ProductType, Unit } from '../types';
import { geminiService } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Search, Loader2, BrainCircuit, Trash2, DollarSign, Pencil, TrendingUp, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';


interface InventoryProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  onSaveProducts?: (products: Product[]) => Promise<void>;
}

export const Inventory: React.FC<InventoryProps> = ({ products, setProducts, onSaveProducts }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [sortMode, setSortMode] = useState<'qty_desc' | 'qty_asc' | 'name_asc'>('qty_desc');

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
      const updatedProducts = products.filter(p => p.id !== id);
      setProducts(updatedProducts);
      if (onSaveProducts) {
        onSaveProducts(updatedProducts);
      }
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

    let updatedProducts: Product[];

    if (editingId) {
      // Edit Mode
      updatedProducts = products.map(p => {
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
      updatedProducts = [...products, product];
    }

    setProducts(updatedProducts);
    if (onSaveProducts) {
      onSaveProducts(updatedProducts);
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
      toast.error('Ошибка распознавания текста. Проверьте подключение к интернету и API ключ Gemini.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.dimensions.includes(searchTerm)
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortMode === 'qty_desc') {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'qty_asc') {
      if (a.quantity !== b.quantity) return a.quantity - b.quantity;
      return a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const displayedProducts = sortedProducts.slice((page - 1) * pageSize, page * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, products.length]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold ${t.text}`}>Складской Учет</h2>
          <p className={`text-xs sm:text-sm ${t.textMuted}`}>Управление остатками труб и профиля (Цены в USD)</p>
        </div>
      </div>
      {(user?.permissions?.canEditProducts !== false) && (
        <button
          onClick={openAddModal}
          className={`${theme === 'light' ? 'bg-[#1A73E8] hover:bg-[#1557B0]' : 'bg-primary-600 hover:bg-primary-500'} text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${t.shadow} text-sm sm:text-base`}
        >
          <Plus size={18} /> <span className="hidden sm:inline">Добавить товар</span><span className="sm:hidden">Добавить</span>
        </button>
      )}




      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={20} />
          <input
            type="text"
            placeholder="Поиск по названию или размерам..."
            className={`w-full ${t.bgCard} border ${t.borderInput} ${t.text} pl-10 pr-4 py-3 rounded-xl ${t.focusRing} focus:outline-none transition-all ${t.textPlaceholder}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          className={`${t.bgCard} border ${t.borderInput} ${t.text} px-3 py-3 rounded-xl ${t.focusRing} focus:outline-none`}
        >
          <option value="qty_desc">Остаток: по убыванию</option>
          <option value="qty_asc">Остаток: по возрастанию</option>
          <option value="name_asc">Название: А → Я</option>
        </select>
      </div>

      {/* List Container (scrollable because parent content is overflow-hidden) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-2">
        {/* Table - Desktop */}
        <div className={`hidden lg:block ${t.bgCard} rounded-xl border ${t.border} overflow-hidden ${t.shadow}`}>
          <div className="overflow-x-auto">
            <table className={`w-full text-left ${t.textSecondary}`}>
              <thead className={`${t.bgPanelAlt} text-xs uppercase tracking-wider ${t.textMuted} font-medium`}>
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
              <tbody className={`divide-y ${t.border}`}>
                {displayedProducts.map((product) => (
                  <tr key={product.id} className={`${t.bgCardHover} transition-colors`}>
                    <td className={`px-6 py-4 font-medium ${t.text}`}>
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
                    <td className={`px-6 py-4 text-right font-mono ${product.quantity <= product.minStockLevel ? t.danger : t.text}`}>
                      {product.quantity} <span className={`text-xs ${t.textMuted}`}>{product.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">
                      {user?.permissions?.canViewCostPrice !== false ? (
                        `$${(product.costPrice || 0).toFixed(2)}`
                      ) : (
                        <span className={`${t.textMuted} flex justify-end gap-1 items-center`}><Lock size={12} /> ***</span>
                      )}
                    </td>

                    <td className={`px-6 py-4 text-right font-mono ${t.success}`}>
                      ${product.pricePerUnit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className={`${t.textMuted} hover:${t.accent} transition-colors p-2 rounded-lg ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-primary-400/10'}`}
                          title="Редактировать"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className={`${t.textMuted} hover:text-red-500 transition-colors p-2 rounded-lg ${theme === 'light' ? 'hover:bg-red-50' : 'hover:bg-red-400/10'}`}
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
                    <td colSpan={8} className={`px-6 py-12 text-center ${t.textMuted}`}>
                      Товары не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cards - Mobile/Tablet */}
        <div className="lg:hidden space-y-3">
          {displayedProducts.map((product) => (
            <div key={product.id} className={`${t.bgCard} rounded-xl border ${t.border} p-4 space-y-3 ${t.shadow}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`font-medium ${t.text} text-sm sm:text-base`}>{product.name}</h3>
                  {product.origin === 'import' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 mt-1">
                      ИМПОРТ
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className={`${t.textMuted} hover:${t.accent} transition-colors p-2 rounded-lg ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-primary-400/10'}`}
                    title="Редактировать"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className={`${t.textMuted} hover:text-red-500 transition-colors p-2 rounded-lg ${theme === 'light' ? 'hover:bg-red-50' : 'hover:bg-red-400/10'}`}
                    title="Удалить"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <p className={`${t.textMuted} mb-1`}>Тип</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${product.type === ProductType.PIPE ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    product.type === ProductType.PROFILE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                    {product.type}
                  </span>
                </div>
                <div>
                  <p className={`${t.textMuted} mb-1`}>Размеры</p>
                  <p className={t.text}>{product.dimensions}</p>
                </div>
                <div>
                  <p className={`${t.textMuted} mb-1`}>Сталь</p>
                  <p className={t.text}>{product.steelGrade}</p>
                </div>
                <div>
                  <p className={`${t.textMuted} mb-1`}>Остаток</p>
                  <p className={`font-mono ${product.quantity <= product.minStockLevel ? 'text-red-500' : t.textSecondary}`}>
                    {product.quantity} <span className={`text-xs ${t.textMuted}`}>{product.unit}</span>
                  </p>
                </div>
                <div>
                  <p className={`${t.textMuted} mb-1`}>Себестоимость</p>
                  <p className={`font-mono ${t.textMuted}`}>
                    {user?.permissions?.canViewCostPrice !== false ? (
                      `$${(product.costPrice || 0).toFixed(2)}`
                    ) : (
                      <span className={`${t.textMuted} flex items-center gap-1`}><Lock size={12} /> ***</span>
                    )}
                  </p>
                </div>

                <div>
                  <p className={`${t.textMuted} mb-1`}>Цена</p>
                  <p className={`font-mono ${t.success}`}>${product.pricePerUnit.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className={`${t.bgCard} rounded-xl border ${t.border} p-12 text-center ${t.textMuted}`}>
              Товары не найдены
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {
        filteredProducts.length > pageSize && (
          <div className={`flex items-center justify-between ${t.bgCard} border ${t.border} rounded-xl px-4 py-3`}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${t.borderInput} ${t.textSecondary} disabled:opacity-50 disabled:cursor-not-allowed ${t.bgCardHover} transition-colors`}
            >
              Назад
            </button>
            <div className={`text-sm ${t.textSecondary}`}>
              Стр. {page} из {totalPages} • {filteredProducts.length} товаров
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${t.borderInput} ${t.textSecondary} disabled:opacity-50 disabled:cursor-not-allowed ${t.bgCardHover} transition-colors`}
            >
              Вперёд
            </button>
          </div>
        )
      }

      {/* Add/Edit Modal */}
      {
        showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className={`${t.bgCard} rounded-xl sm:rounded-2xl w-full max-w-2xl border ${t.border} shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]`}>
              <div className={`p-6 border-b ${t.border} flex justify-between items-center ${t.bgPanelAlt}`}>
                <h3 className={`text-xl font-bold ${t.text}`}>
                  {editingId ? 'Редактировать товар' : 'Новый товар'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className={`${t.textMuted} hover:${t.text}`}>&times;</button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* AI Input Section - Only show for new items */}
                {!editingId && (
                  <div className={`${t.accentBg} border ${theme === 'light' ? 'border-blue-200' : 'border-indigo-500/20'} rounded-xl p-4 space-y-3`}>
                    <div className={`flex items-center gap-2 ${t.accent} font-medium`}>
                      <BrainCircuit size={18} />
                      <span>AI Автозаполнение</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className={`flex-1 ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 text-sm ${t.text} ${t.focusRing} outline-none`}
                        placeholder='Например: "Труба 50мм сталь 20 100м по $3.5"'
                        value={smartInput}
                        onChange={e => setSmartInput(e.target.value)}
                      />
                      <button
                        onClick={handleSmartParse}
                        disabled={isAiLoading}
                        className={`${t.buttonPrimary} px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center`}
                      >
                        {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : 'Распознать'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Название <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className={`w-full ${t.bgInput} border rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:outline-none ${!formData.name && showAddModal ? 'border-red-500/50 focus:ring-red-500' : `${t.borderInput} ${t.focusRing}`
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
                    <label className={`text-xs font-medium ${t.textMuted}`}>Тип</label>
                    <select
                      className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} outline-none`}
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as ProductType })}
                    >
                      {Object.values(ProductType).map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Размеры</label>
                    <input
                      type="text"
                      className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} outline-none`}
                      value={formData.dimensions || ''}
                      onChange={e => setFormData({ ...formData, dimensions: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Марка стали</label>
                    <input
                      type="text"
                      className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} outline-none`}
                      value={formData.steelGrade || ''}
                      onChange={e => setFormData({ ...formData, steelGrade: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Ед. измерения</label>
                    <select
                      className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} outline-none`}
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
                    <label className={`text-xs font-medium ${t.textMuted}`}>Количество</label>
                    <input
                      type="number"
                      disabled
                      className={`w-full ${theme === 'light' ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-slate-800 border-slate-700 text-slate-500'} border rounded-lg px-3 py-2 outline-none cursor-not-allowed`}
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>

                  {/* Prices Row */}
                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Себестоимость (USD)</label>
                    <div className="relative">
                      <TrendingUp className={`absolute left-2 top-2.5 ${t.textMuted}`} size={14} />
                      <input
                        type="number"
                        disabled
                        className={`w-full ${theme === 'light' ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-slate-800 border-slate-700 text-slate-500'} border rounded-lg pl-7 pr-3 py-2 outline-none cursor-not-allowed`}
                        placeholder="0.00"
                        value={formData.costPrice}
                        onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Цена продажи (USD)</label>
                    <div className="relative">
                      <DollarSign className={`absolute left-2 top-2.5 ${t.textMuted}`} size={14} />
                      <input
                        type="number"
                        className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg pl-7 pr-3 py-2 ${t.text} outline-none`}
                        placeholder="0.00"
                        value={formData.pricePerUnit}
                        onChange={e => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-6 border-t ${t.border} flex justify-end gap-3 ${t.bgPanelAlt}`}>
                <button
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 ${t.textSecondary} hover:${t.text} transition-colors`}
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveProduct}
                  className={`${t.buttonPrimary} px-6 py-2 rounded-lg font-medium ${t.shadowButton} transition-all transform active:scale-95`}
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
