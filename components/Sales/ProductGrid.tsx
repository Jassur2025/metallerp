import React from 'react';
import { Product } from '../../types';
import { Plus, ArrowUpDown } from 'lucide-react';

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
    <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
      {/* Search & Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Поиск товара..."
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 pl-4 pr-10 py-3 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none appearance-none h-full cursor-pointer hover:bg-slate-750"
          >
            <option value="default">По умолчанию</option>
            <option value="price-asc">Цена: Низкая → Высокая</option>
            <option value="price-desc">Цена: Высокая → Низкая</option>
            <option value="qty-asc">Остаток: Мало → Много</option>
            <option value="qty-desc">Остаток: Много → Мало</option>
          </select>
          <ArrowUpDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
          {filteredProducts.map(product => {
            const priceUZS = toUZS(product.pricePerUnit);
            return (
              <div 
                key={product.id} 
                className="bg-slate-800 border border-slate-700 p-4 rounded-xl hover:border-primary-500/50 transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      {product.name}
                      {product.origin === 'import' && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                          ИМПОРТ
                        </span>
                      )}
                    </h3>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                      {product.dimensions}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">Сталь: {product.steelGrade}</p>
                  <div className="flex justify-between items-end mt-4">
                    <div>
                      <span className="text-lg font-mono font-bold text-emerald-400 block">
                        {priceUZS.toLocaleString()} сўм
                      </span>
                      <span className="text-xs text-slate-500">
                        ${product.pricePerUnit.toFixed(2)} / {product.unit}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">Остаток: {product.quantity}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => onAddToCart(e, product)}
                  className="mt-4 w-full bg-slate-700 hover:bg-primary-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-all opacity-80 group-hover:opacity-100 active:scale-95"
                >
                  <Plus size={16} /> В корзину
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


