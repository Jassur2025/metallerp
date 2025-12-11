import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Product, Client } from '../../types';

interface ReturnModalProps {
  returnClientName: string;
  setReturnClientName: (val: string) => void;
  returnProductName: string;
  setReturnProductName: (val: string) => void;
  returnQuantity: string;
  setReturnQuantity: (val: string) => void;
  returnMethod: 'cash' | 'debt';
  setReturnMethod: (val: 'cash' | 'debt') => void;
  clients: Client[];
  products: Product[];
  onSubmit: () => void;
  onClose: () => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  returnClientName,
  setReturnClientName,
  returnProductName,
  setReturnProductName,
  returnQuantity,
  setReturnQuantity,
  returnMethod,
  setReturnMethod,
  clients,
  products,
  onSubmit,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl animate-scale-in">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="text-amber-500" /> Возврат товара
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Клиент *</label>
            <input
              type="text"
              placeholder="Выберите клиента..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
              value={returnClientName}
              onChange={e => setReturnClientName(e.target.value)}
              list="return-clients-list"
            />
            <datalist id="return-clients-list">
              {clients.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Товар *</label>
            <input
              type="text"
              placeholder="Выберите товар..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
              value={returnProductName}
              onChange={e => setReturnProductName(e.target.value)}
              list="return-products-list"
            />
            <datalist id="return-products-list">
              {products.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Количество *</label>
            <input
              type="number"
              value={returnQuantity}
              onChange={e => setReturnQuantity(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="0"
            />
          </div>

          {/* Refund Method */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Метод возврата</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setReturnMethod('cash')}
                className={`py-2 rounded-lg text-sm font-medium border transition-all ${returnMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
              >
                Вернуть деньги (Нал)
              </button>
              <button
                onClick={() => setReturnMethod('debt')}
                className={`py-2 rounded-lg text-sm font-medium border transition-all ${returnMethod === 'debt' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
              >
                Списать с долга
              </button>
            </div>
          </div>

          <button
            onClick={onSubmit}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-amber-600/20 transition-all mt-4"
          >
            Оформить Возврат
          </button>
        </div>
      </div>
    </div>
  );
};

