import React from 'react';
import { ArrowDownCircle } from 'lucide-react';
import { ExpenseCategory, Employee } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

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
  isSubmitting?: boolean;
  expenseCategories?: ExpenseCategory[];
  employees?: Employee[];
  selectedEmployeeId?: string;
  setSelectedEmployeeId?: (val: string) => void;
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
  isSubmitting = false,
  expenseCategories = [],
  employees = [],
  selectedEmployeeId,
  setSelectedEmployeeId
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  // Group categories by PnL type
  const adminCategories = expenseCategories.filter(c => c.pnlCategory === 'administrative');
  const operationalCategories = expenseCategories.filter(c => c.pnlCategory === 'operational');
  const commercialCategories = expenseCategories.filter(c => c.pnlCategory === 'commercial');

  // Check if selected category is salary related
  const isSalaryCategory = expenseCategory === 'Зарплата' || expenseCategory === 'Аванс сотрудникам' || expenseCategory.toLowerCase().includes('зарплата') || expenseCategory.toLowerCase().includes('аванс');

  const isDark = theme !== 'light';

  return (
    <div className={`flex-1 ${t.bgCard} border ${t.border} rounded-2xl overflow-y-auto`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center gap-3`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/15' : 'bg-red-50'}`}>
          <ArrowDownCircle size={20} className="text-red-500" />
        </div>
        <div>
          <h3 className={`text-base font-bold ${t.text}`}>Оформление расхода</h3>
          <p className={`text-xs ${t.textMuted}`}>Укажите сумму, источник и категорию</p>
        </div>
      </div>
      <div className="p-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-2xl">
        <div>
          <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Описание расхода</label>
          <input
            type="text"
            value={expenseDesc}
            onChange={e => setExpenseDesc(e.target.value)}
            placeholder="Например: Аренда офиса"
            className={`w-full ${t.bgInput} border ${t.borderInput} rounded-xl px-4 py-3 ${t.text} focus:border-red-500 outline-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Сумма</label>
            <input
              type="number"
              value={expenseAmount}
              onChange={e => setExpenseAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full ${t.bgInput} border ${t.borderInput} rounded-xl px-4 py-3 ${t.text} focus:border-red-500 outline-none`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Валюта</label>
            <div className={`flex ${t.bgInput} rounded-xl p-1 border ${t.borderInput}`}>
              <button
                onClick={() => setExpenseCurrency('UZS')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${expenseCurrency === 'UZS' ? (theme === 'light' ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white') : `${t.textMuted} hover:${t.text}`}`}
              >
                UZS
              </button>
              <button
                onClick={() => setExpenseCurrency('USD')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${expenseCurrency === 'USD' ? (theme === 'light' ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white') : `${t.textMuted} hover:${t.text}`}`}
              >
                USD
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Источник средств</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setExpenseMethod('cash')}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
            >
              Наличные
            </button>
            <button
              onClick={() => setExpenseMethod('bank')}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
            >
              Р/С (Банк)
            </button>
            <button
              onClick={() => setExpenseMethod('card')}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${expenseMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : `${t.bgInput} ${t.borderInput} ${t.textMuted}`}`}
            >
              Карта
            </button>
          </div>
        </div>

        {/* VAT Checkbox & Input (Only for Bank Transfer) */}
        {expenseMethod === 'bank' && (
          <div className={`${t.bgPanelAlt} p-3 rounded-lg border ${t.border} space-y-3 animate-fade-in`}>
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
                className={`w-4 h-4 rounded ${t.borderInput} ${t.bgInput} text-primary-600 focus:ring-primary-500`}
              />
              <label htmlFor="withVat" className={`text-sm ${t.textSecondary} select-none cursor-pointer`}>
                Учитывать НДС (12%)
              </label>
            </div>

            {withVat && (
              <div className="animate-fade-in">
                <label className={`text-xs font-medium ${t.textMuted} mb-1 block`}>Сумма НДС ({expenseCurrency})</label>
                <input
                  type="number"
                  className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                  placeholder="0.00"
                  value={expenseVatAmount}
                  onChange={e => setExpenseVatAmount(e.target.value)}
                />
                <p className={`text-[10px] ${t.textMuted} mt-1`}>
                  * НДС уже включен в общую сумму расхода, здесь мы просто выделяем его для отчета.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Категория расхода</label>
          <select
            value={expenseCategory}
            onChange={e => setExpenseCategory(e.target.value)}
            className={`w-full ${t.bgInput} border ${t.borderInput} rounded-xl px-4 py-3 ${t.text} focus:border-red-500 outline-none`}
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

        {isSalaryCategory && employees.length > 0 && setSelectedEmployeeId && (
          <div className="animate-fade-in">
            <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Сотрудник</label>
            <select
              value={selectedEmployeeId || ''}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              className={`w-full ${t.bgInput} border ${t.borderInput} rounded-xl px-4 py-3 ${t.text} focus:border-red-500 outline-none`}
            >
              <option value="">— Выберите сотрудника —</option>
              {employees.filter(e => e.status === 'active').map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={isSubmitting || !expenseAmount || !expenseCategory}
          className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 lg:col-span-2
            ${isSubmitting || !expenseAmount || !expenseCategory
              ? `${isDark ? 'bg-slate-800 border border-slate-700 text-slate-500' : 'bg-slate-100 border border-slate-200 text-slate-400'} cursor-not-allowed shadow-none`
              : 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-red-600/20'
            }`}
        >
          <ArrowDownCircle size={17} />
          {isSubmitting ? 'Сохранение...' : 'Записать расход'}
        </button>
      </div>
      </div>
    </div>
  );
};

