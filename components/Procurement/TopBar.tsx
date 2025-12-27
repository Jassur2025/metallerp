import React from 'react';
import { Globe, MapPin } from 'lucide-react';
import type { ProcurementTab, ProcurementType } from './types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className="flex justify-between items-end">
      <div>
        <h2 className={`text-3xl font-bold ${t.text} tracking-tight`}>Закуп и Импорт</h2>
        <p className={`${t.textMuted} mt-1`}>Управление поставками и расчетами</p>
      </div>

      {/* Main Mode Switcher */}
      <div className={`flex ${t.bgCard} p-1 rounded-lg border ${t.border} mr-auto ml-8`}>
        <button
          onClick={() => setProcurementType('local')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
            procurementType === 'local'
              ? 'bg-emerald-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text}`
          }`}
        >
          <MapPin size={16} /> Местный Закуп
        </button>
        <button
          onClick={() => setProcurementType('import')}
          className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${
            procurementType === 'import'
              ? 'bg-blue-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text}`
          }`}
        >
          <Globe size={16} /> Импорт
        </button>
      </div>

      <div className={`flex ${t.bgCard} p-1 rounded-lg border ${t.border}`}>
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'new'
              ? `${t.bgHover} ${t.text} shadow-lg`
              : `${t.textMuted} hover:${t.text}`
          }`}
        >
          Новая закупка
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'workflow'
              ? `${t.bgHover} ${t.text} shadow-lg`
              : `${t.textMuted} hover:${t.text}`
          }`}
        >
          Workflow
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history'
              ? `${t.bgHover} ${t.text} shadow-lg`
              : `${t.textMuted} hover:${t.text}`
          }`}
        >
          История и Долги
        </button>
      </div>
    </div>
  );
};








