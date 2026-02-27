import React from 'react';
import { Product, ProductType, Unit, AppSettings } from '../../types';

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${t.bgCard} rounded-2xl w-full max-w-2xl border ${t.border} shadow-2xl overflow-hidden`}>
        <div className={`p-6 border-b ${t.border} flex justify-between items-center ${t.bg}`}>
          <h3 className={`text-xl font-bold ${t.text}`}>Новый товар</h3>
          <button onClick={onClose} className={`${t.textMuted} hover:${t.text}`}>✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Название *</label>
              <input
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500`}
                value={productData.name || ''}
                onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                placeholder="Например: Труба"
              />
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Тип</label>
              <select
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                value={productData.type}
                onChange={(e) => setProductData({ ...productData, type: e.target.value as ProductType })}
              >
                {Object.values(ProductType).map(pt => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Ед. изм.</label>
              <select
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                value={productData.unit}
                onChange={(e) => setProductData({ ...productData, unit: e.target.value as Unit })}
              >
                {Object.values(Unit).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Производитель</label>
              <select
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                value={productData.manufacturer || ''}
                onChange={(e) => setProductData({ ...productData, manufacturer: e.target.value })}
              >
                <option value="">— Не указан —</option>
                {(settings.manufacturers || []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Размеры *</label>
              <input
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500`}
                value={productData.dimensions || ''}
                onChange={(e) => setProductData({ ...productData, dimensions: e.target.value })}
                placeholder="50x50x3"
              />
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Марка стали</label>
              <input
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500`}
                value={productData.steelGrade || ''}
                onChange={(e) => setProductData({ ...productData, steelGrade: e.target.value })}
                placeholder="Ст3"
              />
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Цена продажи (USD)</label>
              <input
                type="number"
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500 font-mono`}
                value={productData.pricePerUnit ?? 0}
                onChange={(e) => setProductData({ ...productData, pricePerUnit: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Минимальный остаток</label>
              <input
                type="number"
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none focus:ring-2 focus:ring-indigo-500 font-mono`}
                value={productData.minStockLevel ?? 0}
                onChange={(e) => setProductData({ ...productData, minStockLevel: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${t.textMuted}`}>Происхождение</label>
              <select
                className={`w-full ${t.bg} border ${t.border} rounded-lg px-3 py-2 ${t.text} outline-none`}
                value={productData.origin || 'local'}
                onChange={(e) => setProductData({ ...productData, origin: e.target.value as 'import' | 'local' })}
              >
                <option value="local">Местный</option>
                <option value="import">Импорт</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`p-6 border-t ${t.border} flex justify-end gap-3 ${t.bg}`}>
          <button onClick={onClose} className={`px-4 py-2 ${t.textMuted} hover:${t.text} transition-colors`}>
            Отмена
          </button>
          <button
            onClick={onSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-600/20"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
});

NewProductModal.displayName = 'NewProductModal';
