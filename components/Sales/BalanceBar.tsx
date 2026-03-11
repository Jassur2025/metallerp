import React from 'react';
import { Wallet, Building2, CreditCard, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Balances } from './types';
import { Order } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface BalanceBarProps {
  balances: Balances;
  orders?: Order[];
  debugStats?: {
    salesUSD: number;
    trxInUSD: number;
    trxOutUSD: number;
    expUSD: number;
  };
  isVisible?: boolean;
  onToggle?: () => void;
}

export const BalanceBar: React.FC<BalanceBarProps> = ({ balances, orders, debugStats, isVisible = true, onToggle }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';

  const balanceCards = [
    {
      label: 'Касса (USD)',
      value: `$${balances.balanceCashUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
      icon: <Wallet size={16} />,
      iconBg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50',
      iconColor: isDark ? 'text-emerald-400' : 'text-emerald-600',
      valueColor: isDark ? 'text-emerald-400' : 'text-emerald-600',
      trend: balances.balanceCashUSD >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Касса (сўм)',
      value: `${balances.balanceCashUZS.toLocaleString('ru-RU')}`,
      sub: 'сўм',
      icon: <Wallet size={16} />,
      iconBg: isDark ? 'bg-amber-500/15' : 'bg-amber-50',
      iconColor: isDark ? 'text-amber-400' : 'text-amber-600',
      valueColor: isDark ? 'text-amber-400' : 'text-amber-600',
    },
    {
      label: 'Р/С банк',
      value: `${balances.balanceBankUZS.toLocaleString('ru-RU')}`,
      sub: 'сўм',
      icon: <Building2 size={16} />,
      iconBg: isDark ? 'bg-violet-500/15' : 'bg-violet-50',
      iconColor: isDark ? 'text-violet-400' : 'text-violet-600',
      valueColor: balances.balanceBankUZS < 0 ? 'text-red-400' : (isDark ? 'text-violet-400' : 'text-violet-600'),
    },
    {
      label: 'Карта',
      value: `${balances.balanceCardUZS.toLocaleString('ru-RU')}`,
      sub: 'сўм',
      icon: <CreditCard size={16} />,
      iconBg: isDark ? 'bg-blue-500/15' : 'bg-blue-50',
      iconColor: isDark ? 'text-blue-400' : 'text-blue-600',
      valueColor: isDark ? 'text-blue-400' : 'text-blue-600',
    },
  ];

  return (
    <div>
      {/* Toggle header row */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2 transition-colors
          ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-2">
          {isVisible ? <EyeOff size={13} className={t.textMuted} /> : <Eye size={13} className={t.textMuted} />}
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${t.textMuted}`}>
            Касса и балансы
          </span>
          {!isVisible && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className={`text-xs font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                ${balances.balanceCashUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
              </span>
              <span className={`text-[10px] ${t.textMuted}`}>·</span>
              <span className={`text-xs font-mono font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {balances.balanceCashUZS.toLocaleString('ru-RU')} сўм
              </span>
            </div>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`${t.textMuted} transition-transform duration-200 ${isVisible ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Cards */}
      {isVisible && (
        <div className={`px-4 pb-3 pt-1`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {balanceCards.map((card, i) => (
              <div
                key={i}
                className={`${isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/60'
                  : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                } rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition-all cursor-default`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg} ${card.iconColor}`}>
                  {card.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-semibold ${t.textMuted} leading-tight mb-0.5`}>{card.label}</p>
                  <p className={`text-sm font-extrabold font-mono ${card.valueColor} leading-tight`}>
                    {card.value}
                    {card.sub && <span className={`text-[10px] font-semibold ml-0.5 opacity-70`}> {card.sub}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};







