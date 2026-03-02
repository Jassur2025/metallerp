/**
 * AccountingPeriodsTab — Управление учётными периодами
 *
 * Lists periods, allows closing/reopening. Only admin-accessible.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { accountingPeriodService } from '../../services/accountingPeriodService';
import { AccountingPeriod, AccountCode, ACCOUNT_NAMES } from '../../types/accounting';
import { useConfirm } from '../ConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import {
  Calendar,
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function periodLabel(p: AccountingPeriod): string {
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Component ─────────────────────────────────────────────────

export const AccountingPeriodsTab: React.FC = () => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const { confirm: showConfirm } = useConfirm();
  const toast = useToast();

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  // ── Fetch periods ──────────────────────────────────────────
  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure current period exists
      await accountingPeriodService.ensureOpen(accountingPeriodService.currentPeriodId());
      const data = await accountingPeriodService.list();
      setPeriods(data);
    } catch (err: any) {
      toast.error(`Ошибка загрузки периодов: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // ── Close period ───────────────────────────────────────────
  const handleClose = useCallback(async (periodId: string) => {
    const confirmed = await showConfirm({
      title: 'Закрыть период',
      message: `Вы уверены, что хотите закрыть период ${periodId}? Это заблокирует создание проводок за этот месяц.`,
      variant: 'danger',
    });
    if (!confirmed) return;

    setActionLoading(periodId);
    try {
      await accountingPeriodService.closePeriod(periodId);
      toast.success(`Период ${periodId} закрыт`);
      await fetchPeriods();
    } catch (err: any) {
      toast.error(`Ошибка закрытия: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [showConfirm, toast, fetchPeriods]);

  // ── Reopen period ──────────────────────────────────────────
  const handleReopen = useCallback(async (periodId: string) => {
    const confirmed = await showConfirm({
      title: 'Открыть период',
      message: `Открыть заново период ${periodId}? Это разрешит создание проводок за этот месяц.`,
      variant: 'warning',
    });
    if (!confirmed) return;

    setActionLoading(periodId);
    try {
      await accountingPeriodService.reopenPeriod(periodId);
      toast.success(`Период ${periodId} открыт заново`);
      await fetchPeriods();
    } catch (err: any) {
      toast.error(`Ошибка: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [showConfirm, toast, fetchPeriods]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <Calendar size={22} className="text-amber-500" />
            Учётные периоды
          </h3>
          <p className={`${t.textMuted} text-sm mt-1`}>
            Закрытие периода блокирует проводки и вычисляет начальные сальдо
          </p>
        </div>
        <button
          onClick={fetchPeriods}
          disabled={loading}
          className={`p-2 rounded-lg border ${t.border} ${t.bgCard} hover:${t.bgCardHover} transition-colors`}
          title="Обновить"
        >
          <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''} ${t.textMuted}`} />
        </button>
      </div>

      {/* Loading */}
      {loading && periods.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className={`animate-spin ${t.textMuted}`} />
          <span className={`ml-2 ${t.textMuted}`}>Загрузка...</span>
        </div>
      )}

      {/* Periods list */}
      {periods.length > 0 && (
        <div className="space-y-3">
          {periods.map((period) => {
            const isCurrent = period.id === accountingPeriodService.currentPeriodId();
            const isExpanded = expandedPeriod === period.id;
            const isLoading = actionLoading === period.id;
            const hasOpeningBalances = period.openingBalances && Object.keys(period.openingBalances).length > 0;

            return (
              <div
                key={period.id}
                className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden transition-all`}
              >
                {/* Period row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Expand button */}
                    {hasOpeningBalances && (
                      <button
                        onClick={() => setExpandedPeriod(isExpanded ? null : period.id)}
                        className={`${t.textMuted} hover:${t.text}`}
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    )}

                    {/* Status icon */}
                    {period.status === 'closed' ? (
                      <Lock size={18} className="text-red-500" />
                    ) : (
                      <Unlock size={18} className="text-emerald-500" />
                    )}

                    {/* Info */}
                    <div>
                      <div className={`font-semibold ${t.text} flex items-center gap-2`}>
                        {periodLabel(period)}
                        {isCurrent && (
                          <span className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            текущий
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${t.textMuted} mt-0.5`}>
                        {period.status === 'closed' ? (
                          <span>Закрыт {formatDate(period.closedAt)} — {period.closedBy}</span>
                        ) : (
                          <span>Открыт</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {period.status === 'open' ? (
                      <button
                        onClick={() => handleClose(period.id)}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                          bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/30
                          disabled:opacity-50`}
                      >
                        {isLoading ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Lock size={14} />
                        )}
                        Закрыть период
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReopen(period.id)}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                          bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30
                          disabled:opacity-50`}
                      >
                        {isLoading ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Unlock size={14} />
                        )}
                        Открыть заново
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: Opening balances */}
                {isExpanded && hasOpeningBalances && (
                  <div className={`border-t ${t.border} px-5 py-4`}>
                    <h4 className={`text-sm font-semibold ${t.textMuted} mb-3`}>
                      Начальные сальдо (Opening Balances)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(period.openingBalances!).map(([code, balance]) => (
                        <div
                          key={code}
                          className={`flex justify-between items-center px-3 py-2 rounded-lg ${t.bgMain} text-sm`}
                        >
                          <span className={t.text}>
                            <span className="font-mono text-xs mr-2 opacity-60">{code}</span>
                            {ACCOUNT_NAMES[code as AccountCode] || code}
                          </span>
                          <span className={`font-mono font-medium ${
                            (balance as number) >= 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            ${fmt(balance as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && periods.length === 0 && (
        <div className={`text-center py-12 ${t.textMuted}`}>
          <Calendar size={48} className="mx-auto mb-4 opacity-30" />
          <p>Нет учётных периодов</p>
        </div>
      )}

      {/* Info */}
      <div className={`flex items-start gap-3 p-4 rounded-xl ${t.bgMain} border ${t.border} text-sm ${t.textMuted}`}>
        <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Как работает закрытие периода:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Проверяется, что баланс сходится (дебет = кредит)</li>
            <li>Вычисляются начальные сальдо для следующего месяца</li>
            <li>Доходы и расходы обнуляются, результат идёт в нераспределённую прибыль</li>
            <li>Период блокируется для новых операций</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
