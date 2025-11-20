
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { Save, Settings as SettingsIcon, AlertCircle } from 'lucide-react';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = () => {
    onSave(formData);
    setMessage('Настройки успешно сохранены');
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div className="border-b border-slate-700 pb-6">
        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <SettingsIcon size={32} className="text-primary-500" />
          Настройки Системы
        </h2>
        <p className="text-slate-400 mt-2">Конфигурация налогов и валютных курсов</p>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-lg space-y-8">
        
        {/* Financial Settings */}
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white border-l-4 border-primary-500 pl-4">
                Финансы и Налоги
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                        Ставка НДС (%)
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                        Налог на добавленную стоимость, применяемый к продажам.
                    </p>
                    <div className="relative">
                        <input 
                            type="number" 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                            value={formData.vatRate}
                            onChange={(e) => setFormData({...formData, vatRate: Number(e.target.value)})}
                        />
                        <span className="absolute right-4 top-3 text-slate-500">%</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                        Курс валют по умолчанию (USD → UZS)
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                        Базовый курс, используемый при инициализации продажи.
                    </p>
                    <div className="relative">
                        <input 
                            type="number" 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                            value={formData.defaultExchangeRate}
                            onChange={(e) => setFormData({...formData, defaultExchangeRate: Number(e.target.value)})}
                        />
                        <span className="absolute right-4 top-3 text-slate-500">UZS</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
            <div className="text-sm text-amber-200/80">
                <span className="font-bold text-amber-400">Внимание:</span> Изменение ставки НДС повлияет только на будущие заказы. История существующих заказов останется неизменной для сохранения точности финансового учета.
            </div>
        </div>

        <div className="pt-6 flex items-center justify-between border-t border-slate-700">
            <span className={`text-emerald-400 text-sm transition-opacity ${message ? 'opacity-100' : 'opacity-0'}`}>
                {message}
            </span>
            <button 
                onClick={handleSave}
                className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-600/20 transition-all active:scale-95"
            >
                <Save size={20} />
                Сохранить настройки
            </button>
        </div>

      </div>
    </div>
  );
};
