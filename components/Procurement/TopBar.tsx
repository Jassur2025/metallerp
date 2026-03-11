import React from 'react';
import { Globe, MapPin, Plus, Clock, GitBranch } from 'lucide-react';
import type { ProcurementTab, ProcurementType } from './types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../contexts/ThemeContext';

interface TopBarProps {
  procurementType: ProcurementType;
  setProcurementType: (t: ProcurementType) => void;
  activeTab: ProcurementTab;
  setActiveTab: (t: ProcurementTab) => void;
}

const tabs: { key: ProcurementTab; label: string; icon: React.ReactNode }[] = [
  { key: 'new', label: 'Новая закупка', icon: <Plus size={15} /> },
  { key: 'workflow', label: 'Workflow', icon: <GitBranch size={15} /> },
  { key: 'history', label: 'История и Долги', icon: <Clock size={15} /> },
];

export const TopBar: React.FC<TopBarProps> = ({
  procurementType,
  setProcurementType,
  activeTab,
  setActiveTab,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Title & subtitle */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className={`text-2xl sm:text-3xl font-extrabold ${t.text} tracking-tight`}>
            Закуп и Импорт
          </h2>
          <p className={`${t.textMuted} text-sm mt-0.5`}>Управление поставками и расчетами</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Procurement Type Switcher */}
        <div className={`inline-flex p-1 rounded-xl ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'} border ${t.border} backdrop-blur-sm`}>
          <button
            onClick={() => setProcurementType('local')}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
              procurementType === 'local'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : `${t.textMuted} hover:${t.text}`
            }`}
          >
            <MapPin size={15} /> Местный Закуп
          </button>
          <button
            onClick={() => setProcurementType('import')}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
              procurementType === 'import'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                : `${t.textMuted} hover:${t.text}`
            }`}
          >
            <Globe size={15} /> Импорт
          </button>
        </div>

        {/* Tab Switcher */}
        <div className={`inline-flex p-1 rounded-xl ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'} border ${t.border} backdrop-blur-sm`}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ${
                activeTab === tab.key
                  ? `${isDark ? 'bg-white/10' : 'bg-white'} ${t.text} shadow-md`
                  : `${t.textMuted} hover:${t.text}`
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
