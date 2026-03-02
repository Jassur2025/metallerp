/**
 * TrialBalance — Пробный баланс (оборотно-сальдовая ведомость)
 *
 * Shows debit/credit totals per account and validates the fundamental
 * accounting equation: Σ debits === Σ credits.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { ledgerService } from '../services/ledgerService';
import {
  TrialBalance as TrialBalanceType,
  TrialBalanceRow,
  ACCOUNT_NAMES,
  ACCOUNT_TYPES,
  AccountType,
} from '../types/accounting';
import { Scale, AlertTriangle, CheckCircle, RefreshCw, Calendar } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Активы',
  contra_asset: 'Контр-активы',
  liability: 'Пассивы',
  equity: 'Капитал',
  revenue: 'Доходы',
  expense: 'Расходы',
};

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'asset',
  'contra_asset',
  'liability',
  'equity',
  'revenue',
  'expense',
];

// ─── Period selector helper ────────────────────────────────────

function generatePeriodOptions(): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${y}-${m}`);
  }
  return options;
}

function periodLabel(periodId: string): string {
  const [y, m] = periodId.split('-');
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

// ─── Component ─────────────────────────────────────────────────

export const TrialBalance: React.FC = React.memo(() => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  const [period, setPeriod] = useState<string>('');   // '' = all time
  const [data, setData] = useState<TrialBalanceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  // ── Fetch trial balance ─────────────────────────────────────
  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const tb = await ledgerService.getTrialBalance(period || undefined);
      setData(tb);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки баланса');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [period]);

  // ── Group rows by account type ─────────────────────────────
  const groupedRows = useMemo(() => {
    if (!data) return {};
    const groups: Partial<Record<AccountType, TrialBalanceRow[]>> = {};
    for (const row of data.rows) {
      const type = ACCOUNT_TYPES[row.accountCode];
      if (!groups[type]) groups[type] = [];
      groups[type]!.push(row);
    }
    return groups;
  }, [data]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <Scale size={22} className="text-blue-500" />
            Оборотно-сальдовая ведомость (Trial Balance)
          </h3>
          <p className={`${t.textMuted} text-sm mt-1`}>
            Сумма дебетов должна равняться сумме кредитов
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period filter */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className={t.textMuted} />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${t.border} ${t.bgCard} ${t.text} text-sm`}
            >
              <option value="">Все периоды</option>
              {periodOptions.map((p) => (
                <option key={p} value={p}>{periodLabel(p)}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchBalance}
            disabled={loading}
            className={`p-2 rounded-lg border ${t.border} ${t.bgCard} hover:${t.bgCardHover} transition-colors`}
            title="Обновить"
          >
            <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''} ${t.textMuted}`} />
          </button>
        </div>
      </div>

      {/* Balance status banner */}
      {data && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          data.isBalanced
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400'
        }`}>
          {data.isBalanced ? (
            <>
              <CheckCircle size={20} />
              <span className="font-medium">Баланс сходится</span>
              <span className="text-sm opacity-75">
                Дебет = Кредит = ${fmt(data.totalDebit)}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              <span className="font-medium">БАЛАНС НЕ СХОДИТСЯ!</span>
              <span className="text-sm">
                Дебет: ${fmt(data.totalDebit)} | Кредит: ${fmt(data.totalCredit)} | Разница: ${fmt(Math.abs(data.totalDebit - data.totalCredit))}
              </span>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className={`animate-spin ${t.textMuted}`} />
          <span className={`ml-3 ${t.textMuted}`}>Загрузка...</span>
        </div>
      )}

      {/* Table */}
      {data && data.rows.length > 0 && (
        <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden shadow-sm`}>
          <table className="w-full">
            <thead>
              <tr className={`${t.bgMain} border-b ${t.border}`}>
                <th className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
                  Код
                </th>
                <th className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
                  Счёт
                </th>
                <th className={`text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
                  Дебет (USD)
                </th>
                <th className={`text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
                  Кредит (USD)
                </th>
                <th className={`text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
                  Сальдо (USD)
                </th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNT_TYPE_ORDER.map((type) => {
                const rows = groupedRows[type];
                if (!rows || rows.length === 0) return null;
                return (
                  <React.Fragment key={type}>
                    {/* Group header */}
                    <tr className={`${t.bgMain}`}>
                      <td colSpan={5} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>
                        {ACCOUNT_TYPE_LABELS[type]}
                      </td>
                    </tr>
                    {/* Rows */}
                    {rows.map((row) => (
                      <tr key={row.accountCode} className={`border-b ${t.border} hover:${t.bgCardHover} transition-colors`}>
                        <td className={`px-4 py-3 text-sm font-mono ${t.textMuted}`}>
                          {row.accountCode}
                        </td>
                        <td className={`px-4 py-3 text-sm ${t.text}`}>
                          {row.accountName}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-mono ${row.debitTotal > 0 ? t.text : t.textMuted}`}>
                          {row.debitTotal > 0 ? fmt(row.debitTotal) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-mono ${row.creditTotal > 0 ? t.text : t.textMuted}`}>
                          {row.creditTotal > 0 ? fmt(row.creditTotal) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-mono font-medium ${
                          row.balance > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : row.balance < 0
                            ? 'text-red-600 dark:text-red-400'
                            : t.textMuted
                        }`}>
                          {row.balance !== 0 ? fmt(row.balance) : '—'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Totals */}
            <tfoot>
              <tr className={`border-t-2 ${t.border} font-bold`}>
                <td className={`px-4 py-3 ${t.text}`} colSpan={2}>
                  ИТОГО
                </td>
                <td className={`px-4 py-3 text-right font-mono ${t.text}`}>
                  {fmt(data.totalDebit)}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${t.text}`}>
                  {fmt(data.totalCredit)}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  data.isBalanced
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {fmt(data.totalDebit - data.totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Empty state */}
      {data && data.rows.length === 0 && (
        <div className={`text-center py-16 ${t.textMuted}`}>
          <Scale size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Нет проводок</p>
          <p className="text-sm mt-1">
            {period ? `За период ${periodLabel(period)} проводок нет` : 'Проводки будут создаваться автоматически при продажах, закупках и расходах'}
          </p>
        </div>
      )}
    </div>
  );
});
