import React, { useState, useMemo } from 'react';
import { Product, ProductType } from '../../types';
import { Plus, ArrowUpDown, Package, LayoutGrid, List, Search } from 'lucide-react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface ProductGridProps {
  products: Product[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortOption: string;
  setSortOption: (option: string) => void;
  onAddToCart: (e: React.MouseEvent<HTMLElement>, product: Product) => void;
  toUZS: (usd: number) => number;
}

const CATEGORY_TABS = [
  { key: 'all', label: 'Все' },
  { key: ProductType.PIPE, label: 'Трубы' },
  { key: ProductType.PROFILE, label: 'Профили' },
  { key: ProductType.SHEET, label: 'Листы' },
  { key: ProductType.BEAM, label: 'Балки' },
  { key: ProductType.OTHER, label: 'Прочее' },
];

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  searchTerm,
  setSearchTerm,
  sortOption,
  setSortOption,
  onAddToCart,
  toUZS
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try { return (localStorage.getItem('erp_product_view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; }
  });
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try { localStorage.setItem('erp_product_view', mode); } catch {}
  };

  // Get available categories based on current products
  const availableCategories = useMemo(() => {
    const types = new Set(products.filter(p => p.quantity > 0).map(p => p.type));
    return CATEGORY_TABS.filter(tab => tab.key === 'all' || types.has(tab.key as ProductType));
  }, [products]);
  
  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || p.type === activeCategory;
      return matchesSearch && matchesCategory && p.quantity > 0;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'price-asc': return a.pricePerUnit - b.pricePerUnit;
        case 'price-desc': return b.pricePerUnit - a.pricePerUnit;
        case 'qty-asc': return a.quantity - b.quantity;
        case 'qty-desc': return b.quantity - a.quantity;
        default: return 0;
      }
    });

  const isDark = theme !== 'light';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Category Tabs */}
      <div className={`flex items-center gap-1 pb-3 overflow-x-auto custom-scrollbar`}>
        {availableCategories.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200
              ${activeCategory === tab.key
                ? (isDark
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10'
                  : 'bg-blue-500 text-white shadow-lg shadow-blue-500/25')
                : (isDark
                  ? `${t.bgCard} ${t.textMuted} border border-transparent hover:border-slate-600 hover:text-slate-200`
                  : `bg-slate-100 text-slate-600 hover:bg-slate-200`)
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Sort Row */}
      <div className="flex gap-2 pb-3">
        <div className="flex-1 relative">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input
            type="text"
            placeholder="Поиск товара..."
            className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500' : `${t.bgInput} border-slate-200 text-slate-900`} border pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm transition-all focus:ring-2 ${isDark ? 'focus:ring-amber-500/30 focus:border-amber-500/50' : 'focus:ring-blue-500/30 focus:border-blue-400'}`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className={`${isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : `${t.bgInput} border-slate-200 text-slate-700`} border pl-3 pr-8 py-2.5 rounded-xl outline-none appearance-none h-full cursor-pointer text-sm transition-colors ${isDark ? 'hover:border-slate-600' : 'hover:border-slate-300'}`}
          >
            <option value="default">По умолчанию</option>
            <option value="price-asc">Цена ↑</option>
            <option value="price-desc">Цена ↓</option>
            <option value="qty-asc">Остаток ↑</option>
            <option value="qty-desc">Остаток ↓</option>
          </select>
          <ArrowUpDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${t.textMuted} pointer-events-none`} />
        </div>
        {/* View toggle */}
        <div className={`flex ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'} border rounded-xl overflow-hidden`}>
          <button
            onClick={() => toggleView('grid')}
            className={`px-2.5 py-2 transition-all ${viewMode === 'grid'
              ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-50 text-blue-600')
              : `${t.textMuted} hover:text-slate-300`}`}
            title="Сетка"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => toggleView('list')}
            className={`px-2.5 py-2 transition-all ${viewMode === 'list'
              ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-50 text-blue-600')
              : `${t.textMuted} hover:text-slate-300`}`}
            title="Список"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between px-1 pb-2">
        <span className={`text-xs ${t.textMuted} font-medium`}>{filteredProducts.length} товаров</span>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">

        {/* === GRID VIEW === */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 pb-4">
            {filteredProducts.map(product => {
              const priceUZS = toUZS(product.pricePerUnit);
              const isLowStock = product.quantity <= 10;
              const isOutOfStock = product.quantity === 0;
              return (
                <button
                  key={product.id}
                  onClick={(e) => onAddToCart(e, product)}
                  disabled={isOutOfStock}
                  className={`${isDark
                    ? 'bg-slate-800/60 border-slate-700/60 hover:border-amber-500/60 hover:bg-slate-800/90 active:bg-slate-700'
                    : `bg-white border-slate-200 hover:border-blue-400 hover:shadow-md hover:shadow-blue-100`
                  } border rounded-xl p-3 text-left transition-all duration-150
                    active:scale-[0.97] group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {/* Top: Name + dims */}
                  <div className="flex items-start gap-1.5 mb-1">
                    <h3 className={`font-bold ${t.text} text-[13px] leading-snug flex-1 truncate`}>
                      {product.name}
                    </h3>
                    {product.origin === 'import' && (
                      <span className={`text-[9px] ${isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-600 border-purple-200'} px-1.5 py-0.5 rounded font-bold border flex-shrink-0`}>
                        IMP
                      </span>
                    )}
                  </div>

                  {/* Dims + grade row */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700/60' : 'bg-slate-100'}`}>
                      {product.dimensions}
                    </span>
                    {product.steelGrade && product.steelGrade !== '-' && (
                      <span className={`text-[10px] ${t.textMuted} truncate`}>{product.steelGrade}</span>
                    )}
                  </div>

                  {/* Price row */}
                  <div className={`rounded-lg px-2 py-1.5 mb-2 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-base font-extrabold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'} leading-tight`}>
                        {priceUZS.toLocaleString()}
                        <span className={`text-[10px] font-semibold ml-1 opacity-70`}>сўм</span>
                      </span>
                      <span className={`text-[10px] ${t.textMuted} font-mono`}>
                        ${product.pricePerUnit.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Stock + Add btn */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-semibold flex items-center gap-1 ${isLowStock ? 'text-orange-400' : t.textMuted}`}>
                      {isLowStock && <span className="text-orange-400">⚠</span>}
                      {product.quantity.toLocaleString()} {product.unit}
                    </span>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0
                      ${isDark
                        ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/35'
                        : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                      }`}>
                      <Plus size={15} strokeWidth={2.5} />
                    </span>
                  </div>

                  {/* Active ring on hover */}
                  <div className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100
                    ${isDark ? 'ring-1 ring-amber-500/30' : 'ring-1 ring-blue-400/40'}`} />
                </button>
              );
            })}
          </div>
        )}

        {/* === LIST VIEW === */}
        {viewMode === 'list' && (
          <div className={`${isDark ? 'bg-slate-800/50 border-slate-700' : `${t.bgCard} border-slate-200`} border rounded-2xl overflow-hidden`}>
            {/* Table Header */}
            <div className={`grid grid-cols-[1fr_100px_70px_120px_90px_80px_36px] gap-2 px-4 py-2.5 ${isDark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-slate-50 border-b border-slate-200'} text-[11px] font-bold uppercase ${t.textMuted} tracking-wider`}>
              <span>Товар</span>
              <span>Размер</span>
              <span>Сталь</span>
              <span className="text-right">Цена</span>
              <span className="text-right">$/ед</span>
              <span className="text-right">Остаток</span>
              <span></span>
            </div>
            {/* Rows */}
            {filteredProducts.map((product, i) => {
              const priceUZS = toUZS(product.pricePerUnit);
              const isLowStock = product.quantity <= 10;
              return (
                <div
                  key={product.id}
                  className={`grid grid-cols-[1fr_100px_70px_120px_90px_80px_36px] gap-2 items-center px-4 py-2.5 transition-colors cursor-pointer group
                    ${i % 2 === 0 ? '' : (isDark ? 'bg-slate-800/30' : 'bg-slate-50/50')}
                    ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-blue-50'}`}
                  onClick={(e) => onAddToCart(e, product)}
                >
                  {/* Name + import badge */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-sm font-medium ${t.text} truncate`}>{product.name}</span>
                    {product.origin === 'import' && (
                      <span className={`text-[9px] ${isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-600 border-purple-200'} px-1 py-0.5 rounded font-bold border flex-shrink-0`}>
                        IMP
                      </span>
                    )}
                  </div>
                  {/* Dimensions */}
                  <span className={`text-sm font-bold font-mono ${t.text}`}>{product.dimensions}</span>
                  {/* Steel */}
                  <span className={`text-xs ${t.textMuted}`}>{product.steelGrade}</span>
                  {/* Price UZS */}
                  <span className={`text-sm font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'} text-right`}>
                    {priceUZS.toLocaleString()}
                  </span>
                  {/* Price USD */}
                  <span className={`text-xs ${t.textMuted} font-mono text-right`}>
                    ${product.pricePerUnit.toFixed(2)}
                  </span>
                  {/* Stock */}
                  <span className={`text-xs font-semibold text-right ${isLowStock ? 'text-orange-400' : t.textMuted}`}>
                    {isLowStock && '⚠ '}{product.quantity.toLocaleString()}
                  </span>
                  {/* Add button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToCart(e, product); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100
                      ${isDark ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-blue-50 text-blue-500 hover:bg-blue-100'}`}
                    title="Добавить в корзину"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-20 ${t.textMuted}`}>
            <Package size={48} className="opacity-20 mb-3" />
            <p className="text-sm font-medium">Товары не найдены</p>
            <p className="text-xs opacity-60 mt-1">Попробуйте другой поиск или категорию</p>
          </div>
        )}
      </div>
    </div>
  );
};







