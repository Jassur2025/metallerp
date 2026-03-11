import React from 'react';
import { Product, ProductType, Unit, AppSettings } from '../../types';
import { X, Package, Save } from 'lucide-react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface NewProductModalProps {
  isOpen: boolean;
  productData: Partial<Product>;
  setProductData: (data: Partial<Product>) => void;
  settings: AppSettings;
  t: Record<string, string>;
  onClose: () => void;
  onSave: () => void;
}

export const NewProductModal: React.FC<NewProductModalProps> = React.memo(({
  isOpen, productData, setProductData, settings, t, onClose, onSave
}) => {
  if (!isOpen) return null;

  const { theme } = useTheme();
  const tc = getThemeClasses(theme);
  const isDark = theme !== 'light';
  const inputClass = `w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'} border rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all duration-200`;
  const selectClass = `w-full ${isDark ? 'bg-slate-800/60 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-200`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${isDark ? 'bg-slate-900' : 'bg-white'} rounded-2xl w-full max-w-2xl border ${t.border} shadow-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`p-5 border-b ${t.border} flex justify-between items-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Package size={16} className="text-indigo-500" />
            </div>
            <h3 className={`text-lg font-bold ${t.text}`}>Новый товар</h3>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}>
            <X size={18} className={t.textMuted} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Название *</label>
              <input
                className={inputClass}
                value={productData.name || ''}
                onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                placeholder="Например: Труба"
              />
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Тип</label>
              <select className={selectClass} value={productData.type} onChange={(e) => setProductData({ ...productData, type: e.target.value as ProductType })}>
                {Object.values(ProductType).map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Ед. изм.</label>
              <select className={selectClass} value={productData.unit} onChange={(e) => setProductData({ ...productData, unit: e.target.value as Unit })}>
                {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Производитель</label>
              <select className={selectClass} value={productData.manufacturer || ''} onChange={(e) => setProductData({ ...productData, manufacturer: e.target.value })}>
                <option value="">— Не указан —</option>
                {(settings.manufacturers || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Размеры *</label>
              <input className={inputClass} value={productData.dimensions || ''} onChange={(e) => setProductData({ ...productData, dimensions: e.target.value })} placeholder="50x50x3" />
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Марка стали</label>
              <input className={inputClass} value={productData.steelGrade || ''} onChange={(e) => setProductData({ ...productData, steelGrade: e.target.value })} placeholder="Ст3" />
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Вес 1 метра (кг/м)</label>
              <input type="number" step="0.01" className={`${inputClass} font-mono`} value={productData.weightPerMeter ?? ''} onChange={(e) => setProductData({ ...productData, weightPerMeter: e.target.value ? Number(e.target.value) : undefined })} placeholder="9.95" />
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Цена продажи (USD)</label>
              <input type="number" className={`${inputClass} font-mono`} value={productData.pricePerUnit ?? 0} onChange={(e) => setProductData({ ...productData, pricePerUnit: Number(e.target.value) })} />
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Минимальный остаток</label>
              <input type="number" className={`${inputClass} font-mono`} value={productData.minStockLevel ?? 0} onChange={(e) => setProductData({ ...productData, minStockLevel: Number(e.target.value) })} />
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Происхождение</label>
              <select className={selectClass} value={productData.origin || 'local'} onChange={(e) => setProductData({ ...productData, origin: e.target.value as 'import' | 'local' })}>
                <option value="local">Местный</option>
                <option value="import">Импорт</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-5 border-t ${t.border} flex justify-end gap-3 ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
          <button onClick={onClose} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${t.textMuted} hover:${t.text} transition-colors`}>
            Отмена
          </button>
          <button
            onClick={onSave}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all duration-200 flex items-center gap-2"
          >
            <Save size={16} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
});

NewProductModal.displayName = 'NewProductModal';
