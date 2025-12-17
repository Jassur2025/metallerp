import React from 'react';
import { Globe, MapPin } from 'lucide-react';
import type { ProcurementTab, ProcurementType } from './types';

interface TopBarProps {
  procurementType: ProcurementType;
  setProcurementType: (t: ProcurementType) => void;
  activeTab: ProcurementTab;
  setActiveTab: (t: ProcurementTab) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  procurementType,
  setProcurementType,
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="flex justify-between items-end">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Закуп и Импорт</h2>
        <p className="text-slate-400 mt-1">Управление поставками и расчетами</p>
      </div>

      {/* Main Mode Switcher */}
      <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mr-auto ml-8">
        <button
          onClick={() => setProcurementType('local')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
            procurementType === 'local'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MapPin size={16} /> Местный Закуп
        </button>
        <button
          onClick={() => setProcurementType('import')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
            procurementType === 'import'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe size={16} /> Импорт
        </button>
      </div>

      <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'new'
              ? 'bg-slate-700 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Новая закупка
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'workflow'
              ? 'bg-slate-700 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Workflow
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-slate-700 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          История и Долги
        </button>
      </div>
    </div>
  );
};



