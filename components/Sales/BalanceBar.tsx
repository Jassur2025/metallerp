import React from 'react';
import { Wallet, Building2, CreditCard, AlertCircle } from 'lucide-react';
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
}

export const BalanceBar: React.FC<BalanceBarProps> = ({ balances, orders, debugStats }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const isDark = theme !== 'light';
  
  // Debug: count orders by payment method and currency
  const cashOrdersUSD = orders?.filter(o => o.paymentMethod === 'cash' && o.paymentCurrency !== 'UZS').length || 0;
  const cashOrdersUZS = orders?.filter(o => o.paymentMethod === 'cash' && o.paymentCurrency === 'UZS').length || 0;
  const totalCashOrders = orders?.filter(o => o.paymentMethod === 'cash').length || 0;

  const balanceCards = [
    {
      label: 'Касса (USD)',
      value: `$${balances.balanceCashUSD.toLocaleString()}`,
      icon: <Wallet size={18} />,
      iconBg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50',
      iconColor: isDark ? 'text-emerald-400' : 'text-emerald-600',
      valueColor: isDark ? 'text-emerald-400' : 'text-emerald-600',
    },
    {
      label: 'Касса (UZS)',
      value: `${balances.balanceCashUZS.toLocaleString()} сўм`,
      icon: <Wallet size={18} />,
      iconBg: isDark ? 'bg-amber-500/15' : 'bg-amber-50',
      iconColor: isDark ? 'text-amber-400' : 'text-amber-600',
      valueColor: isDark ? 'text-amber-400' : 'text-amber-600',
    },
    {
      label: 'Р/С (UZS)',
      value: `${balances.balanceBankUZS.toLocaleString()} сўм`,
      icon: <Building2 size={18} />,
      iconBg: isDark ? 'bg-purple-500/15' : 'bg-purple-50',
      iconColor: isDark ? 'text-purple-400' : 'text-purple-600',
      valueColor: balances.balanceBankUZS < 0 ? 'text-red-400' : (isDark ? 'text-purple-400' : 'text-purple-600'),
    },
    {
      label: 'Карта (UZS)',
      value: `${balances.balanceCardUZS.toLocaleString()} сўм`,
      icon: <CreditCard size={18} />,
      iconBg: isDark ? 'bg-blue-500/15' : 'bg-blue-50',
      iconColor: isDark ? 'text-blue-400' : 'text-blue-600',
      valueColor: isDark ? 'text-blue-400' : 'text-blue-600',
    },
  ];

  return (
    <div className={`${isDark ? 'bg-slate-900/80 border-b border-slate-800' : 'bg-white border-b border-slate-200'} px-6 py-3`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {balanceCards.map((card, i) => (
          <div key={i} className={`${isDark ? 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800/80' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'} rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-colors`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg} ${card.iconColor}`}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider leading-tight`}>{card.label}</p>
              <p className={`text-sm font-bold font-mono ${card.valueColor} truncate leading-tight mt-0.5`}>
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};







