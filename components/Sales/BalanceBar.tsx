import React from 'react';
import { Wallet, Building2, CreditCard } from 'lucide-react';
import { Balances } from './types';

interface BalanceBarProps {
  balances: Balances;
}

export const BalanceBar: React.FC<BalanceBarProps> = ({ balances }) => {
  return (
    <div className="bg-slate-800 border-b border-slate-700 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
          <Wallet size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase">Касса (USD)</p>
          <p className="text-lg font-mono font-bold text-white">
            ${balances.balanceCashUSD.toLocaleString()}
          </p>
        </div>
      </div>
      
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
          <Wallet size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase">Касса (UZS)</p>
          <p className="text-lg font-mono font-bold text-white">
            {balances.balanceCashUZS.toLocaleString()} сўм
          </p>
        </div>
      </div>
      
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
          <Building2 size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase">Р/С (UZS)</p>
          <p className="text-lg font-mono font-bold text-white">
            {balances.balanceBankUZS.toLocaleString()} сўм
          </p>
        </div>
      </div>
      
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
          <CreditCard size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase">Карта (UZS)</p>
          <p className="text-lg font-mono font-bold text-white">
            {balances.balanceCardUZS.toLocaleString()} сўм
          </p>
        </div>
      </div>
    </div>
  );
};


