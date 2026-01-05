import React, { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark' });

export const ThemeProvider: React.FC<{ theme: Theme; children: React.ReactNode }> = ({ theme, children }) => {
  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Utility function to get theme-aware classes
export const getThemeClasses = (theme: Theme) => ({
  // Backgrounds
  bg: theme === 'light' ? 'bg-[#F8F9FA]' : 'bg-slate-900',
  bgMain: theme === 'light' ? 'bg-[#F8F9FA]' : 'bg-slate-900',
  bgCard: theme === 'light' ? 'bg-white' : 'bg-slate-800',
  bgCardHover: theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700',
  bgHover: theme === 'light' ? 'bg-slate-100' : 'bg-slate-700',
  bgInput: theme === 'light' ? 'bg-white' : 'bg-slate-900',
  input: theme === 'light' ? 'bg-white' : 'bg-slate-900', // alias for bgInput
  bgInputAlt: theme === 'light' ? 'bg-slate-50' : 'bg-slate-800',
  bgHeader: theme === 'light' ? 'bg-white' : 'bg-slate-800',
  bgPanel: theme === 'light' ? 'bg-white' : 'bg-slate-800',
  bgPanelAlt: theme === 'light' ? 'bg-slate-50' : 'bg-slate-900/50',
  bgButton: theme === 'light' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-slate-700 hover:bg-slate-600',
  bgButtonActive: theme === 'light' ? 'bg-[#1A73E8]' : 'bg-indigo-600',
  bgButtonPrimary: theme === 'light' ? 'bg-[#1A73E8] hover:bg-[#1557B0]' : 'bg-emerald-600 hover:bg-emerald-500',
  bgButtonSuccess: theme === 'light' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500',
  bgButtonDanger: theme === 'light' ? 'bg-red-500 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500',
  bgButtonSecondary: theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-600 hover:bg-slate-500 text-white',
  
  // Stat card backgrounds (gradient backgrounds for Dashboard)
  bgStatEmerald: theme === 'light' 
    ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200 hover:border-emerald-300' 
    : 'bg-gradient-to-br from-emerald-900/20 to-slate-800 border-emerald-500/20 hover:border-emerald-500/40',
  bgStatBlue: theme === 'light' 
    ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200 hover:border-blue-300' 
    : 'bg-gradient-to-br from-blue-900/20 to-slate-800 border-blue-500/20 hover:border-blue-500/40',
  bgStatPurple: theme === 'light' 
    ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200 hover:border-purple-300' 
    : 'bg-gradient-to-br from-purple-900/20 to-slate-800 border-purple-500/20 hover:border-purple-500/40',
  bgStatAmber: theme === 'light' 
    ? 'bg-gradient-to-br from-amber-50 to-white border-amber-200 hover:border-amber-300' 
    : 'bg-gradient-to-br from-amber-900/20 to-slate-800 border-amber-500/20 hover:border-amber-500/40',
  bgStatRed: theme === 'light' 
    ? 'bg-gradient-to-br from-red-50 to-white border-red-200 hover:border-red-300' 
    : 'bg-gradient-to-br from-red-900/20 to-slate-800 border-red-500/20 hover:border-red-500/40',
  
  // Borders
  border: theme === 'light' ? 'border-slate-200' : 'border-slate-700',
  borderInput: theme === 'light' ? 'border-slate-300' : 'border-slate-600',
  borderCard: theme === 'light' ? 'border-slate-200' : 'border-slate-700',
  divide: theme === 'light' ? 'divide-slate-200' : 'divide-slate-700',
  
  // Text
  text: theme === 'light' ? 'text-slate-800' : 'text-white',
  textSecondary: theme === 'light' ? 'text-slate-600' : 'text-slate-300',
  textMuted: theme === 'light' ? 'text-slate-500' : 'text-slate-400',
  textPlaceholder: theme === 'light' ? 'placeholder-slate-400' : 'placeholder-slate-500',
  
  // Accents
  accent: theme === 'light' ? 'text-[#1A73E8]' : 'text-indigo-400',
  accentBg: theme === 'light' ? 'bg-blue-50' : 'bg-indigo-500/20',
  success: theme === 'light' ? 'text-emerald-600' : 'text-emerald-400',
  successBg: theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10',
  warning: theme === 'light' ? 'text-amber-600' : 'text-amber-400',
  warningBg: theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10',
  danger: theme === 'light' ? 'text-red-600' : 'text-red-400',
  dangerBg: theme === 'light' ? 'bg-red-50' : 'bg-red-500/10',
  
  // Icon backgrounds
  iconBgEmerald: theme === 'light' ? 'bg-emerald-100' : 'bg-emerald-500/10',
  iconBgBlue: theme === 'light' ? 'bg-blue-100' : 'bg-blue-500/10',
  iconBgPurple: theme === 'light' ? 'bg-purple-100' : 'bg-purple-500/10',
  iconBgAmber: theme === 'light' ? 'bg-amber-100' : 'bg-amber-500/10',
  iconBgRed: theme === 'light' ? 'bg-red-100' : 'bg-red-500/10',
  
  // Icon colors
  iconEmerald: theme === 'light' ? 'text-emerald-600' : 'text-emerald-400',
  iconBlue: theme === 'light' ? 'text-blue-600' : 'text-blue-400',
  iconPurple: theme === 'light' ? 'text-purple-600' : 'text-purple-400',
  iconAmber: theme === 'light' ? 'text-amber-600' : 'text-amber-400',
  iconRed: theme === 'light' ? 'text-red-600' : 'text-red-400',
  
  // Shadow
  shadow: theme === 'light' ? 'shadow-md shadow-slate-200/50' : 'shadow-lg shadow-black/20',
  shadowSm: theme === 'light' ? 'shadow-sm shadow-slate-200/50' : 'shadow-md shadow-black/20',
  shadowButton: theme === 'light' ? 'shadow-lg shadow-blue-500/25' : 'shadow-lg shadow-emerald-600/25',
  
  // Focus rings
  focusRing: theme === 'light' ? 'focus:ring-2 focus:ring-[#1A73E8]/30' : 'focus:ring-2 focus:ring-indigo-500/30',
  
  // Button primary classes
  buttonPrimary: theme === 'light' 
    ? 'bg-[#1A73E8] hover:bg-[#1557B0] text-white disabled:bg-slate-300' 
    : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-700',
    
  // Tab button classes
  tabActive: theme === 'light' 
    ? 'bg-[#1A73E8] text-white shadow-lg' 
    : 'bg-blue-600 text-white shadow-lg',
  tabInactive: theme === 'light' 
    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
    : 'text-slate-400 hover:text-white hover:bg-slate-700',
  
  // Hover effects
  hover: theme === 'light' ? 'bg-slate-50' : 'bg-slate-700/50',
});

