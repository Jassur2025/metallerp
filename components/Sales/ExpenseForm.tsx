import React from 'react';
import { FileText } from 'lucide-react';
import { ExpenseCategory } from '../../types';

interface ExpenseFormProps {
  expenseDesc: string;
  setExpenseDesc: (val: string) => void;
  expenseAmount: string;
  setExpenseAmount: (val: string) => void;
  expenseCategory: string;
  setExpenseCategory: (val: string) => void;
  expenseMethod: 'cash' | 'bank' | 'card';
  setExpenseMethod: (val: 'cash' | 'bank' | 'card') => void;
  expenseCurrency: 'USD' | 'UZS';
  setExpenseCurrency: (val: 'USD' | 'UZS') => void;
  withVat: boolean;
  setWithVat: (val: boolean) => void;
  expenseVatAmount: string;
  setExpenseVatAmount: (val: string) => void;
  onSubmit: () => void;
  expenseCategories?: ExpenseCategory[];
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  expenseDesc,
  setExpenseDesc,
  expenseAmount,
  setExpenseAmount,
  expenseCategory,
  setExpenseCategory,
  expenseMethod,
  setExpenseMethod,
  expenseCurrency,
  setExpenseCurrency,
  withVat,
  setWithVat,
  expenseVatAmount,
  setExpenseVatAmount,
  onSubmit,
  expenseCategories = []
}) => {
  // Group categories by PnL type
  const adminCategories = expenseCategories.filter(c => c.pnlCategory === 'administrative');
  const operationalCategories = expenseCategories.filter(c => c.pnlCategory === 'operational');
  const commercialCategories = expenseCategories.filter(c => c.pnlCategory === 'commercial');
  return (
    <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-6 overflow-y-auto">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <FileText className="text-red-500" /> Оформление Расхода
      </h3>
      <div className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Описание расхода</label>
          <input
            type="text"
            value={expenseDesc}
            onChange={e => setExpenseDesc(e.target.value)}
            placeholder="Например: Аренда офиса"
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Сумма</label>
            <input
              type="number"
              value={expenseAmount}
              onChange={e => setExpenseAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Валюта</label>
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-600">
              <button
                onClick={() => setExpenseCurrency('UZS')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${expenseCurrency === 'UZS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                UZS
              </button>
              <button
                onClick={() => setExpenseCurrency('USD')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${expenseCurrency === 'USD' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                USD
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Источник средств</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setExpenseMethod('cash')}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
            >
              Наличные
            </button>
            <button
              onClick={() => setExpenseMethod('bank')}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
            >
              Р/С (Банк)
            </button>
            <button
              onClick={() => setExpenseMethod('card')}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
            >
              Карта
            </button>
          </div>
        </div>

        {/* VAT Checkbox & Input (Only for Bank Transfer) */}
        {expenseMethod === 'bank' && (
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="withVat"
                checked={withVat}
                onChange={e => {
                  setWithVat(e.target.checked);
                  if (e.target.checked && expenseAmount) {
                    const amount = parseFloat(expenseAmount);
                    const vat = (amount * 12) / 112;
                    setExpenseVatAmount(vat.toFixed(2));
                  } else {
                    setExpenseVatAmount('');
                  }
                }}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="withVat" className="text-sm text-slate-300 select-none cursor-pointer">
                Учитывать НДС (12%)
              </label>
            </div>

            {withVat && (
              <div className="animate-fade-in">
                <label className="text-xs font-medium text-slate-400 mb-1 block">Сумма НДС ({expenseCurrency})</label>
                <input
                  type="number"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="0.00"
                  value={expenseVatAmount}
                  onChange={e => setExpenseVatAmount(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  * НДС уже включен в общую сумму расхода, здесь мы просто выделяем его для отчета.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Категория расхода</label>
          <select
            value={expenseCategory}
            onChange={e => setExpenseCategory(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none"
          >
            <option value="">— Выберите категорию —</option>
            {expenseCategories.length > 0 ? (
              <>
                {adminCategories.length > 0 && (
                  <optgroup label="📋 Административные">
                    {adminCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </optgroup>
                )}
                {operationalCategories.length > 0 && (
                  <optgroup label="⚙️ Операционные">
                    {operationalCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </optgroup>
                )}
                {commercialCategories.length > 0 && (
                  <optgroup label="💰 Коммерческие">
                    {commercialCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </optgroup>
                )}
              </>
            ) : (
              <>
                <option value="Прочее">Прочее</option>
                <option value="Аренда">Аренда</option>
                <option value="Зарплата">Зарплата</option>
                <option value="Транспорт">Транспорт</option>
                <option value="Налоги">Налоги</option>
                <option value="Маркетинг">Маркетинг</option>
              </>
            )}
          </select>
        </div>

        <button
          onClick={onSubmit}
          className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-600/20 transition-all mt-4"
        >
          Добавить Расход
        </button>
      </div>
    </div>
  );
};

