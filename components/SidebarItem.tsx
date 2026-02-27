import React from 'react';

export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isOpen: boolean;
  onMobileClose?: () => void;
  theme?: 'light' | 'dark';
}

export const SidebarItem = React.memo(({ icon, label, active, onClick, isOpen, onMobileClose, theme = 'dark' }: SidebarItemProps) => {
  const handleClick = () => {
    onClick();
    // Close sidebar only on mobile/tablet (below lg)
    if (onMobileClose && window.matchMedia('(max-width: 1023px)').matches) {
      onMobileClose();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center ${isOpen ? 'justify-start px-4' : 'justify-center'} gap-3 py-3 transition-all relative group ${active
        ? theme === 'light'
          ? 'text-[#1A73E8] bg-blue-50 rounded-lg mx-2 font-medium'
          : 'text-white bg-gradient-to-r from-indigo-600/20 to-transparent border-r-2 border-indigo-500'
        : theme === 'light'
          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg mx-2'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      title={!isOpen ? label : ''}
    >
      <div className={`${active ? (theme === 'light' ? 'text-[#1A73E8]' : 'text-indigo-400') : ''} `}>{icon}</div>
      {isOpen && <span className="font-medium">{label}</span>}
      {!isOpen && (
        <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700 shadow-xl">
          {label}
        </div>
      )}
    </button>
  );
});

SidebarItem.displayName = 'SidebarItem';
