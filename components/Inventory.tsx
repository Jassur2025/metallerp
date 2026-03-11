
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Product, ProductType, Unit, WarehouseType, WarehouseLabels, AppSettings, Employee } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { useCurrentEmployee } from '../contexts/CurrentEmployeeContext';
import { Plus, Search, Trash2, DollarSign, Pencil, TrendingUp, Lock, Warehouse, Building2, Cloud, RefreshCw, Scale, Package, Layers } from 'lucide-react';
import { DEFAULT_EXCHANGE_RATE, DEFAULT_MANUFACTURERS } from '../constants';
import { IdGenerator } from '../utils/idGenerator';
import { useConfirm } from './ConfirmDialog';


interface InventoryProps {
  products: Product[];
  onSaveProducts?: (products: Product[]) => Promise<void>;
  settings?: AppSettings;
  currentEmployee?: Employee;
}

export const Inventory: React.FC<InventoryProps> = ({ products, onSaveProducts, settings, currentEmployee: propEmployee }) => {
  const toast = useToast();
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';
  const { can, employee: ctxEmployee } = useCurrentEmployee();
  const currentEmployee = propEmployee ?? ctxEmployee;
  const canSeeCost = can('canViewCostPrice');
  const { confirmDelete } = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortMode, setSortMode] = useState<'qty_desc' | 'qty_asc' | 'name_asc'>('qty_desc');

  // Warehouse filter: 'all' | 'main' | 'cloud'
  const [warehouseFilter, setWarehouseFilter] = useState<'all' | WarehouseType>('all');

  // Currency toggle for display
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'UZS'>('USD');
  const rate = settings?.defaultExchangeRate || DEFAULT_EXCHANGE_RATE;
  const fmtPrice = (usd: number) => {
    if (displayCurrency === 'UZS') {
      const uzs = usd * rate;
      return `${uzs.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сум`;
    }
    return `$${usd.toFixed(2)}`;
  };

  // Refs for virtualization
  const tableParentRef = useRef<HTMLDivElement>(null);
  const mobileParentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 56;
  const CARD_HEIGHT = 180;

  // State to track which item is being edited (null means creating new)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Product Form State
  const manufacturers = settings?.manufacturers || DEFAULT_MANUFACTURERS;
  const [formData, setFormData] = useState<Partial<Product>>({
    type: ProductType.PIPE,
    unit: Unit.METER,
    quantity: 0,
    pricePerUnit: 0,
    costPrice: 0,
    manufacturer: manufacturers[0] || ''
  });

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!await confirmDelete(product?.name || 'Товар')) return;
    const updatedProducts = products.filter(p => p.id !== id);
    if (onSaveProducts) {
      onSaveProducts(updatedProducts);
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
      manufacturer: manufacturers[0] || '',
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
            manufacturer: formData.manufacturer,
            quantity: Number(formData.quantity) || 0,
            unit: formData.unit as Unit,
            pricePerUnit: Number(formData.pricePerUnit) || 0,
            costPrice: Number(formData.costPrice) || 0,
            weightPerMeter: formData.weightPerMeter || undefined,
          };
        }
        return p;
      });
    } else {
      // Create Mode
      const product: Product = {
        id: IdGenerator.product(),
        name: formData.name!,
        type: formData.type as ProductType || ProductType.OTHER,
        dimensions: formData.dimensions || '-',
        steelGrade: formData.steelGrade || 'Ст3',
        quantity: Number(formData.quantity) || 0,
        unit: formData.unit as Unit || Unit.METER,
        pricePerUnit: Number(formData.pricePerUnit) || 0,
        costPrice: Number(formData.costPrice) || 0,
        minStockLevel: 0,
        weightPerMeter: formData.weightPerMeter || undefined,
      };
      updatedProducts = [...products, product];
    }

    if (onSaveProducts) {
      onSaveProducts(updatedProducts);
    }

    setShowAddModal(false);
    setEditingId(null);
  };

  // Memoized filtered and sorted products
  const sortedProducts = useMemo(() => {
    const filtered = products.filter(p => {
      // Search filter
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dimensions.includes(searchTerm);

      // Warehouse filter
      const productWarehouse = p.warehouse || WarehouseType.MAIN; // Default to MAIN if not set
      const matchesWarehouse = warehouseFilter === 'all' || productWarehouse === warehouseFilter;

      return matchesSearch && matchesWarehouse;
    });

    return [...filtered].sort((a, b) => {
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
  }, [products, searchTerm, sortMode, warehouseFilter]);

  // Calculate totals for each warehouse
  const warehouseTotals = useMemo(() => {
    const mainTotal = products
      .filter(p => (p.warehouse || WarehouseType.MAIN) === WarehouseType.MAIN)
      .reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0);

    const cloudTotal = products
      .filter(p => p.warehouse === WarehouseType.CLOUD)
      .reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0);

    return {
      main: mainTotal,
      cloud: cloudTotal,
      total: mainTotal + cloudTotal
    };
  }, [products]);

  // IAS 2.9: NRV Check - Inventory valued at lower of cost and Net Realisable Value
  // NRV = Selling Price - Estimated Costs to Sell
  const nrvWarnings = useMemo(() => {
    return products.filter(p => {
      if (!p.quantity || p.quantity <= 0) return false;
      // NRV = selling price (pricePerUnit) is already the expected selling price
      // If costPrice > pricePerUnit, inventory should be written down
      return (p.costPrice || 0) > (p.pricePerUnit || 0) && (p.pricePerUnit || 0) > 0;
    }).map(p => ({
      id: p.id,
      name: p.name,
      dimensions: p.dimensions,
      quantity: p.quantity,
      costPrice: p.costPrice,
      nrv: p.pricePerUnit, // Selling price as proxy for NRV
      writeDownPerUnit: (p.costPrice || 0) - (p.pricePerUnit || 0),
      totalWriteDown: ((p.costPrice || 0) - (p.pricePerUnit || 0)) * (p.quantity || 0),
      warehouse: p.warehouse
    }));
  }, [products]);

  // Category statistics for info cards
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalQty: number; totalWeightKg: number; unit: string }> = {};
    for (const p of products) {
      const key = p.type || 'Прочее';
      if (!stats[key]) stats[key] = { count: 0, totalQty: 0, totalWeightKg: 0, unit: '' };
      stats[key].count++;
      stats[key].totalQty += p.quantity || 0;
      stats[key].unit = p.unit || 'м';
      if (p.unit === 'т') {
        stats[key].totalWeightKg += (p.quantity || 0) * 1000;
      } else if (p.weightPerMeter) {
        stats[key].totalWeightKg += (p.quantity || 0) * p.weightPerMeter;
      }
    }
    // Total across all
    const totalWeightKg = products.reduce((sum, p) => {
      if (p.unit === 'т') return sum + (p.quantity || 0) * 1000;
      if (p.weightPerMeter) return sum + (p.quantity || 0) * p.weightPerMeter;
      return sum;
    }, 0);
    const totalQty = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
    return { byType: stats, totalWeightKg, totalQty, totalCount: products.length };
  }, [products]);

  // Virtualizers for desktop and mobile
  const tableVirtualizer = useVirtualizer({
    count: sortedProducts.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: 10,
  });

  const mobileVirtualizer = useVirtualizer({
    count: sortedProducts.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: useCallback(() => CARD_HEIGHT, []),
    overscan: 5,
  });

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold ${t.text}`}>Складской Учет</h2>
          <p className={`text-xs sm:text-sm ${t.textMuted}`}>Управление остатками труб и профиля (Цены в {displayCurrency})</p>
        </div>
        {/* Currency Toggle */}
        <button
          onClick={() => setDisplayCurrency(prev => prev === 'USD' ? 'UZS' : 'USD')}
          className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${displayCurrency === 'UZS'
            ? 'bg-amber-500/20 border-amber-500 text-amber-400'
            : 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
          }`}
          title="Переключить валюту"
        >
          <RefreshCw size={14} />
          {displayCurrency === 'USD' ? '$ USD' : 'сум UZS'}
        </button>
      </div>

      {/* Warehouse Tabs & Summary */}
      <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 ${t.shadow}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Warehouse Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setWarehouseFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${warehouseFilter === 'all'
                ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`
                }`}
            >
              <Warehouse size={16} />
              Все склады
            </button>
            <button
              onClick={() => setWarehouseFilter(WarehouseType.MAIN)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${warehouseFilter === WarehouseType.MAIN
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`
                }`}
            >
              <Building2 size={16} />
              🏭 Основной склад
            </button>
            <button
              onClick={() => setWarehouseFilter(WarehouseType.CLOUD)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${warehouseFilter === WarehouseType.CLOUD
                ? 'bg-violet-500/20 border-violet-500 text-violet-400'
                : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`
                }`}
            >
              <Cloud size={16} />
              ☁️ Облачный склад
            </button>
          </div>

          {/* Warehouse Totals */}
          {canSeeCost && (
          <div className="flex flex-wrap gap-3 text-sm">
            <div className={`px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-50'} border border-cyan-500/20`}>
              <span className={t.textMuted}>Основной: </span>
              <span className="font-mono font-bold text-cyan-500">{displayCurrency === 'UZS' ? `${(warehouseTotals.main * rate).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сум` : `$${warehouseTotals.main.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-violet-500/10' : 'bg-violet-50'} border border-violet-500/20`}>
              <span className={t.textMuted}>Облачный: </span>
              <span className="font-mono font-bold text-violet-500">{displayCurrency === 'UZS' ? `${(warehouseTotals.cloud * rate).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сум` : `$${warehouseTotals.cloud.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'} border border-emerald-500/20`}>
              <span className={t.textMuted}>Итого ТМЦ: </span>
              <span className="font-mono font-bold text-emerald-500">{displayCurrency === 'UZS' ? `${(warehouseTotals.total * rate).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сум` : `$${warehouseTotals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</span>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* IAS 2.9 NRV Warning Banner */}
      {nrvWarnings.length > 0 && (
        <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}>
          <h4 className="text-amber-500 font-bold text-sm mb-2 flex items-center gap-2">
            ⚠️ IAS 2 — Товары ниже себестоимости ({nrvWarnings.length} шт.)
          </h4>
          <p className={`text-xs ${t.textMuted} mb-2`}>
            Себестоимость превышает цену продажи. Требуется уценка до ЧСР (Чистая Стоимость Реализации).
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {nrvWarnings.map(w => (
              <div key={w.id} className={`flex justify-between items-center text-xs ${t.text} px-2 py-1 rounded ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'}`}>
                <span>{w.name} {w.dimensions} ({w.quantity} шт.)</span>
                <span className="text-red-500 font-mono">
                  Себестоимость: ${w.costPrice.toFixed(2)} → Цена: ${w.nrv.toFixed(2)} | Убыток: ${w.totalWriteDown.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right">
            <span className="text-amber-500 font-bold text-sm font-mono">
              Итого уценка: ${nrvWarnings.reduce((s, w) => s + w.totalWriteDown, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Category Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total summary card */}
        <div className={`${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-800/80 border-slate-700' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'} rounded-xl border p-3 relative overflow-hidden`}>
          <div className={`absolute top-2 right-2 ${isDark ? 'text-emerald-500/20' : 'text-emerald-500/10'}`}><Layers size={28} /></div>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${t.textMuted} mb-1`}>Всего</p>
          <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{categoryStats.totalCount}</p>
          <p className={`text-[10px] ${t.textMuted}`}>товаров</p>
        </div>
        {/* Weight total card */}
        <div className={`${isDark ? 'bg-gradient-to-br from-blue-900/30 to-slate-800/80 border-blue-500/20' : 'bg-gradient-to-br from-blue-50 to-white border-blue-200'} rounded-xl border p-3 relative overflow-hidden`}>
          <div className={`absolute top-2 right-2 ${isDark ? 'text-blue-500/20' : 'text-blue-500/10'}`}><Scale size={28} /></div>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'} mb-1`}>Общий вес</p>
          <p className={`text-lg font-bold font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {categoryStats.totalWeightKg >= 1000 ? `${(categoryStats.totalWeightKg / 1000).toFixed(1)} т` : `${categoryStats.totalWeightKg.toFixed(0)} кг`}
          </p>
          {categoryStats.totalWeightKg >= 1000 && (
            <p className={`text-[10px] ${t.textMuted}`}>{categoryStats.totalWeightKg.toFixed(0)} кг</p>
          )}
        </div>
        {/* Per-type cards */}
        {Object.entries(categoryStats.byType)
          .sort(([,a], [,b]) => b.totalWeightKg - a.totalWeightKg || b.totalQty - a.totalQty)
          .slice(0, 4)
          .map(([type, s]) => {
            const colorMap: Record<string, { cardDark: string; cardLight: string; iconDark: string; iconLight: string; labelDark: string; labelLight: string }> = {
              'Труба': {
                cardDark: 'bg-gradient-to-br from-blue-900/20 to-slate-800/80 border-blue-500/20',
                cardLight: 'bg-gradient-to-br from-blue-50 to-white border-blue-200',
                iconDark: 'text-blue-500/20', iconLight: 'text-blue-500/10',
                labelDark: 'text-blue-400', labelLight: 'text-blue-600',
              },
              'Профиль': {
                cardDark: 'bg-gradient-to-br from-emerald-900/20 to-slate-800/80 border-emerald-500/20',
                cardLight: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200',
                iconDark: 'text-emerald-500/20', iconLight: 'text-emerald-500/10',
                labelDark: 'text-emerald-400', labelLight: 'text-emerald-600',
              },
              'Лист': {
                cardDark: 'bg-gradient-to-br from-amber-900/20 to-slate-800/80 border-amber-500/20',
                cardLight: 'bg-gradient-to-br from-amber-50 to-white border-amber-200',
                iconDark: 'text-amber-500/20', iconLight: 'text-amber-500/10',
                labelDark: 'text-amber-400', labelLight: 'text-amber-600',
              },
              'Балка': {
                cardDark: 'bg-gradient-to-br from-purple-900/20 to-slate-800/80 border-purple-500/20',
                cardLight: 'bg-gradient-to-br from-purple-50 to-white border-purple-200',
                iconDark: 'text-purple-500/20', iconLight: 'text-purple-500/10',
                labelDark: 'text-purple-400', labelLight: 'text-purple-600',
              },
            };
            const fallback = {
              cardDark: 'bg-gradient-to-br from-slate-800 to-slate-800/80 border-slate-600/20',
              cardLight: 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
              iconDark: 'text-slate-500/20', iconLight: 'text-slate-500/10',
              labelDark: 'text-slate-400', labelLight: 'text-slate-600',
            };
            const c = colorMap[type] || fallback;
            return (
              <div key={type} className={`${isDark ? c.cardDark : c.cardLight} rounded-xl border p-3 relative overflow-hidden`}>
                <div className={`absolute top-2 right-2 ${isDark ? c.iconDark : c.iconLight}`}><Package size={24} /></div>
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? c.labelDark : c.labelLight} mb-1`}>{type}</p>
                <p className={`text-sm font-bold ${t.text}`}>{s.count} <span className={`text-[10px] font-normal ${t.textMuted}`}>поз.</span></p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={`text-[10px] font-mono ${t.textMuted}`}>{s.totalQty.toLocaleString()} {s.unit}</span>
                  {s.totalWeightKg > 0 && (
                    <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      {s.totalWeightKg >= 1000 ? `${(s.totalWeightKg / 1000).toFixed(1)}т` : `${s.totalWeightKg.toFixed(0)}кг`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Search + Sort + Add button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
          <input
            type="text"
            placeholder="Поиск по названию или размерам..."
            className={`w-full ${t.bgCard} border ${t.borderInput} ${t.text} pl-10 pr-4 py-2.5 rounded-xl ${t.focusRing} focus:outline-none transition-all ${t.textPlaceholder} text-sm`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          className={`${t.bgCard} border ${t.borderInput} ${t.text} px-3 py-2.5 rounded-xl ${t.focusRing} focus:outline-none text-sm`}
        >
          <option value="qty_desc">Остаток: по убыванию</option>
          <option value="qty_asc">Остаток: по возрастанию</option>
          <option value="name_asc">Название: А → Я</option>
        </select>
        {(currentEmployee?.permissions?.canEditProducts !== false) && (
          <button
            onClick={openAddModal}
            className={`${isDark ? 'bg-primary-600 hover:bg-primary-500' : 'bg-[#1A73E8] hover:bg-[#1557B0]'} text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors text-sm font-semibold whitespace-nowrap`}
          >
            <Plus size={16} /> Добавить
          </button>
        )}
      </div>

      {/* Virtualized List Container */}
      <div className="flex-1 overflow-hidden pb-2">
        {/* Virtual Table - Desktop */}
        <div className={`hidden lg:block ${t.bgCard} rounded-xl border ${t.border} overflow-hidden ${t.shadow}`}>
          {/* Table Header */}
          <div className={`${t.bgPanelAlt} text-xs uppercase tracking-wider ${t.textMuted} font-medium grid grid-cols-[1.5fr_100px_80px_1fr_1fr_1fr_1fr_80px_1fr_1fr_100px]`}>
            <div className="px-6 py-4">Наименование</div>
            <div className="px-2 py-4">Производ.</div>
            <div className="px-6 py-4">Склад</div>
            <div className="px-6 py-4">Тип</div>
            <div className="px-6 py-4">Размеры</div>
            <div className="px-6 py-4">Сталь</div>
            <div className="px-6 py-4 text-right">Остаток</div>
            <div className="px-3 py-4 text-right text-blue-500">Вес</div>
            <div className="px-6 py-4 text-right">Себест.</div>
            <div className="px-6 py-4 text-right">Цена</div>
            <div className="px-6 py-4 text-center">Действия</div>
          </div>

          {/* Virtualized Body */}
          {sortedProducts.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 ${t.textMuted}`}>
              <Package size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium mb-1">{searchTerm ? 'Товары не найдены' : 'Склад пуст'}</p>
              <p className="text-sm">{searchTerm ? 'Попробуйте изменить запрос' : 'Добавьте первый товар, чтобы начать'}</p>
            </div>
          ) : (
            <div
              ref={tableParentRef}
              className="overflow-auto"
              style={{ height: 'calc(100vh - 380px)' }}
            >
              <div
                style={{
                  height: `${tableVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {tableVirtualizer.getVirtualItems().map((virtualRow) => {
                  const product = sortedProducts[virtualRow.index];
                  const productWarehouse = product.warehouse || WarehouseType.MAIN;
                  return (
                    <div
                      key={product.id}
                      className={`absolute top-0 left-0 w-full grid grid-cols-[1.5fr_100px_80px_1fr_1fr_1fr_1fr_80px_1fr_1fr_100px] items-center ${t.bgCardHover} transition-colors border-b ${t.border}`}
                      style={{
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className={`px-6 font-medium ${t.text}`}>
                        <div className="truncate">{product.name}</div>
                        {product.origin === 'import' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            ИМПОРТ
                          </span>
                        )}
                      </div>
                      <div className="px-2 text-xs font-semibold text-slate-500">
                        {product.manufacturer || '-'}
                      </div>
                      <div className="px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${productWarehouse === WarehouseType.CLOUD
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}>
                          {productWarehouse === WarehouseType.CLOUD ? '☁️ Обл' : '🏭 Осн'}
                        </span>
                      </div>
                      <div className="px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${product.type === ProductType.PIPE ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          product.type === ProductType.PROFILE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                          {product.type}
                        </span>
                      </div>
                      <div className={`px-6 ${t.textSecondary}`}>{product.dimensions}</div>
                      <div className="px-6 text-slate-400">{product.steelGrade}</div>
                      <div className={`px-6 text-right font-mono ${product.quantity <= product.minStockLevel ? t.danger : t.text}`}>
                        {product.quantity} <span className={`text-xs ${t.textMuted}`}>{product.unit}</span>
                      </div>
                      <div className="px-3 text-right font-mono text-xs">
                        {(() => {
                          if (product.unit === 'т') {
                            const wKg = product.quantity * 1000;
                            return <span className="text-blue-500 font-semibold">{wKg >= 1000 ? `${(wKg / 1000).toFixed(2)} т` : `${wKg.toFixed(0)} кг`}</span>;
                          }
                          if (product.weightPerMeter) {
                            const wKg = product.quantity * product.weightPerMeter;
                            return <span className="text-blue-500 font-semibold">{wKg >= 1000 ? `${(wKg / 1000).toFixed(2)} т` : `${wKg.toFixed(0)} кг`}</span>;
                          }
                          return <span className={t.textMuted}>—</span>;
                        })()}
                      </div>
                      <div className="px-6 text-right font-mono text-slate-400">
                        {canSeeCost ? (
                          fmtPrice(product.costPrice || 0)
                        ) : (
                          <span className={`${t.textMuted} flex justify-end gap-1 items-center`}><Lock size={12} /> ***</span>
                        )}
                      </div>
                      <div className={`px-6 text-right font-mono ${t.success}`}>
                        {fmtPrice(product.pricePerUnit)}
                      </div>
                      <div className="px-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(product)}
                            className={`${t.textMuted} hover:${t.accent} transition-colors p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-primary-400/10'}`}
                            title="Редактировать"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className={`${t.textMuted} hover:text-red-500 transition-colors p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-red-50' : 'hover:bg-red-400/10'}`}
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Stats */}
          <div className={`px-6 py-3 ${t.bgPanelAlt} border-t ${t.border} text-sm ${t.textMuted} flex items-center justify-between`}>
            <span>Всего: {sortedProducts.length} товаров</span>
            {(() => {
              const totalKg = sortedProducts.reduce((sum, p) => {
                if (p.unit === 'т') return sum + p.quantity * 1000;
                if (p.weightPerMeter) return sum + p.quantity * p.weightPerMeter;
                return sum;
              }, 0);
              return totalKg > 0 ? (
                <span className="flex items-center gap-1.5 text-blue-500 font-medium">
                  <Scale size={14} />
                  Общий вес: <span className="font-mono font-bold">{totalKg >= 1000 ? `${(totalKg / 1000).toFixed(3)} т` : `${totalKg.toFixed(1)} кг`}</span>
                  {totalKg >= 1000 && <span className="text-xs opacity-60">({totalKg.toFixed(0)} кг)</span>}
                </span>
              ) : null;
            })()}
          </div>
        </div>

        {/* Virtual Cards - Mobile/Tablet */}
        <div className="lg:hidden">
          {sortedProducts.length === 0 ? (
            <div className={`${t.bgCard} rounded-xl border ${t.border} p-12 text-center ${t.textMuted}`}>
              <Package size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium mb-1">{searchTerm ? 'Товары не найдены' : 'Склад пуст'}</p>
              <p className="text-sm">{searchTerm ? 'Попробуйте изменить запрос' : 'Добавьте первый товар'}</p>
            </div>
          ) : (
            <>
              <div
                ref={mobileParentRef}
                className="overflow-auto"
                style={{ height: 'calc(100vh - 320px)' }}
              >
                <div
                  style={{
                    height: `${mobileVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
                    const product = sortedProducts[virtualRow.index];
                    const productWarehouse = product.warehouse || WarehouseType.MAIN;
                    return (
                      <div
                        key={product.id}
                        className="absolute top-0 left-0 w-full px-1"
                        style={{
                          height: `${CARD_HEIGHT}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingTop: '6px',
                          paddingBottom: '6px',
                        }}
                      >
                        <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 space-y-3 ${t.shadow} h-full`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-medium ${t.text} text-sm sm:text-base truncate`}>{product.name}</h3>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${productWarehouse === WarehouseType.CLOUD
                                  ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  }`}>
                                  {productWarehouse === WarehouseType.CLOUD ? '☁️' : '🏭'}
                                </span>
                              </div>
                              {product.origin === 'import' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 mt-1">
                                  ИМПОРТ
                                </span>
                              )}
                              {product.manufacturer && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ml-1 ${product.manufacturer === manufacturers[0] ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                    product.manufacturer === manufacturers[1] ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                  }`}>
                                  {product.manufacturer}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEditModal(product)}
                                className={`${t.textMuted} hover:${t.accent} transition-colors p-2 rounded-lg ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-primary-400/10'}`}
                                title="Редактировать"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className={`${t.textMuted} hover:text-red-500 transition-colors p-2 rounded-lg ${theme === 'light' ? 'hover:bg-red-50' : 'hover:bg-red-400/10'}`}
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Тип</p>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${product.type === ProductType.PIPE ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                product.type === ProductType.PROFILE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}>
                                {product.type}
                              </span>
                            </div>
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Размеры</p>
                              <p className={`${t.text} truncate`}>{product.dimensions}</p>
                            </div>
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Остаток</p>
                              <p className={`font-mono ${product.quantity <= product.minStockLevel ? 'text-red-500' : t.textSecondary}`}>
                                {product.quantity}
                              </p>
                            </div>
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Себест.</p>
                              <p className={`font-mono ${t.textMuted}`}>
                                {canSeeCost ? fmtPrice(product.costPrice || 0) : '***'}
                              </p>
                            </div>
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Цена</p>
                              <p className={`font-mono ${t.success}`}>{fmtPrice(product.pricePerUnit)}</p>
                            </div>
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Вес</p>
                              <p className="font-mono text-blue-500 font-semibold">
                                {(() => {
                                  if (product.unit === 'т') { const w = product.quantity * 1000; return w >= 1000 ? `${(w / 1000).toFixed(2)} т` : `${w.toFixed(0)} кг`; }
                                  if (product.weightPerMeter) { const w = product.quantity * product.weightPerMeter; return w >= 1000 ? `${(w / 1000).toFixed(2)} т` : `${w.toFixed(0)} кг`; }
                                  return <span className={t.textMuted}>—</span>;
                                })()}
                              </p>
                            </div>
                            <div>
                              <p className={`${t.textMuted} mb-0.5`}>Сталь</p>
                              <p className={t.text}>{product.steelGrade}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`mt-2 px-4 py-2 ${t.bgCard} border ${t.border} rounded-xl text-sm ${t.textMuted} text-center`}>
                Всего: {sortedProducts.length} товаров
              </div>
            </>
          )}
        </div>
      </div>

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
                    <label className={`text-xs font-medium ${t.textMuted}`}>Производитель</label>
                    <div className="relative">
                      <select
                        className={`w-full ${t.bgInput} border rounded-lg px-3 py-2 ${t.text} ${t.borderInput} ${t.focusRing} appearance-none cursor-pointer`}
                        value={formData.manufacturer || ''}
                        onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                      >
                        <option value="">— Не указан —</option>
                        {manufacturers.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <Building2 size={16} className={`absolute right-3 top-2.5 ${t.textMuted} pointer-events-none`} />
                    </div>
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
                    <label className={`text-xs font-medium ${t.textMuted}`}>Вес 1 метра (кг/м)</label>
                    <input
                      type="number"
                      step="0.01"
                      className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} font-mono outline-none`}
                      value={formData.weightPerMeter ?? ''}
                      onChange={e => setFormData({ ...formData, weightPerMeter: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="9.95"
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
                  {canSeeCost && (
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
                  )}

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${t.textMuted}`}>Цена продажи (USD)</label>
                    <input
                      type="number"
                      className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} outline-none`}
                      placeholder="0"
                      value={formData.pricePerUnit}
                      onChange={e => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                    />
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
