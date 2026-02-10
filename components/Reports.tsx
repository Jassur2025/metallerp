
import React, { useState } from 'react';
import { Order, Expense, Product, Purchase, AppSettings, Transaction, FixedAsset } from '../types';
import { telegramService } from '../services/telegramService';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { VatReport } from './VatReport';
import { CashFlow } from './CashFlow';
import { PnL } from './PnL';
import { SalesAnalytics } from './SalesAnalytics';
import { SalesStatistics } from './SalesStatistics';
import { ArrowRightLeft, TrendingUp, FileText, PieChart, Table, Scale } from 'lucide-react';

const isDev = import.meta.env.DEV;
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface ReportsProps {
  orders: Order[];
  expenses: Expense[];
  products: Product[];
  purchases: Purchase[];
  settings: AppSettings;
  transactions: Transaction[];
  fixedAssets?: FixedAsset[];
  onAddExpense: (expense: Expense) => void;
}

type ReportType = 'pnl' | 'cashflow' | 'sales' | 'statistics' | 'vat';

export const Reports: React.FC<ReportsProps> = ({ orders, expenses, products, purchases, settings, transactions, fixedAssets = [], onAddExpense }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [activeTab, setActiveTab] = useState<ReportType>('pnl');
  const toast = useToast();
  const [isSending, setIsSending] = useState(false);

  const handleSendTelegramReport = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      toast.error('Telegram не настроен. Перейдите в настройки.');
      return;
    }

    setIsSending(true);
    try {
      const today = new Date();
      const isToday = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear();
      };

      // 1. Revenue (Today)
      const todayOrders = orders.filter(o => isToday(o.date));
      const revenue = todayOrders.reduce((sum, o) => sum + o.subtotalAmount, 0);

      // 2. COGS (Today)
      const cogs = todayOrders.reduce((sumOrder, order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        return sumOrder + items.reduce((sumItem, item) => sumItem + (item.quantity * (item.costAtSale || 0)), 0);
      }, 0);

      // 3. Expenses (Today)
      const todayExpenses = expenses.filter(e => isToday(e.date));
      const expensesSum = todayExpenses.reduce((sum, e) => {
        const rate = e.exchangeRate || settings.defaultExchangeRate || 1;
        const amountUSD = (e.currency === 'UZS') ? (e.amount || 0) / rate : (e.amount || 0);
        return sum + amountUSD;
      }, 0);

      // 4. Net Profit
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expensesSum;

      // 5. Balances (Total)

      // Helper to ensure number
      const val = (n: number | undefined | null) => n || 0;
      // Safe access to settings
      const defaultRate = settings?.defaultExchangeRate || 1;
      const getRate = (rate: number | undefined | null) => (rate && rate > 0) ? rate : defaultRate;

      // 1. Cash USD
      const cashInUSD = orders
        .filter(o => o.paymentMethod === 'cash' && (o.paymentCurrency === 'USD' || !o.paymentCurrency))
        .reduce((sum, o) => sum + val(o.amountPaid), 0);

      const cashOutExpensesUSD = expenses
        .filter(e => e.paymentMethod === 'cash' && e.currency === 'USD')
        .reduce((sum, e) => sum + val(e.amount), 0);
      const cashOutSuppliersUSD = transactions
        .filter(t => t.type === 'supplier_payment' && t.method === 'cash' && t.currency === 'USD')
        .reduce((sum, t) => sum + val(t.amount), 0);
      const cashBalanceUSD = cashInUSD - cashOutExpensesUSD - cashOutSuppliersUSD;

      // 2. Cash UZS
      const cashInUZS = orders
        .filter(o => o.paymentMethod === 'cash' && o.paymentCurrency === 'UZS')
        .reduce((sum, o) => sum + val(o.totalAmountUZS), 0);

      const cashOutExpensesUZS = expenses
        .filter(e => e.paymentMethod === 'cash' && e.currency === 'UZS')
        .reduce((sum, e) => {
          const rate = getRate(e.exchangeRate);
          return sum + (e.exchangeRate ? val(e.amount) : (val(e.amount) * rate));
        }, 0);
      const cashOutSuppliersUZS = transactions
        .filter(t => t.type === 'supplier_payment' && t.method === 'cash' && t.currency === 'UZS')
        .reduce((sum, t) => sum + val(t.amount), 0);
      const cashBalanceUZS = cashInUZS - cashOutExpensesUZS - cashOutSuppliersUZS;

      // 3. Bank UZS
      const bankInUZS = orders
        .filter(o => o.paymentMethod === 'bank')
        .reduce((sum, o) => sum + val(o.totalAmountUZS), 0);

      const bankOutExpensesUZS = expenses
        .filter(e => e.paymentMethod === 'bank')
        .reduce((sum, e) => {
          const rate = getRate(e.exchangeRate);
          if (e.currency === 'UZS') {
            return sum + (e.exchangeRate ? val(e.amount) : (val(e.amount) * rate));
          } else {
            return sum + (val(e.amount) * rate);
          }
        }, 0);
      const bankOutSuppliersUZS = transactions
        .filter(t => t.type === 'supplier_payment' && t.method === 'bank')
        .reduce((sum, t) => {
          const rate = getRate(t.exchangeRate);
          const amountUZS = t.currency === 'UZS' ? val(t.amount) : (val(t.amount) * rate);
          return sum + amountUZS;
        }, 0);
      const bankBalanceUZS = bankInUZS - bankOutExpensesUZS - bankOutSuppliersUZS;

      // 4. Card UZS
      const cardInUZS = orders
        .filter(o => o.paymentMethod === 'card')
        .reduce((sum, o) => sum + val(o.totalAmountUZS), 0);

      const cardOutExpensesUZS = expenses
        .filter(e => e.paymentMethod === 'card')
        .reduce((sum, e) => {
          const rate = getRate(e.exchangeRate);
          if (e.currency === 'UZS') {
            return sum + (e.exchangeRate ? val(e.amount) : (val(e.amount) * rate));
          } else {
            return sum + (val(e.amount) * rate);
          }
        }, 0);
      const cardOutSuppliersUZS = transactions.filter(t => t.type === 'supplier_payment' && t.method === 'card' && t.currency === 'UZS').reduce((sum, t) => sum + (t.amount || 0), 0); // Suppliers usually don't accept card, but keep for safety
      const cardBalanceUZS = cardInUZS - cardOutExpensesUZS - cardOutSuppliersUZS;

      await telegramService.sendDailyReport(
        settings.telegramBotToken,
        settings.telegramChatId,
        {
          date: today.toLocaleDateString(),
          revenue,
          grossProfit,
          expenses: expensesSum,
          netProfit,
          cashBalanceUSD,
          cashBalanceUZS,
          bankBalanceUZS,
          cardBalanceUZS
        }
      );

      toast.success('Отчет отправлен в Telegram!');
    } catch (e: unknown) {
      errorDev(e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Ошибка отправки: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${t.bgMain} ${t.text}`}>
      {/* Reports Header / Tab Switcher */}
      <div className={`p-6 border-b ${t.border} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden`}>
        <div>
          <h2 className={`text-2xl font-bold ${t.text} flex items-center gap-2`}>
            <FileText className="text-primary-500" /> Финансовые Отчеты
          </h2>
          <p className={`${t.textMuted} text-sm mt-1`}>Аналитика, доходы и расходы</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pnl'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <TrendingUp size={16} /> P&L
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'cashflow'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <ArrowRightLeft size={16} /> Cash Flow
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'sales'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <PieChart size={16} /> Продажи
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'statistics'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <Table size={16} /> Статистика
          </button>
          <button
            onClick={() => setActiveTab('vat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'vat'
              ? 'bg-primary-600 text-white shadow-lg'
              : `${t.textMuted} hover:${t.text} hover:${t.bgCardHover}`
              }`}
          >
            <Scale size={16} /> НДС
          </button>

          <div className={`w-px h-8 ${t.border} mx-2`}></div>

          <button
            onClick={handleSendTelegramReport}
            disabled={isSending}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Отправить отчет за сегодня в Telegram"
          >
            <span>Telegram</span>
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className={`flex-1 overflow-auto ${t.bgMain} custom-scrollbar`}>
        {activeTab === 'pnl' && <PnL orders={orders} expenses={expenses} fixedAssets={fixedAssets} expenseCategories={settings.expenseCategories} defaultExchangeRate={settings.defaultExchangeRate} />}
        {activeTab === 'cashflow' && <CashFlow orders={orders} expenses={expenses} settings={settings} onAddExpense={onAddExpense} transactions={transactions} />}
        {activeTab === 'sales' && <SalesAnalytics orders={orders} settings={settings} />}
        {activeTab === 'statistics' && <SalesStatistics orders={orders} products={products} transactions={transactions} />}
        {activeTab === 'vat' && <VatReport purchases={purchases} orders={orders} expenses={expenses} settings={settings} />}
      </div>
    </div>
  );
};
