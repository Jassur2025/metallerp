/**
 * accountingPeriodService — Управление учётными периодами
 *
 * Each period represents one calendar month (e.g. "2026-02").
 * Periods can be "open" (entries allowed) or "closed" (locked).
 *
 * Closing a period:
 *  1. Validates that trial balance is balanced (Σ debits = Σ credits)
 *  2. Computes opening balances for the next period
 *  3. Marks period as closed (no further entries allowed)
 */

import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from '../lib/firebase';
import {
  AccountCode,
  AccountingPeriod,
  ACCOUNT_TYPES,
} from '../types/accounting';
import { ledgerService } from './ledgerService';
import { logger } from '../utils/logger';
import { assertAuth, getCurrentUserEmail } from '../utils/authGuard';

const COLLECTION_NAME = 'accountingPeriods';

// ─── Helpers ──────────────────────────────────────────────────

/** Build a period id from year/month: "2026-02" */
function makePeriodId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Parse period id to {year, month} */
function parsePeriodId(periodId: string): { year: number; month: number } {
  const [y, m] = periodId.split('-').map(Number);
  return { year: y, month: m };
}

/** Get the next period id (e.g. "2026-12" → "2027-01") */
function nextPeriodId(periodId: string): string {
  const { year, month } = parsePeriodId(periodId);
  if (month === 12) return makePeriodId(year + 1, 1);
  return makePeriodId(year, month + 1);
}

/** Current period id based on system date */
function currentPeriodId(): string {
  const now = new Date();
  return makePeriodId(now.getFullYear(), now.getMonth() + 1);
}

// ─── Service ──────────────────────────────────────────────────

export const accountingPeriodService = {

  // ── Read ────────────────────────────────────────────────────

  /**
   * Get a single period by id. Returns null if not found.
   */
  async get(periodId: string): Promise<AccountingPeriod | null> {
    assertAuth();
    const snap = await getDoc(doc(db, COLLECTION_NAME, periodId));
    if (!snap.exists()) return null;
    return snap.data() as AccountingPeriod;
  },

  /**
   * List all periods, ordered by id descending (newest first).
   */
  async list(): Promise<AccountingPeriod[]> {
    assertAuth();
    const q = query(collection(db, COLLECTION_NAME), orderBy('id', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AccountingPeriod);
  },

  /**
   * Ensure a period exists (create open if missing).
   * Idempotent — safe to call multiple times.
   */
  async ensureOpen(periodId: string): Promise<AccountingPeriod> {
    assertAuth();
    const existing = await this.get(periodId);
    if (existing) return existing;

    const { year, month } = parsePeriodId(periodId);
    const period: AccountingPeriod = {
      id: periodId,
      year,
      month,
      status: 'open',
    };
    await setDoc(doc(db, COLLECTION_NAME, periodId), {
      ...period,
      _createdAt: Timestamp.now(),
    });
    return period;
  },

  /**
   * Check if a period is open (or does not exist yet — treated as open).
   */
  async isOpen(periodId: string): Promise<boolean> {
    const existing = await this.get(periodId);
    return !existing || existing.status === 'open';
  },

  // ── Close period ────────────────────────────────────────────

  /**
   * Close an accounting period.
   *
   * Steps:
   *  1. Verify trial balance is balanced
   *  2. Compute account balances as opening balances for next period
   *  3. Mark period as closed
   *  4. Create next period (open) with opening balances
   *
   * Throws if trial balance is unbalanced or period is already closed.
   */
  async closePeriod(periodId: string): Promise<{
    closedPeriod: AccountingPeriod;
    nextPeriod: AccountingPeriod;
  }> {
    assertAuth();

    // 1. Verify period exists and is open
    const period = await this.ensureOpen(periodId);
    if (period.status === 'closed') {
      throw new Error(`Период ${periodId} уже закрыт`);
    }

    // 2. Get trial balance and verify it's balanced
    const trialBalance = await ledgerService.getTrialBalance(periodId);
    if (!trialBalance.isBalanced) {
      throw new Error(
        `Баланс не сходится за период ${periodId}: ` +
        `Дебет=$${trialBalance.totalDebit.toFixed(2)}, ` +
        `Кредит=$${trialBalance.totalCredit.toFixed(2)}`
      );
    }

    // 3. Compute opening balances for the next period
    //    Balance-sheet accounts (asset, contra_asset, liability, equity) carry forward.
    //    Revenue/expense accounts reset to 0 (their net flows to retained earnings).
    const openingBalances: Partial<Record<AccountCode, number>> = {};
    let netIncome = 0;

    for (const row of trialBalance.rows) {
      const accountType = ACCOUNT_TYPES[row.accountCode];
      if (accountType === 'revenue' || accountType === 'expense') {
        // Revenue/expense close out — accumulate net income
        // Revenue has credit balance (positive), expenses have debit balance (positive → subtract)
        if (accountType === 'revenue') {
          netIncome += row.balance; // balance is credit-positive
        } else {
          netIncome -= row.balance; // expense balance is debit-positive
        }
      } else {
        // Balance-sheet account — carry forward
        if (row.balance !== 0) {
          openingBalances[row.accountCode] = row.balance;
        }
      }
    }

    // Add net income to retained earnings
    if (netIncome !== 0) {
      const currentRE = openingBalances[AccountCode.RETAINED_EARNINGS] || 0;
      openingBalances[AccountCode.RETAINED_EARNINGS] = currentRE + netIncome;
    }

    // 4. Mark period as closed
    const email = getCurrentUserEmail();
    const now = new Date().toISOString();
    const closedPeriod: AccountingPeriod = {
      ...period,
      status: 'closed',
      closedAt: now,
      closedBy: email,
    };
    await setDoc(doc(db, COLLECTION_NAME, periodId), {
      ...closedPeriod,
      _updatedAt: Timestamp.now(),
    });

    // 5. Create next period with opening balances
    const nextId = nextPeriodId(periodId);
    const { year: ny, month: nm } = parsePeriodId(nextId);
    const nextPeriodData: AccountingPeriod = {
      id: nextId,
      year: ny,
      month: nm,
      status: 'open',
      openingBalances,
    };
    await setDoc(doc(db, COLLECTION_NAME, nextId), {
      ...nextPeriodData,
      _createdAt: Timestamp.now(),
    });

    logger.info('AccountingPeriodService', `Period ${periodId} closed. Next: ${nextId}`);

    return { closedPeriod, nextPeriod: nextPeriodData };
  },

  /**
   * Reopen a closed period (admin emergency action).
   * Removes closedAt/closedBy and sets status back to 'open'.
   */
  async reopenPeriod(periodId: string): Promise<AccountingPeriod> {
    assertAuth();
    const period = await this.get(periodId);
    if (!period) throw new Error(`Период ${periodId} не найден`);
    if (period.status === 'open') {
      throw new Error(`Период ${periodId} уже открыт`);
    }

    const reopened: AccountingPeriod = {
      ...period,
      status: 'open',
      closedAt: undefined,
      closedBy: undefined,
    };
    await setDoc(doc(db, COLLECTION_NAME, periodId), {
      ...reopened,
      _updatedAt: Timestamp.now(),
    });

    logger.info('AccountingPeriodService', `Period ${periodId} reopened`);
    return reopened;
  },

  // helpers exposed for convenience
  currentPeriodId,
  makePeriodId,
  parsePeriodId,
  nextPeriodId,
};
