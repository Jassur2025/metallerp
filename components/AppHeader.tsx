import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { headerTitles } from '../config/navigation';

interface AppHeaderProps {
  activeTab: string;
  error: string | null;
  theme?: 'light' | 'dark';
  onToggleSidebar: () => void;
  onToggleTheme?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = React.memo(({
  activeTab,
  error,
  theme = 'dark',
  onToggleSidebar,
  onToggleTheme,
}) => {
  const isLight = theme === 'light';

  return (
    <header className={`h-16 flex items-center justify-between px-4 lg:px-6 z-10 ${isLight
      ? 'bg-white border-b border-slate-200 shadow-sm'
      : 'bg-slate-800 border-b border-slate-700'
    }`}>
      {/* Mobile Menu Button */}
      <button
        onClick={onToggleSidebar}
        className={`lg:hidden p-2 rounded-lg transition-colors mr-2 ${isLight
          ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
          : 'hover:bg-slate-700 text-slate-400 hover:text-white'
        }`}
      >
        <Menu size={24} />
      </button>

      <h1 className={`text-lg lg:text-xl font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {headerTitles[activeTab] || ''}
      </h1>

      <div className="flex items-center gap-2 lg:gap-4">
        {error && (
          <div className="text-red-400 text-xs lg:text-sm bg-red-500/10 px-2 lg:px-3 py-1 rounded-full border border-red-500/20 animate-pulse hidden sm:block">
            {error}
          </div>
        )}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg transition-all duration-200 ${isLight
              ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              : 'hover:bg-slate-700 text-slate-400 hover:text-yellow-300'
            }`}
            title={isLight ? 'Тёмная тема' : 'Светлая тема'}
          >
            {isLight ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        )}
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';
