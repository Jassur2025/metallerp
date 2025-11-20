
import React, { useState, useEffect } from 'react';
import { Product, Order, OrderItem, AppSettings } from '../types';
import { ShoppingCart, Plus, Trash2, CheckCircle, RefreshCw, Package, FileText, FileSpreadsheet, User, ArrowUpDown } from 'lucide-react';

interface SalesProps {
  products: Product[];
  setProducts: (p: Product[]) => void;
  orders: Order[];
  setOrders: (o: Order[]) => void;
  settings: AppSettings;
}

interface FlyingIconProps {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    onComplete: () => void;
}

// Sub-component for the single flying animation
const FlyingIcon: React.FC<FlyingIconProps> = ({ 
    startX, startY, targetX, targetY, onComplete 
}) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        left: startX,
        top: startY,
        opacity: 1,
        transform: 'translate(-50%, -50%) scale(1)',
        zIndex: 100,
        transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)' // Smooth cubic bezier
    });

    useEffect(() => {
        // Trigger animation in next frame to ensure browser paints start position first
        const frameId = requestAnimationFrame(() => {
            setStyle({
                position: 'fixed',
                left: targetX,
                top: targetY,
                opacity: 0,
                transform: 'translate(-50%, -50%) scale(0.2)', // Shrink while flying
                zIndex: 100,
                transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
            });
        });

        const timer = setTimeout(onComplete, 600); // Match transition duration

        return () => {
            cancelAnimationFrame(frameId);
            clearTimeout(timer);
        };
    }, [targetX, targetY, onComplete]);

    return (
        <div style={style} className="text-primary-400 pointer-events-none">
            <Package size={24} fill="currentColor" fillOpacity={0.2} />
        </div>
    );
};

export const Sales: React.FC<SalesProps> = ({ products, setProducts, orders, setOrders, settings }) => {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<string>('default');
  const [exchangeRate, setExchangeRate] = useState<number>(settings.defaultExchangeRate);
  
  // Animation State
  const [flyingItems, setFlyingItems] = useState<{id: number, startX: number, startY: number, targetX: number, targetY: number}[]>([]);

  // Reset exchange rate if settings change, but only if user hasn't manually edited it (simplified: just sync on mount/change)
  useEffect(() => {
      setExchangeRate(settings.defaultExchangeRate);
  }, [settings.defaultExchangeRate]);

  // Helper to convert USD to UZS
  const toUZS = (usd: number) => Math.round(usd * exchangeRate);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) return;

    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      priceAtSale: product.pricePerUnit, // Storing USD
      costAtSale: product.costPrice || 0, // Snapshot current cost
      unit: product.unit,
      total: product.pricePerUnit // Storing USD
    };
    setCart([...cart, newItem]);
  };

  // Wrapper to handle visual animation + logic
  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>, product: Product) => {
      // 1. Logic
      addToCart(product);

      // 2. Visual Animation
      const btnRect = e.currentTarget.getBoundingClientRect();
      const cartTarget = document.getElementById('cart-target');
      
      if (cartTarget) {
          const cartRect = cartTarget.getBoundingClientRect();
          const newItem = {
              id: Date.now(),
              startX: btnRect.left + btnRect.width / 2,
              startY: btnRect.top + btnRect.height / 2,
              targetX: cartRect.left + cartRect.width / 2,
              targetY: cartRect.top + cartRect.height / 2
          };
          setFlyingItems(prev => [...prev, newItem]);
      }
  };

  const removeFlyingItem = (id: number) => {
      setFlyingItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (productId: string, qty: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return item;
        
        // Don't allow more than stock (simplified validation)
        const validQty = Math.min(Math.max(0, qty), product.quantity);
        
        return {
          ...item,
          quantity: validQty,
          total: validQty * item.priceAtSale
        };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.productId !== id));
  };

  // Calculations
  const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
  const vatAmountUSD = subtotalUSD * (settings.vatRate / 100);
  const totalAmountUSD = subtotalUSD + vatAmountUSD;
  const totalAmountUZS = toUZS(totalAmountUSD);

  const completeOrder = () => {
    if (cart.length === 0 || !customerName) return;

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString(),
      customerName,
      sellerName: sellerName || 'Администратор',
      items: [...cart],
      
      subtotalAmount: subtotalUSD,
      vatRateSnapshot: settings.vatRate,
      vatAmount: vatAmountUSD,
      totalAmount: totalAmountUSD,
      
      exchangeRate: exchangeRate,
      totalAmountUZS: totalAmountUZS,
      status: 'completed'
    };

    // Update Inventory
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.productId === p.id);
      if (cartItem) {
        return { ...p, quantity: p.quantity - cartItem.quantity };
      }
      return p;
    });

    setOrders([newOrder, ...orders]);
    setProducts(updatedProducts);
    
    // Reset
    setCart([]);
    setCustomerName('');
    setSellerName('');
    alert(`Заказ оформлен!\nСумма: ${totalAmountUZS.toLocaleString()} UZS\n(вкл. НДС ${settings.vatRate}%)`);
  };

  // Export Handlers
  const exportToCSV = () => {
    if (cart.length === 0) return;
    
    // BOM for Excel to recognize UTF-8
    const BOM = "\uFEFF";
    const headers = ["Товар", "Количество", "Ед. изм.", "Цена (USD)", "Сумма (USD)"];
    
    const csvRows = cart.map(item => {
      const name = `"${item.productName.replace(/"/g, '""')}"`; // Escape quotes
      return [
        name,
        item.quantity,
        item.unit,
        item.priceAtSale.toFixed(2),
        item.total.toFixed(2)
      ].join(",");
    });

    const csvContent = BOM + [headers.join(","), ...csvRows].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cart_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (cart.length === 0) return;

    const tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Корзина</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              <th style="background-color: #f0f0f0; font-weight: bold;">Товар</th>
              <th style="background-color: #f0f0f0; font-weight: bold;">Количество</th>
              <th style="background-color: #f0f0f0; font-weight: bold;">Ед. изм.</th>
              <th style="background-color: #f0f0f0; font-weight: bold;">Цена (USD)</th>
              <th style="background-color: #f0f0f0; font-weight: bold;">Сумма (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${cart.map(item => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>${item.priceAtSale.toFixed(2)}</td>
                <td>${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr>
                <td colspan="4" style="font-weight: bold; text-align: right;">ИТОГО:</td>
                <td style="font-weight: bold;">${subtotalUSD.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="4" style="font-weight: bold; text-align: right;">НДС (${settings.vatRate}%):</td>
                <td style="font-weight: bold;">${vatAmountUSD.toFixed(2)}</td>
            </tr>
             <tr>
                <td colspan="4" style="font-weight: bold; text-align: right;">ВСЕГО:</td>
                <td style="font-weight: bold; color: green;">${totalAmountUSD.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cart_export_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.quantity > 0)
    .sort((a, b) => {
        switch (sortOption) {
            case 'price-asc':
                return a.pricePerUnit - b.pricePerUnit;
            case 'price-desc':
                return b.pricePerUnit - a.pricePerUnit;
            case 'qty-asc':
                return a.quantity - b.quantity;
            case 'qty-desc':
                return b.quantity - a.quantity;
            default:
                return 0;
        }
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 h-[calc(100vh-2rem)] gap-6 p-6 relative">
      {/* Animation Layer */}
      {flyingItems.map(item => (
          <FlyingIcon 
              key={item.id} 
              startX={item.startX} 
              startY={item.startY} 
              targetX={item.targetX} 
              targetY={item.targetY} 
              onComplete={() => removeFlyingItem(item.id)} 
          />
      ))}

      {/* Left: Product Selection */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <h2 className="text-2xl font-bold text-white">Продажа (с НДС {settings.vatRate}%)</h2>
             <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                 <span className="text-slate-400 text-sm">Курс USD/UZS:</span>
                 <input 
                   type="number" 
                   className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-right outline-none focus:border-primary-500"
                   value={exchangeRate}
                   onChange={e => setExchangeRate(Number(e.target.value))}
                 />
                 <RefreshCw size={14} className="text-slate-500" />
             </div>
        </div>
        
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
                     <option value="price-asc">Цена: Низкая &rarr; Высокая</option>
                     <option value="price-desc">Цена: Высокая &rarr; Низкая</option>
                     <option value="qty-asc">Остаток: Мало &rarr; Много</option>
                     <option value="qty-desc">Остаток: Много &rarr; Мало</option>
                 </select>
                 <ArrowUpDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pb-4 pr-2 custom-scrollbar">
          {filteredProducts.map(product => {
            // Display price without VAT in catalog, VAT is added at checkout usually in B2B
            const priceUZS = toUZS(product.pricePerUnit);
            return (
            <div key={product.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl hover:border-primary-500/50 transition-colors flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-white">{product.name}</h3>
                  <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">{product.dimensions}</span>
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
                onClick={(e) => handleAddToCart(e, product)}
                className="mt-4 w-full bg-slate-700 hover:bg-primary-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-all opacity-80 group-hover:opacity-100 active:scale-95"
              >
                <Plus size={16} /> В корзину
              </button>
            </div>
          )})}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col shadow-2xl shadow-black/20 overflow-hidden">
        <div id="cart-target" className="p-6 border-b border-slate-700 bg-slate-900/50 relative transition-colors duration-300 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2 z-10">
            <ShoppingCart className={`text-primary-500 transition-transform duration-300 ${flyingItems.length > 0 ? 'scale-110' : 'scale-100'}`} /> Корзина
          </h3>
          
          <div className="flex items-center gap-1 z-10">
              <button onClick={exportToCSV} disabled={cart.length === 0} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Скачать CSV">
                  <FileText size={18} />
              </button>
              <button onClick={exportToExcel} disabled={cart.length === 0} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Скачать Excel">
                  <FileSpreadsheet size={18} />
              </button>
          </div>
          
          {/* Pulse effect background when item lands */}
          <div className={`absolute inset-0 bg-primary-500/10 transition-opacity duration-300 pointer-events-none ${flyingItems.length > 0 ? 'opacity-100' : 'opacity-0'}`}></div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
              <ShoppingCart size={48} />
              <p>Корзина пуста</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="bg-slate-700/30 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 animate-fade-in">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-200 text-sm truncate max-w-[180px]">{item.productName}</span>
                  <button onClick={() => removeFromCart(item.productId)} className="text-slate-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
                     <input 
                       type="number" 
                       className="w-16 bg-transparent text-center text-sm text-white outline-none"
                       value={item.quantity}
                       onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                     />
                     <span className="text-xs text-slate-500 pr-2">{item.unit}</span>
                  </div>
                  <div className="text-right">
                      <span className="font-mono font-bold text-slate-300 block">
                          {toUZS(item.total).toLocaleString()} сўм
                      </span>
                      <span className="text-xs text-slate-500">${item.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-700 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1">
                    <User size={12}/> Клиент
                </label>
                <input 
                type="text" 
                placeholder="Клиент"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1">
                    <User size={12}/> Продавец
                </label>
                <input 
                type="text" 
                placeholder="Продавец"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary-500 outline-none"
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
                />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-sm">
            <div className="flex justify-between items-center">
                <span className="text-slate-400">Подытог (без НДС):</span>
                <span className="font-mono text-slate-300">${subtotalUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-amber-400">
                <span className="">НДС ({settings.vatRate}%):</span>
                <span className="font-mono">+${vatAmountUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-slate-200 font-bold">ИТОГО (USD):</span>
                <span className="font-mono text-slate-200 font-bold">${totalAmountUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
                <span className="text-slate-200 font-bold">К оплате (UZS):</span>
                <span className="text-2xl font-bold text-emerald-400 font-mono">{totalAmountUZS.toLocaleString()}</span>
            </div>
          </div>

          <button 
            onClick={completeOrder}
            disabled={cart.length === 0 || !customerName}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <CheckCircle size={20} /> Оформить
          </button>
        </div>
      </div>
    </div>
  );
};
