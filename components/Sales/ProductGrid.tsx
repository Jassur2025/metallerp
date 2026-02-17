import React, { useState } from 'react';
import { Product } from '../../types';
import { Plus, ArrowUpDown, Package, LayoutGrid, List } from 'lucide-react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface ProductGridProps {
  products: Product[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortOption: string;
  setSortOption: (option: string) => void;
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>, product: Product) => void;
  toUZS: (usd: number) => number;
}

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

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try { localStorage.setItem('erp_product_view', mode); } catch {}
  };
  
  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.quantity > 0)
    .sort((a, b) => {
      switch (sortOption) {
        case 'price-asc': return a.pricePerUnit - b.pricePerUnit;
        case 'price-desc': return b.pricePerUnit - a.pricePerUnit;
        case 'qty-asc': return a.quantity - b.quantity;
        case 'qty-desc': return b.quantity - a.quantity;
        default: return 0;
      }
    });

  return (
    <div className="flex-1 flex flex-col space-y-2.5 overflow-hidden">
      {/* Search & Filters */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Поиск товара..."
          className={`flex-1 ${t.bgInput} border ${t.borderInput} ${t.text} px-4 py-2.5 rounded-xl ${t.focusRing} outline-none text-sm`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className={`${t.bgInput} border ${t.borderInput} ${t.text} pl-3 pr-8 py-2.5 rounded-xl ${t.focusRing} outline-none appearance-none h-full cursor-pointer ${t.bgCardHover} text-sm`}
          >
            <option value="default">По умолчанию</option>
            <option value="price-asc">Цена ↑</option>
            <option value="price-desc">Цена ↓</option>
            <option value="qty-asc">Остаток ↑</option>
            <option value="qty-desc">Остаток ↓</option>
          </select>
          <ArrowUpDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${t.textMuted} pointer-events-none`} />
        </div>
        {/* View toggle — Google Drive style */}
        <div className={`flex ${t.bgInput} border ${t.borderInput} rounded-xl overflow-hidden`}>
          <button
            onClick={() => toggleView('grid')}
            className={`px-2.5 py-2 transition-colors ${viewMode === 'grid'
              ? (theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-primary-500/20 text-primary-400')
              : `${t.textMuted} hover:${t.text}`}`}
            title="Сетка"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => toggleView('list')}
            className={`px-2.5 py-2 transition-colors ${viewMode === 'list'
              ? (theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-primary-500/20 text-primary-400')
              : `${t.textMuted} hover:${t.text}`}`}
            title="Список"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between px-1">
        <span className={`text-xs ${t.textMuted}`}>{filteredProducts.length} товаров</span>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">

        {/* === GRID VIEW === */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 pb-4">
            {filteredProducts.map(product => {
              const priceUZS = toUZS(product.pricePerUnit);
              const isLowStock = product.quantity <= 10;
              return (
                <button
                  key={product.id}
                  onClick={(e) => onAddToCart(e as any, product)}
                  className={`${t.bgCard} border ${t.border} rounded-xl px-3 py-2 text-left transition-all duration-150 
                    hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
                    ${theme === 'light' ? 'hover:border-blue-400 hover:shadow-blue-100' : 'hover:border-primary-500/50 hover:shadow-primary-500/10'}
                    group relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className={`font-semibold ${t.text} text-sm leading-tight truncate flex-1`}>
                      {product.name}
                    </h3>
                    <span className={`text-sm font-bold ${theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-700/80 text-slate-300'} px-2 py-0.5 rounded font-mono whitespace-nowrap`}>
                      {product.dimensions}
                    </span>
                  </div>
                  <p className={`text-[11px] ${t.textMuted} mb-1`}>{product.steelGrade}</p>
                  <div className="flex items-baseline justify-between mb-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-base font-bold font-mono ${t.success} leading-tight`}>
                        {priceUZS.toLocaleString()} <span className="text-[10px] font-normal opacity-70">сўм</span>
                      </span>
                      <span className={`text-[10px] ${t.textMuted} font-mono`}>
                        ${product.pricePerUnit.toFixed(2)}/{product.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${isLowStock ? 'text-orange-400' : t.textMuted}`}>
                      {isLowStock && '⚠ '}{product.quantity.toLocaleString()} шт
                    </span>
                    <div className="flex items-center gap-1">
                      {product.origin === 'import' && (
                        <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium border border-purple-500/20">
                          IMP
                        </span>
                      )}
                      <span className={`text-[10px] ${theme === 'light' ? 'text-blue-500' : 'text-primary-400'} font-medium opacity-0 group-hover:opacity-100 transition-opacity`}>
                        + Добавить
                      </span>
                    </div>
                  </div>
                  <div className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 ${theme === 'light' ? 'ring-2 ring-blue-400/30' : 'ring-2 ring-primary-500/30'}`} />
                </button>
              );
            })}
          </div>
        )}

        {/* === LIST VIEW === */}
        {viewMode === 'list' && (
          <div className={`${t.bgCard} border ${t.border} rounded-xl overflow-hidden`}>
            {/* Table Header */}
            <div className={`grid grid-cols-[1fr_100px_70px_120px_90px_80px_36px] gap-2 px-3 py-2 ${theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-slate-800/60 border-b border-slate-700'} text-[11px] font-semibold uppercase ${t.textMuted}`}>
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
                  className={`grid grid-cols-[1fr_100px_70px_120px_90px_80px_36px] gap-2 items-center px-3 py-2 transition-colors cursor-pointer group
                    ${i % 2 === 0 ? '' : (theme === 'light' ? 'bg-slate-50/50' : 'bg-slate-800/30')}
                    ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-slate-700/40'}`}
                  onClick={(e) => onAddToCart(e as any, product)}
                >
                  {/* Name + import badge */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-sm font-medium ${t.text} truncate`}>{product.name}</span>
                    {product.origin === 'import' && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded font-medium border border-purple-500/20 flex-shrink-0">
                        IMP
                      </span>
                    )}
                  </div>
                  {/* Dimensions */}
                  <span className={`text-sm font-bold font-mono ${t.text}`}>{product.dimensions}</span>
                  {/* Steel */}
                  <span className={`text-xs ${t.textMuted}`}>{product.steelGrade}</span>
                  {/* Price UZS */}
                  <span className={`text-sm font-bold font-mono ${t.success} text-right`}>
                    {priceUZS.toLocaleString()}
                  </span>
                  {/* Price USD */}
                  <span className={`text-xs ${t.textMuted} font-mono text-right`}>
                    ${product.pricePerUnit.toFixed(2)}
                  </span>
                  {/* Stock */}
                  <span className={`text-xs font-medium text-right ${isLowStock ? 'text-orange-400' : t.textMuted}`}>
                    {isLowStock && '⚠ '}{product.quantity.toLocaleString()}
                  </span>
                  {/* Add button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToCart(e as any, product); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100
                      ${theme === 'light' ? 'bg-blue-50 text-blue-500 hover:bg-blue-100' : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'}`}
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
          <div className={`flex flex-col items-center justify-center py-16 ${t.textMuted}`}>
            <Package size={40} className="opacity-30 mb-3" />
            <p className="text-sm">Товары не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
};







