import React from 'react';
import { Settings, LogOut, Menu, X } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { navigationItems } from '../config/navigation';
import type { User } from 'firebase/auth';

interface AppSidebarProps {
  user: User;
  activeTab: string;
  isSidebarOpen: boolean;
  theme?: 'light' | 'dark';
  checkPermission: (module: string) => boolean;
  onTabChange: (tab: string) => void;
  onToggleSidebar: () => void;
  onMobileClose: () => void;
  onLogout: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = React.memo(({
  user,
  activeTab,
  isSidebarOpen,
  theme = 'dark',
  checkPermission,
  onTabChange,
  onToggleSidebar,
  onMobileClose,
  onLogout,
}) => {
  const isLight = theme === 'light';

  return (
    <aside
      className={`${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 w-20'
        } fixed lg:relative h-full ${isLight
          ? 'bg-white border-r border-slate-200 shadow-sm'
          : 'bg-slate-800 border-r border-slate-700'
        } transition-all duration-300 flex flex-col z-40 lg:z-20`}
    >
      {/* Header */}
      <div className={`p-4 flex items-center justify-between h-16 ${isLight
        ? 'border-b border-slate-200'
        : 'border-b border-slate-700'
      }`}>
        {isSidebarOpen && (
          <span className={`font-bold text-xl tracking-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Metal ERP
          </span>
        )}
        <button
          onClick={onToggleSidebar}
          className={`p-2 rounded-lg transition-colors ${isLight
            ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
            : 'hover:bg-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navigationItems.map(item =>
          checkPermission(item.key) ? (
            <SidebarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.key}
              onClick={() => onTabChange(item.key)}
              isOpen={isSidebarOpen}
              onMobileClose={onMobileClose}
              theme={theme}
            />
          ) : null
        )}

        <div className="my-4 border-t border-slate-700 mx-4" />

        <SidebarItem
          icon={<Settings size={20} />}
          label="Настройки"
          active={activeTab === 'settings'}
          onClick={() => onTabChange('settings')}
          isOpen={isSidebarOpen}
          onMobileClose={onMobileClose}
          theme={theme}
        />
      </nav>

      {/* Footer */}
      <div className={`p-4 ${isLight
        ? 'border-t border-slate-200 bg-slate-50'
        : 'border-t border-slate-700 bg-slate-800/50'
      }`}>
        {isSidebarOpen && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isLight
              ? 'bg-[#1A73E8] text-white'
              : 'bg-indigo-500 text-white'
            }`}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {user.displayName || 'Пользователь'}
              </p>
              <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {user.email}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} gap-3 p-2 rounded-lg transition-colors ${isLight
            ? 'text-red-600 hover:bg-red-50'
            : 'text-red-400 hover:bg-red-500/10'
          }`}
          title="Выйти"
        >
          <LogOut size={20} />
          {isSidebarOpen && <span>Выйти</span>}
        </button>
      </div>
    </aside>
  );
});

AppSidebar.displayName = 'AppSidebar';
