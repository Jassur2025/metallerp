import React from 'react';
import { Wallet, Building2, CreditCard, AlertCircle } from 'lucide-react';
import { Balances } from './types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface BalanceBarProps {
  balances: Balances;
  orders?: any[];
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
  
  // Debug: count orders by payment method and currency
  const cashOrdersUSD = orders?.filter(o => o.paymentMethod === 'cash' && o.paymentCurrency !== 'UZS').length || 0;
  const cashOrdersUZS = orders?.filter(o => o.paymentMethod === 'cash' && o.paymentCurrency === 'UZS').length || 0;
  const totalCashOrders = orders?.filter(o => o.paymentMethod === 'cash').length || 0;

  return (
    <div className={`${t.bgCard} border-b ${t.border} p-4 space-y-3`}>
      {/* Debug Panel */}
      {/* Debug Panel Removed */}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${t.bgPanelAlt} p-3 rounded-xl border ${t.border} flex items-center gap-3`}>
          <div className={`p-2 ${t.iconBgEmerald} rounded-lg ${t.iconEmerald}`}>
            <Wallet size={20} />
          </div>
          <div>
            <p className={`text-xs ${t.textMuted} uppercase`}>Касса (USD)</p>
            <p className={`text-lg font-mono font-bold ${t.text}`}>
              ${balances.balanceCashUSD.toLocaleString()}
            </p>

          </div>
        </div>

        <div className={`${t.bgPanelAlt} p-3 rounded-xl border ${t.border} flex items-center gap-3`}>
          <div className={`p-2 ${t.iconBgEmerald} rounded-lg ${t.iconEmerald}`}>
            <Wallet size={20} />
          </div>
          <div>
            <p className={`text-xs ${t.textMuted} uppercase`}>Касса (UZS)</p>
            <p className={`text-lg font-mono font-bold ${t.text}`}>
              {balances.balanceCashUZS.toLocaleString()} сўм
            </p>
          </div>
        </div>

        <div className={`${t.bgPanelAlt} p-3 rounded-xl border ${t.border} flex items-center gap-3`}>
          <div className={`p-2 ${t.iconBgPurple} rounded-lg ${t.iconPurple}`}>
            <Building2 size={20} />
          </div>
          <div>
            <p className={`text-xs ${t.textMuted} uppercase`}>Р/С (UZS)</p>
            <p className={`text-lg font-mono font-bold ${t.text}`}>
              {balances.balanceBankUZS.toLocaleString()} сўм
            </p>
          </div>
        </div>

        <div className={`${t.bgPanelAlt} p-3 rounded-xl border ${t.border} flex items-center gap-3`}>
          <div className={`p-2 ${t.iconBgBlue} rounded-lg ${t.iconBlue}`}>
            <CreditCard size={20} />
          </div>
          <div>
            <p className={`text-xs ${t.textMuted} uppercase`}>Карта (UZS)</p>
            <p className={`text-lg font-mono font-bold ${t.text}`}>
              {balances.balanceCardUZS.toLocaleString()} сўм
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};







