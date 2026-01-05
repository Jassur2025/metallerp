import React, { useState, useMemo } from 'react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Employee, Order, Expense } from '../types';
import { DollarSign, Calendar, Download, Search, User, TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react';
import { formatCurrency } from '../utils/finance';

interface PayrollProps {
  employees: Employee[];
  orders: Order[];
  expenses: Expense[];
}

export const Payroll: React.FC<PayrollProps> = ({ employees, orders, expenses }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const payrollData = useMemo(() => {
    if (!employees || !orders || !expenses) return [];

    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
    const daysInMonth = endOfMonth.getDate();

    return employees
      .filter(emp => emp && (emp.status === 'active' || (emp.terminationDate && new Date(emp.terminationDate) >= startOfMonth)))
      .map(employee => {
        try {
          // 0. Calculate Prorated Salary
          let baseSalary = employee.salary || 0;
          let isProrated = false;
          let daysWorked = daysInMonth;

          const hireDate = new Date(employee.hireDate);
          const terminationDate = employee.terminationDate ? new Date(employee.terminationDate) : null;

          // If hired this month
          if (hireDate > startOfMonth && hireDate <= endOfMonth) {
            daysWorked -= (hireDate.getDate() - 1);
            isProrated = true;
          }

          // If fired this month
          if (terminationDate && terminationDate >= startOfMonth && terminationDate <= endOfMonth) {
            daysWorked -= (daysInMonth - terminationDate.getDate());
            isProrated = true;
          }

          // If hired after month end or fired before month start (should be filtered out, but safety check)
          if (hireDate > endOfMonth || (terminationDate && terminationDate < startOfMonth)) {
            daysWorked = 0;
            isProrated = true;
          }

          if (isProrated) {
            baseSalary = (baseSalary / daysInMonth) * Math.max(0, daysWorked);
          }

          // 1. Calculate Sales & Profit for this employee
          const employeeOrders = orders.filter(order => {
            if (!order || !order.date) return false;
            const orderDate = new Date(order.date);
            return (
              orderDate >= startOfMonth &&
              orderDate <= endOfMonth &&
              order.status === 'completed' &&
              order.sellerName === employee.name // Linking by name for now
            );
          });

          const salesTotal = employeeOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
          
          // Calculate Profit: (Price - Cost) * Quantity
          const profitTotal = employeeOrders.reduce((sum, order) => {
            if (!order.items || !Array.isArray(order.items)) return sum;
            const orderProfit = order.items.reduce((itemSum, item) => {
              const cost = item.costAtSale || 0;
              const price = item.priceAtSale || 0;
              return itemSum + ((price - cost) * (item.quantity || 0));
            }, 0);
            return sum + orderProfit;
          }, 0);

          // 2. Calculate KPI Bonus
          const kpiBonus = employee.hasKPI && employee.commissionRate 
            ? (profitTotal * (employee.commissionRate / 100)) 
            : 0;

          // 3. Calculate Advances (Expenses)
          const employeeAdvances = expenses.filter(expense => {
            if (!expense || !expense.date) return false;
            const expenseDate = new Date(expense.date);
            const isThisMonth = expenseDate >= startOfMonth && expenseDate <= endOfMonth;
            
            if (!isThisMonth) return false;

            // Check by ID if available
            if (expense.employeeId === employee.id) return true;

            // Fallback: Check description
            const desc = (expense.description || '').toLowerCase();
            const empName = (employee.name || '').toLowerCase();
            if (!desc || !empName) return false;

            const nameParts = empName.split(' ').filter(p => p.length > 2);
            const hasName = nameParts.length > 0 && nameParts.some(part => desc.includes(part));
            const isSalaryRelated = desc.includes('аванс') || desc.includes('зарплата') || desc.includes('salary') || desc.includes('advance');
            
            return hasName && isSalaryRelated;
          });

          const advancesTotal = employeeAdvances.reduce((sum, exp) => sum + (exp.amount || 0), 0);

          // 4. Base Salary (Already calculated above)
          
          // 5. Total Payable
          const totalPayable = baseSalary + kpiBonus - advancesTotal;

          return {
            employee,
            salesTotal,
            profitTotal,
            kpiBonus,
            advancesTotal,
            baseSalary,
            totalPayable,
            ordersCount: employeeOrders.length,
            isProrated,
            daysWorked
          };
        } catch (err) {
          console.error('Error calculating payroll for employee:', employee.name, err);
          return null;
        }
      })
      .filter((data): data is NonNullable<typeof data> => 
        data !== null && (
          data.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          data.employee.role.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
  }, [employees, orders, expenses, selectedDate, searchTerm]);

  const totals = useMemo(() => {
    return payrollData.reduce((acc, curr) => ({
      salary: acc.salary + curr.baseSalary,
      kpi: acc.kpi + curr.kpiBonus,
      advances: acc.advances + curr.advancesTotal,
      payable: acc.payable + curr.totalPayable
    }), { salary: 0, kpi: 0, advances: 0, payable: 0 });
  }, [payrollData]);

  const handleMonthChange = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  const selectedEmployeeData = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return payrollData.find(p => p.employee.id === selectedEmployeeId);
  }, [selectedEmployeeId, payrollData]);

  const selectedEmployeeAdvances = useMemo(() => {
    if (!selectedEmployeeId) return [];
    
    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (!employee) return [];

    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

    return expenses.filter(expense => {
        if (!expense || !expense.date) return false;
        const expenseDate = new Date(expense.date);
        const isThisMonth = expenseDate >= startOfMonth && expenseDate <= endOfMonth;
        
        if (!isThisMonth) return false;

        if (expense.employeeId === employee.id) return true;

        // Fallback logic same as main loop
        const desc = (expense.description || '').toLowerCase();
        const empName = (employee.name || '').toLowerCase();
        if (!desc || !empName) return false;

        const nameParts = empName.split(' ').filter(p => p.length > 2);
        const hasName = nameParts.length > 0 && nameParts.some(part => desc.includes(part));
        const isSalaryRelated = desc.includes('аванс') || desc.includes('зарплата') || desc.includes('salary') || desc.includes('advance');
        
        return hasName && isSalaryRelated;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedEmployeeId, expenses, selectedDate, employees]);

  return (
    <div className={`p-6 ${t.bg} min-h-screen animate-fade-in`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${t.text} mb-2`}>Расчет зарплаты</h1>
          <p className={t.textMuted}>Управление выплатами, KPI и авансами</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center ${t.bgCard} rounded-lg border ${t.border} p-1`}>
            <button 
              onClick={() => handleMonthChange(-1)}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ${t.text}`}
            >
              ←
            </button>
            <div className={`px-4 font-medium ${t.text} min-w-[140px] text-center`}>
              {selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </div>
            <button 
              onClick={() => handleMonthChange(1)}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ${t.text}`}
            >
              →
            </button>
          </div>
          
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
            <Download size={18} />
            Экспорт
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-sm`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-blue-500/10 text-blue-500`}>
              <User size={24} />
            </div>
          </div>
          <div className={t.textMuted}>Базовый ФОТ</div>
          <div className={`text-2xl font-bold ${t.text} mt-1`}>
            {formatCurrency(totals.salary)}
          </div>
        </div>

        <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-sm`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-purple-500/10 text-purple-500`}>
              <TrendingUp size={24} />
            </div>
          </div>
          <div className={t.textMuted}>Бонусы (KPI)</div>
          <div className={`text-2xl font-bold ${t.text} mt-1`}>
            {formatCurrency(totals.kpi)}
          </div>
        </div>

        <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-sm`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-amber-500/10 text-amber-500`}>
              <ArrowDownCircle size={24} />
            </div>
          </div>
          <div className={t.textMuted}>Выдано авансов</div>
          <div className={`text-2xl font-bold ${t.text} mt-1`}>
            {formatCurrency(totals.advances)}
          </div>
        </div>

        <div className={`${t.bgCard} p-6 rounded-2xl border ${t.border} shadow-sm`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-emerald-500/10 text-emerald-500`}>
              <Wallet size={24} />
            </div>
          </div>
          <div className={t.textMuted}>К выплате</div>
          <div className={`text-2xl font-bold ${t.text} mt-1`}>
            {formatCurrency(totals.payable)}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className={`${t.bgCard} rounded-2xl border ${t.border} shadow-sm overflow-hidden`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className={`text-lg font-bold ${t.text}`}>Ведомость зарплаты</h2>
          <div className="relative w-64">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
            <input
              type="text"
              placeholder="Поиск сотрудника..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${t.border} ${t.bg} ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${t.bgPanelAlt} ${t.textMuted} text-xs uppercase font-medium`}>
              <tr>
                <th className="px-6 py-4 text-left">Сотрудник</th>
                <th className="px-6 py-4 text-right">Оклад</th>
                <th className="px-6 py-4 text-right">Продажи / Прибыль</th>
                <th className="px-6 py-4 text-right">KPI</th>
                <th className="px-6 py-4 text-right">Авансы</th>
                <th className="px-6 py-4 text-right">Итого к выплате</th>
                <th className="px-6 py-4 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divide}`}>
              {payrollData.map((row) => (
                <tr key={row.employee.id} className={`${t.bgCardHover} transition-colors`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        row.employee.role === 'sales' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {row.employee.name.charAt(0)}
                      </div>
                      <div>
                        <div className={`font-medium ${t.text}`}>{row.employee.name}</div>
                        <div className={`text-xs ${t.textMuted}`}>{row.employee.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${t.text}`}>
                    {formatCurrency(row.baseSalary)}
                    {row.isProrated && (
                      <div className="text-[10px] text-amber-500" title={`Отработано дней: ${row.daysWorked}`}>
                        (за {row.daysWorked} дн.)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.employee.hasKPI ? (
                      <div>
                        <div className={`text-sm font-medium ${t.text}`}>{formatCurrency(row.profitTotal)}</div>
                        <div className={`text-xs ${t.textMuted}`}>Продажи: {formatCurrency(row.salesTotal)}</div>
                      </div>
                    ) : (
                      <span className={t.textMuted}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.employee.hasKPI ? (
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-500 font-medium">+{formatCurrency(row.kpiBonus)}</span>
                        <span className={`text-xs ${t.textMuted}`}>{row.employee.commissionRate}% от прибыли</span>
                      </div>
                    ) : (
                      <span className={t.textMuted}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-amber-500 font-medium">-{formatCurrency(row.advancesTotal)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-lg ${row.totalPayable > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatCurrency(row.totalPayable)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setSelectedEmployeeId(row.employee.id)}
                      className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg ${t.textMuted} hover:text-purple-500 transition-colors`}
                    >
                      <Wallet size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal */}
      {selectedEmployeeId && selectedEmployeeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`${t.bgCard} w-full max-w-3xl rounded-2xl shadow-2xl border ${t.border} flex flex-col max-h-[90vh]`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className={`text-xl font-bold ${t.text}`}>{selectedEmployeeData.employee.name}</h2>
                <p className={t.textMuted}>{selectedEmployeeData.employee.position}</p>
              </div>
              <button 
                onClick={() => setSelectedEmployeeId(null)}
                className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full ${t.textMuted} transition-colors`}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
               {/* Summary for the month */}
               <div className="grid grid-cols-3 gap-4 mb-6">
                 <div className={`p-4 rounded-xl ${t.bgPanel} border ${t.border}`}>
                   <div className={`text-xs ${t.textMuted} uppercase`}>Начислено (Оклад + KPI)</div>
                   <div className={`text-lg font-bold text-emerald-500`}>
                     {formatCurrency(selectedEmployeeData.baseSalary + selectedEmployeeData.kpiBonus)}
                   </div>
                 </div>
                 <div className={`p-4 rounded-xl ${t.bgPanel} border ${t.border}`}>
                   <div className={`text-xs ${t.textMuted} uppercase`}>Выплачено (Авансы)</div>
                   <div className={`text-lg font-bold text-amber-500`}>
                     {formatCurrency(selectedEmployeeData.advancesTotal)}
                   </div>
                 </div>
                 <div className={`p-4 rounded-xl ${t.bgPanel} border ${t.border}`}>
                   <div className={`text-xs ${t.textMuted} uppercase`}>Остаток к выплате</div>
                   <div className={`text-lg font-bold ${selectedEmployeeData.totalPayable >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                     {formatCurrency(selectedEmployeeData.totalPayable)}
                   </div>
                 </div>
               </div>

               <h3 className={`font-bold ${t.text} mb-4`}>История выплат и авансов</h3>
               
               {selectedEmployeeAdvances.length > 0 ? (
                 <table className="w-full text-sm">
                   <thead className={`${t.bgPanelAlt} ${t.textMuted} text-xs uppercase`}>
                     <tr>
                       <th className="px-4 py-3 text-left">Дата</th>
                       <th className="px-4 py-3 text-left">Описание</th>
                       <th className="px-4 py-3 text-left">Метод</th>
                       <th className="px-4 py-3 text-right">Курс</th>
                       <th className="px-4 py-3 text-right">Сумма</th>
                     </tr>
                   </thead>
                   <tbody className={`divide-y ${t.divide}`}>
                     {selectedEmployeeAdvances.map(exp => (
                       <tr key={exp.id}>
                         <td className={`px-4 py-3 ${t.text}`}>{new Date(exp.date).toLocaleDateString()}</td>
                         <td className={`px-4 py-3 ${t.text}`}>{exp.description}</td>
                         <td className={`px-4 py-3 ${t.text}`}>
                           <span className={`px-2 py-1 rounded text-xs font-medium ${
                             exp.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                             exp.paymentMethod === 'bank' ? 'bg-purple-100 text-purple-700' :
                             'bg-blue-100 text-blue-700'
                           }`}>
                             {exp.paymentMethod === 'cash' ? 'Наличные' : exp.paymentMethod === 'bank' ? 'Перечисление' : 'Карта'}
                           </span>
                         </td>
                         <td className={`px-4 py-3 text-right ${t.textMuted}`}>
                           {exp.exchangeRate ? exp.exchangeRate.toLocaleString() : '-'}
                         </td>
                         <td className={`px-4 py-3 text-right font-bold text-amber-500`}>
                           {formatCurrency(exp.amount)}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               ) : (
                 <div className={`text-center py-8 ${t.textMuted}`}>
                   В этом месяце выплат не было
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
