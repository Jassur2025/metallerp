import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  Container,
  FileText,
  Plus,
  Save,
  Scale,
  Search,
  Trash2,
  Truck,
  Warehouse,
  ChevronDown,
  Package,
  CreditCard,
  Banknote,
  Building2,
  Layers,
  ShoppingCart,
  X,
  Check,
  User,
  Minus,
} from 'lucide-react';
import type { AppSettings, Client, Product, PurchaseItem, PurchaseOverheads, WarehouseType } from '../../types';
import { WarehouseLabels, ProductType } from '../../types';
import type { PaymentCurrency, PaymentMethod, ProcurementType, Totals } from './types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';

const PURCHASE_CATEGORIES = [
  { key: 'all', label: 'Все' },
  { key: ProductType.PIPE, label: 'Трубы' },
  { key: ProductType.PROFILE, label: 'Профили' },
  { key: ProductType.SHEET, label: 'Листы' },
  { key: ProductType.BEAM, label: 'Балки' },
  { key: ProductType.OTHER, label: 'Прочее' },
];

interface NewPurchaseViewProps {
  procurementType: ProcurementType;

  supplierName: string;
  setSupplierName: (v: string) => void;
  selectedClientId?: string;
  setSelectedClientId?: (v: string | undefined) => void;
  clients: Client[];
  date: string;
  setDate: (v: string) => void;

  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  paymentCurrency: PaymentCurrency;
  setPaymentCurrency: (v: PaymentCurrency) => void;

  // Warehouse selection
  selectedWarehouse: WarehouseType;
  setSelectedWarehouse: (v: WarehouseType) => void;

  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (v: string) => void;
  inputQty: number;
  setInputQty: (v: number) => void;
  inputPrice: number;
  setInputPrice: (v: number) => void;

  openNewProductModal: () => void;
  handleAddItem: () => void;
  quickAddProduct: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateCartItemQty: (productId: string, qty: number) => void;
  updateCartItemPrice: (productId: string, price: number) => void;

  overheads: PurchaseOverheads;
  setOverheads: (v: PurchaseOverheads) => void;

  totals: Totals;
  cart: PurchaseItem[];
  settings: AppSettings;

  handleComplete: () => void;
}

export const NewPurchaseView: React.FC<NewPurchaseViewProps> = ({
  procurementType,
  supplierName,
  setSupplierName,
  selectedClientId,
  setSelectedClientId,
  clients,
  date,
  setDate,
  paymentMethod,
  setPaymentMethod,
  paymentCurrency,
  setPaymentCurrency,
  selectedWarehouse,
  setSelectedWarehouse,
  products,
  selectedProductId,
  setSelectedProductId,
  inputQty,
  setInputQty,
  inputPrice,
  setInputPrice,
  openNewProductModal,
  handleAddItem,
  quickAddProduct,
  removeItem,
  updateCartItemQty,
  updateCartItemPrice,
  overheads,
  setOverheads,
  totals,
  cart,
  settings,
  handleComplete,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';

  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Supplier search & dropdown
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const filteredClients = useMemo(() => {
    if (!supplierSearch.trim()) return clients.slice(0, 50);
    const q = supplierSearch.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [clients, supplierSearch]);

  // Close supplier dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const availableCategories = useMemo(() => {
    const types = new Set(products.map(p => p.type));
    return PURCHASE_CATEGORIES.filter(tab => tab.key === 'all' || types.has(tab.key as ProductType));
  }, [products]);

  const filteredGridProducts = useMemo(() => {
    return products
      .filter(p => {
        const q = productSearch.toLowerCase();
        const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.dimensions?.toLowerCase().includes(q) || p.steelGrade?.toLowerCase().includes(q);
        const matchesCat = activeCategory === 'all' || p.type === activeCategory;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, productSearch, activeCategory]);

  const cartProductIds = useMemo(() => new Set(cart.map(c => c.productId)), [cart]);

  // Total weight calculation
  const totalWeightKg = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return sum;
      if (product.unit === 'т') return sum + item.quantity * 1000; // тонны → кг
      if (product.weightPerMeter) return sum + item.quantity * product.weightPerMeter;
      return sum;
    }, 0);
  }, [cart, products]);

  const paymentMethods: { key: PaymentMethod; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
    { key: 'cash', label: 'Наличные', icon: <Banknote size={16} />, color: 'emerald', activeColor: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25' },
    { key: 'card', label: 'Карта', icon: <CreditCard size={16} />, color: 'orange', activeColor: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25' },
    { key: 'bank', label: 'Р/С банк', icon: <Building2 size={16} />, color: 'blue', activeColor: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25' },
    { key: 'debt', label: 'В долг', icon: <FileText size={16} />, color: 'red', activeColor: 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25' },
  ];

  const inputClass = `w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'} border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 outline-none transition-all duration-200`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 overflow-hidden">
      {/* Left Panel: Form controls + Product Grid */}
      <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-1 custom-scrollbar pb-20">
        {/* Document Info Card */}
        <div className={`${isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/60' : 'bg-white'} p-5 rounded-2xl border ${t.border} space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300`}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className={`p-2 rounded-lg ${procurementType === 'import' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
              <FileText size={16} className={procurementType === 'import' ? 'text-blue-500' : 'text-emerald-500'} />
            </div>
            <h3 className={`${t.text} font-bold text-sm`}>
              Основное ({procurementType === 'local' ? 'Местный' : 'Импорт'})
            </h3>
          </div>

          {/* Supplier */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider flex items-center gap-1.5`}>
              <Truck size={12} /> Поставщик
            </label>
            <div ref={supplierDropdownRef} className="relative">
              <div className="relative">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
                <input
                  type="text"
                  className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'} border rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all duration-200`}
                  placeholder={supplierName || 'Поиск поставщика / клиента...'}
                  value={supplierSearch}
                  onChange={(e) => { setSupplierSearch(e.target.value); setIsSupplierDropdownOpen(true); }}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                />
                {supplierName && !supplierSearch && (
                  <div className={`absolute inset-0 flex items-center pl-9 pr-10 pointer-events-none`}>
                    <span className={`text-sm ${t.text} truncate`}>{supplierName}</span>
                  </div>
                )}
                {supplierName ? (
                  <button
                    onClick={() => { setSupplierName(''); setSelectedClientId?.(undefined); setSupplierSearch(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X size={14} className={`${t.textMuted} hover:text-red-400 transition-colors`} />
                  </button>
                ) : (
                  <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textMuted} transition-transform ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Supplier Dropdown */}
              {isSupplierDropdownOpen && (
                <div className={`absolute z-30 w-full mt-1.5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar`}>
                  {/* Manual entry option */}
                  {supplierSearch.trim() && !filteredClients.some(c => c.name.toLowerCase() === supplierSearch.toLowerCase()) && (
                    <button
                      onClick={() => {
                        setSupplierName(supplierSearch.trim());
                        setSelectedClientId?.(undefined);
                        setIsSupplierDropdownOpen(false);
                        setSupplierSearch('');
                      }}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all duration-150 ${isDark ? 'hover:bg-slate-700/50 border-b border-slate-700/50' : 'hover:bg-slate-50 border-b border-slate-100'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0`}>
                        <Plus size={14} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${t.text}`}>«{supplierSearch.trim()}»</div>
                        <div className={`text-[11px] ${t.textMuted}`}>Ввести вручную</div>
                      </div>
                    </button>
                  )}
                  {filteredClients.length === 0 && !supplierSearch.trim() ? (
                    <div className={`px-4 py-6 text-center ${t.textMuted} text-sm`}>Нет клиентов в базе</div>
                  ) : (
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSupplierName(c.name);
                          setSelectedClientId?.(c.id);
                          setIsSupplierDropdownOpen(false);
                          setSupplierSearch('');
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all duration-150 
                          ${c.name === supplierName
                            ? `${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`
                            : `hover:${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center flex-shrink-0`}>
                          <User size={14} className={t.textMuted} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${t.text} truncate`}>{c.name}</div>
                          <div className={`text-xs ${t.textMuted} truncate`}>
                            {c.phone && <span>{c.phone}</span>}
                            {c.companyName && <span> • {c.companyName}</span>}
                          </div>
                        </div>
                        {c.name === supplierName && (
                          <Check size={16} className="text-emerald-500 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Дата прихода</label>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Warehouse Selection */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider flex items-center gap-1.5`}>
              <Warehouse size={12} /> Склад
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['main', 'cloud'] as WarehouseType[]).map(wh => {
                const isActive = selectedWarehouse === wh;
                const icon = wh === 'main' ? '🏭' : '☁️';
                const activeClass = wh === 'main'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border-cyan-500/60 text-cyan-400 shadow-sm'
                  : 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/60 text-violet-400 shadow-sm';
                return (
                  <button
                    key={wh}
                    onClick={() => setSelectedWarehouse(wh)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 ${isActive
                      ? activeClass
                      : `${isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`
                    }`}
                  >
                    {icon} {WarehouseLabels[wh]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Способ оплаты</label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(pm => (
                <button
                  key={pm.key}
                  onClick={() => {
                    setPaymentMethod(pm.key);
                    if (pm.key === 'card' || pm.key === 'bank') setPaymentCurrency('UZS');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all duration-200 ${paymentMethod === pm.key
                    ? pm.activeColor
                    : `${isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}`}
                >
                  {pm.icon} {pm.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPaymentMethod('mixed')}
              className={`w-full py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all duration-200 ${paymentMethod === 'mixed'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                : `${isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`
              }`}
            >
              <Layers size={15} /> Смешанная оплата (частично)
            </button>

            {/* Currency Selection - Only for cash */}
            {paymentMethod === 'cash' && (
              <div className="mt-3 space-y-1.5">
                <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>
                  Валюта оплаты
                </label>
                <div className={`flex p-1 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'} border ${t.border}`}>
                  <button
                    onClick={() => setPaymentCurrency('USD')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${paymentCurrency === 'USD'
                      ? `${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white text-indigo-600'} shadow-sm`
                      : `${t.textMuted}`
                    }`}
                  >
                    💵 USD
                  </button>
                  <button
                    onClick={() => setPaymentCurrency('UZS')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${paymentCurrency === 'UZS'
                      ? `${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-white text-amber-600'} shadow-sm`
                      : `${t.textMuted}`
                    }`}
                  >
                    💰 UZS
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'bank' && (
              <div className={`mt-2 p-2.5 ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} border rounded-xl`}>
                <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>🏦 Оплата с расчётного счёта (UZS)</p>
              </div>
            )}
            {paymentMethod === 'card' && (
              <div className={`mt-2 p-2.5 ${isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'} border rounded-xl`}>
                <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>💳 Оплата картой (UZS)</p>
              </div>
            )}
          </div>
        </div>

        {/* Product Selection Grid */}
        <div className={`${isDark ? 'bg-gradient-to-br from-slate-800/90 to-slate-800/60' : 'bg-white'} p-4 rounded-2xl border ${t.border} shadow-sm flex flex-col`} style={{ maxHeight: '60vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <ShoppingCart size={14} className="text-emerald-500" />
              </div>
              <h3 className={`${t.text} font-bold text-sm`}>Товары</h3>
              <span className={`text-xs ${t.textMuted}`}>({filteredGridProducts.length})</span>
            </div>
            <button
              onClick={openNewProductModal}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-[11px] font-bold transition-all duration-200 shadow-sm"
            >
              + Новый
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2 flex-shrink-0">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <input
              type="text"
              placeholder="Поиск товара..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className={`w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'} border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 ${isDark ? 'focus:ring-emerald-500/30' : 'focus:ring-blue-500/30'} transition-all`}
            />
            {productSearch && (
              <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className={`${t.textMuted} hover:text-red-400`} />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex gap-1 mb-2 flex-shrink-0 flex-wrap">
            {availableCategories.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all duration-200 border ${
                  activeCategory === tab.key
                    ? (isDark
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-blue-500 text-white border-blue-500')
                    : (isDark
                      ? `bg-slate-800/40 ${t.textMuted} border-transparent hover:border-slate-600`
                      : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200')
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredGridProducts.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-8 ${t.textMuted}`}>
                <Package size={32} className="opacity-20 mb-2" />
                <p className="text-xs">Товары не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredGridProducts.slice(0, 80).map(p => {
                  const inCart = cartProductIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => !inCart && quickAddProduct(p)}
                      disabled={inCart}
                      className={`text-left p-2.5 rounded-xl border transition-all duration-150 group relative overflow-hidden
                        ${inCart
                          ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-emerald-50 border-emerald-300 opacity-60')
                          : (isDark
                            ? 'bg-slate-800/50 border-slate-700/60 hover:border-emerald-500/60 hover:bg-slate-800/90 active:bg-slate-700'
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm')
                        } ${inCart ? 'cursor-default' : 'active:scale-[0.97] cursor-pointer'}`}
                    >
                      {/* Name */}
                      <div className={`font-bold text-[12px] leading-snug ${t.text} truncate mb-0.5`}>{p.name}</div>
                      {/* Dims */}
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-300 bg-slate-700/60' : 'text-slate-700 bg-slate-100'} px-1.5 py-0.5 rounded`}>
                          {p.dimensions}
                        </span>
                        {p.steelGrade && p.steelGrade !== '-' && (
                          <span className={`text-[9px] ${t.textMuted}`}>{p.steelGrade}</span>
                        )}
                      </div>
                      {/* Price + Stock + Weight */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          ${p.pricePerUnit.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1">
                          {p.weightPerMeter ? (
                            <span className={`text-[9px] font-mono ${isDark ? 'text-blue-400/80' : 'text-blue-600/80'}`}>{p.weightPerMeter}кг/м</span>
                          ) : null}
                          <span className={`text-[10px] ${t.textMuted}`}>{p.quantity} {p.unit}</span>
                        </div>
                      </div>
                      {/* In-cart badge */}
                      {inCart && (
                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-500/30' : 'bg-emerald-100'}`}>
                          <Check size={10} className={`${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        </div>
                      )}
                      {/* Hover ring */}
                      {!inCart && (
                        <div className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100
                          ${isDark ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-blue-400/40'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Overheads Form - ONLY FOR IMPORT */}
        {procurementType === 'import' && (
          <div className={`${isDark ? 'bg-gradient-to-br from-slate-800/90 to-amber-900/10' : 'bg-gradient-to-br from-white to-amber-50'} p-5 rounded-2xl border ${t.border} space-y-4 shadow-sm relative overflow-hidden`}>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Truck size={16} className="text-amber-500" />
              </div>
              <div>
                <h3 className={`${t.text} font-bold text-sm`}>Накладные расходы (USD)</h3>
                <p className={`text-[11px] ${t.textMuted} mt-0.5`}>Распределяются пропорционально сумме</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Логистика', key: 'logistics' as const, icon: '🚚' },
                { label: 'Тамож. пошлина', key: 'customsDuty' as const, icon: '📋' },
                { label: 'Тамож. НДС', key: 'importVat' as const, icon: '🏛️' },
                { label: 'Прочее', key: 'other' as const, icon: '📦' },
              ].map(({ label, key, icon }) => (
                <div key={key} className="space-y-1">
                  <label className={`text-xs ${t.textMuted} flex items-center gap-1`}>{icon} {label}</label>
                  <input
                    type="number"
                    className={`${inputClass} font-mono`}
                    value={overheads[key] || ''}
                    onChange={(e) => setOverheads({ ...overheads, [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>

            {/* Quick Total */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border`}>
              <span className={`text-xs font-medium ${t.textMuted}`}>Итого накладные:</span>
              <span className="text-sm font-mono font-bold text-amber-500">
                ${(overheads.logistics + overheads.customsDuty + overheads.importVat + overheads.other).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Items Table & Summary */}
      <div className={`lg:col-span-2 flex flex-col h-full ${isDark ? 'bg-gradient-to-b from-slate-800/90 to-slate-900/90' : 'bg-white'} border ${t.border} rounded-2xl shadow-lg overflow-hidden min-w-0`}>
        {/* Table Header */}
        <div className={`px-4 py-3 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'} border-b ${t.border} flex justify-between items-center`}>
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-blue-500" />
            <h3 className={`text-sm font-bold ${t.text}`}>Корзина</h3>
          </div>
          <div className={`${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} px-2.5 py-1 rounded-full border`}>
            <span className={`font-mono font-bold text-xs ${t.text}`}>{cart.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}>
                <Package size={28} className={t.textMuted} />
              </div>
              <p className={`${t.textMuted} text-sm font-medium`}>Список пуст</p>
              <p className={`${t.textMuted} text-xs mt-1`}>Нажмите на товар слева чтобы добавить</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className={`${isDark ? 'bg-slate-800/40' : 'bg-slate-50'} text-[10px] uppercase ${t.textMuted} font-semibold sticky top-0 z-10`}>
                <tr>
                  <th className="px-3 py-2.5">Товар</th>
                  <th className="px-2 py-2.5 text-right">Кол-во</th>
                  <th className="px-2 py-2.5 text-right">Цена</th>
                  <th className={`px-2 py-2.5 text-right ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Вес</th>
                  {procurementType === 'import' && (
                    <th className={`px-2 py-2.5 text-right ${isDark ? 'bg-amber-500/5' : 'bg-amber-50'}`}>
                      <span className="text-amber-500">Себ.</span>
                    </th>
                  )}
                  <th className="px-2 py-2.5 text-right">Сумма</th>
                  <th className="px-1 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.divide}`}>
                {totals.itemsWithLandedCost.map((item, idx) => {
                  const cartItem = cart.find(c => c.productId === item.productId);
                  return (
                    <tr key={item.productId} className={`group ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/50'} transition-colors duration-150`}>
                      <td className="px-3 py-2.5">
                        <div className={`font-medium ${t.text} text-xs leading-tight`}>{item.productName}</div>
                        {cartItem?.dimensions && cartItem.dimensions !== '-' && cartItem.dimensions.trim() !== '' && (
                          <span className={`text-[10px] ${t.textMuted}`}>{cartItem.dimensions}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => updateCartItemQty(item.productId, Math.max(1, item.quantity - 1))}
                            className={`w-6 h-6 flex items-center justify-center rounded-md ${isDark ? 'bg-slate-700/60 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} transition-colors`}
                          >
                            <Minus size={10} />
                          </button>
                          <input
                            type="number"
                            className={`w-10 ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'} text-center font-mono outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            value={item.quantity}
                            onChange={(e) => updateCartItemQty(item.productId, Number(e.target.value))}
                            min={1}
                          />
                          <button
                            onClick={() => updateCartItemQty(item.productId, item.quantity + 1)}
                            className={`w-6 h-6 flex items-center justify-center rounded-md ${isDark ? 'bg-slate-700/60 hover:bg-emerald-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-emerald-500 text-slate-600 hover:text-white'} transition-colors`}
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          className={`w-full max-w-[90px] ${isDark ? 'bg-slate-800/60 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-lg px-1.5 py-1 text-right font-mono focus:ring-2 focus:ring-emerald-500/40 outline-none text-xs transition-all`}
                          value={item.invoicePrice}
                          onChange={(e) => updateCartItemPrice(item.productId, Number(e.target.value))}
                          step={procurementType === 'import' ? 0.01 : 100}
                          min={0}
                        />
                      </td>
                      <td className={`px-2 py-2 text-right`}>
                        {(() => {
                          const prod = products.find(p => p.id === item.productId);
                          if (!prod) return <span className={`text-[10px] ${t.textMuted}`}>—</span>;
                          if (prod.unit === 'т') return <span className={`text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{(item.quantity * 1000).toFixed(0)} кг</span>;
                          if (!prod.weightPerMeter) return <span className={`text-[10px] ${t.textMuted}`}>—</span>;
                          const wKg = item.quantity * prod.weightPerMeter;
                          return (
                            <div>
                              <div className={`text-xs font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                {wKg >= 1000 ? `${(wKg / 1000).toFixed(2)} т` : `${wKg.toFixed(0)} кг`}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      {procurementType === 'import' && (
                        <td className={`px-2 py-2.5 text-right font-mono text-xs font-bold text-amber-500 ${isDark ? 'bg-amber-500/5' : 'bg-amber-50/50'}`}>
                          ${item.landedCost.toFixed(2)}
                        </td>
                      )}
                      <td className={`px-2 py-2.5 text-right font-mono text-xs font-semibold ${t.text}`}>
                        {procurementType === 'import' ? (
                          <span>${(item.landedCost * item.quantity).toFixed(2)}</span>
                        ) : (
                          <div>
                            <div>{(item.quantity * item.invoicePrice).toLocaleString()}</div>
                            <div className={`text-[9px] ${t.textMuted} font-normal`}>${item.landedCost.toFixed(2)}/ед</div>
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/10 ${t.textMuted} hover:text-red-400 transition-all duration-200`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Summary */}
        <div className={`${isDark ? 'bg-slate-800/80' : 'bg-slate-50'} px-4 py-4 border-t ${t.border}`}>
          {/* Total Weight */}
          {totalWeightKg > 0 && (
            <div className={`flex items-center gap-2 mb-3 p-2 rounded-xl ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} border`}>
              <Scale size={14} className="text-blue-500" />
              <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Общий вес:</span>
              <span className={`text-sm font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {totalWeightKg >= 1000 ? `${(totalWeightKg / 1000).toFixed(3)} т` : `${totalWeightKg.toFixed(1)} кг`}
              </span>
              {totalWeightKg >= 1000 && (
                <span className={`text-[10px] ${t.textMuted}`}>({totalWeightKg.toFixed(0)} кг)</span>
              )}
            </div>
          )}
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {procurementType === 'local' && (
              <>
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'} border`}>
                  <p className={`text-[10px] ${t.textMuted} uppercase font-semibold`}>С НДС</p>
                  <p className={`text-sm font-mono font-bold ${t.text} mt-0.5`}>
                    {totals.totalInvoiceValueUZS?.toLocaleString() || 0}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border`}>
                  <p className={`text-[10px] text-amber-500 uppercase font-semibold`}>НДС ({settings.vatRate || 12}%)</p>
                  <p className="text-sm font-mono font-bold text-amber-500 mt-0.5">
                    {totals.totalVatAmountUZS?.toLocaleString() || 0}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'} border`}>
                  <p className={`text-[10px] ${t.textMuted} uppercase font-semibold`}>Без НДС</p>
                  <p className={`text-sm font-mono font-bold ${t.text} mt-0.5`}>
                    {totals.totalWithoutVatUZS?.toLocaleString() || 0}
                  </p>
                </div>
              </>
            )}
            {procurementType === 'import' && (
              <>
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'} border`}>
                  <p className={`text-[10px] ${t.textMuted} uppercase font-semibold`}>Invoice</p>
                  <p className={`text-sm font-mono font-bold ${t.text} mt-0.5`}>
                    ${totals.totalInvoiceValue.toFixed(2)}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border`}>
                  <p className="text-[10px] text-amber-500 uppercase font-semibold">Накладные</p>
                  <p className="text-sm font-mono font-bold text-amber-500 mt-0.5">
                    +${totals.totalOverheads.toFixed(2)}
                  </p>
                </div>
              </>
            )}
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} border`}>
              <p className="text-[10px] text-emerald-500 uppercase font-semibold">Себестоимость</p>
              <p className="text-lg font-mono font-bold text-emerald-500 mt-0.5">
                ${totals.totalLandedValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Payment Info */}
          {paymentMethod !== 'debt' && paymentMethod !== 'mixed' && (
            <div className={`mb-3 p-2.5 rounded-xl ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-200'} border`}>
              <p className={`text-[10px] ${t.textMuted}`}>💰 Оплата:</p>
              <p className={`text-xs font-mono font-semibold ${t.text}`}>
                {paymentMethod === 'cash' ? '💵 Касса' : paymentMethod === 'card' ? '💳 Карта' : '🏦 Р/С'} —{' '}
                {procurementType === 'local' 
                  ? `${totals.totalInvoiceValueUZS?.toLocaleString() || 0} сум`
                  : paymentCurrency === 'USD'
                    ? `$${totals.totalInvoiceValue.toFixed(2)}`
                    : `${(totals.totalInvoiceValue * settings.defaultExchangeRate).toLocaleString()} сум`}
              </p>
            </div>
          )}
          {paymentMethod === 'debt' && (
            <div className={`mb-3 p-2.5 rounded-xl ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'} border`}>
              <p className={`text-[10px] ${isDark ? 'text-red-400' : 'text-red-600'}`}>⚠️ В долг</p>
              <p className={`text-xs font-mono font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                Долг: {procurementType === 'local' 
                  ? `${totals.totalInvoiceValueUZS?.toLocaleString() || 0} сум`
                  : `$${totals.totalInvoiceValue.toFixed(2)}`}
              </p>
            </div>
          )}

          {/* Warning Note */}
          <div className={`flex items-start gap-2 p-2.5 rounded-xl ${isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-200'} border mb-3`}>
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={14} />
            <p className={`text-[10px] ${t.textMuted} leading-relaxed`}>
              Cost Price — <strong>средневзвешенная</strong>. Кредиторка = с НДС.
            </p>
          </div>

          {/* Finalize Button */}
          <button
            onClick={handleComplete}
            disabled={cart.length === 0 || !supplierName}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200
              ${cart.length === 0 || !supplierName
                ? `${isDark ? 'bg-slate-800/60 text-slate-500 border border-slate-700/60' : 'bg-slate-100 text-slate-400 border border-slate-200'} cursor-not-allowed`
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-xl shadow-emerald-500/20 active:scale-[0.99]'
              }`}
          >
            <Save size={16} /> Провести
            {cart.length > 0 && <span className="text-xs font-normal opacity-80">({cart.length})</span>}
          </button>
        </div>
      </div>
    </div>
  );
};




