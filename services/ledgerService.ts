/**
 * ledgerService — General Ledger (Главная книга)
 *
 * Manages double-entry bookkeeping via the `ledgerEntries` Firestore collection.
 * Every financial operation (sale, purchase, expense, payment) creates one or more
 * LedgerEntry documents.  The fundamental invariant: sum of all debits = sum of
 * all credits — always.
 */
import {
  db,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
} from '../lib/firebase';
import {
  AccountCode,
  LedgerEntry,
  TrialBalance,
  TrialBalanceRow,
  ACCOUNT_NAMES,
  ACCOUNT_TYPES,
} from '../types/accounting';
import { IdGenerator } from '../utils/idGenerator';
import { logger } from '../utils/logger';
import { assertAuth, getCurrentUserEmail } from '../utils/authGuard';

const COLLECTION_NAME = 'ledgerEntries';

// ─── Helpers ──────────────────────────────────────────────────

/** Derive accounting period id from an ISO date string ("2026-02") */
function toPeriodId(isoDate: string): string {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─── Service ──────────────────────────────────────────────────

export const ledgerService = {

  // ── Write ───────────────────────────────────────────────────

  /**
   * Create a single ledger entry (one debit–credit pair).
   */
  async addEntry(params: {
    date: string;
    debitAccount: AccountCode;
    creditAccount: AccountCode;
    amount: number;
    amountUZS?: number;
    exchangeRate?: number;
    description: string;
    relatedType?: LedgerEntry['relatedType'];
    relatedId?: string;
  }): Promise<LedgerEntry> {
    assertAuth();

    if (params.amount <= 0) {
      throw new Error(`Ledger entry amount must be > 0, got ${params.amount}`);
    }
    if (params.debitAccount === params.creditAccount) {
      throw new Error('Debit and credit accounts must differ');
    }

    const id = IdGenerator.ledger();
    const entry: LedgerEntry = {
      id,
      date: params.date,
      debitAccount: params.debitAccount,
      creditAccount: params.creditAccount,
      amount: params.amount,
      amountUZS: params.amountUZS,
      exchangeRate: params.exchangeRate,
      description: params.description,
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      periodId: toPeriodId(params.date),
      createdBy: getCurrentUserEmail(),
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION_NAME, id), {
      ...entry,
      _createdAt: Timestamp.now(),
    });

    return entry;
  },

  /**
   * Create multiple ledger entries in a single Firestore batch (atomic).
   * Used when a single business event generates several lines
   * (e.g. sale = revenue + COGS + VAT + payment).
   */
  async addEntries(
    entries: Array<Omit<LedgerEntry, 'id' | 'periodId' | 'createdBy' | 'createdAt'>>,
  ): Promise<LedgerEntry[]> {
    assertAuth();

    if (entries.length === 0) return [];

    const email = getCurrentUserEmail();
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    const result: LedgerEntry[] = [];

    for (const e of entries) {
      if (e.amount <= 0) {
        throw new Error(`Ledger entry amount must be > 0, got ${e.amount}`);
      }
      if (e.debitAccount === e.creditAccount) {
        throw new Error(`Debit and credit accounts must differ: ${e.debitAccount}`);
      }

      const id = IdGenerator.ledger();
      const entry: LedgerEntry = {
        id,
        date: e.date,
        debitAccount: e.debitAccount,
        creditAccount: e.creditAccount,
        amount: e.amount,
        amountUZS: e.amountUZS,
        exchangeRate: e.exchangeRate,
        description: e.description,
        relatedType: e.relatedType,
        relatedId: e.relatedId,
        periodId: toPeriodId(e.date),
        createdBy: email,
        createdAt: now,
      };

      batch.set(doc(db, COLLECTION_NAME, id), {
        ...entry,
        _createdAt: Timestamp.now(),
      });

      result.push(entry);
    }

    await batch.commit();
    logger.info('LedgerService', `Created ${result.length} ledger entries`);
    return result;
  },

  // ── Read ────────────────────────────────────────────────────

  /**
   * Real-time subscription to ledger entries, optionally filtered by period.
   */
  subscribe(
    callback: (entries: LedgerEntry[]) => void,
    periodId?: string,
  ): () => void {
    const q = periodId
      ? query(collection(db, COLLECTION_NAME), where('periodId', '==', periodId), orderBy('date', 'desc'))
      : query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
      callback(entries);
    }, (error) => {
      logger.error('LedgerService', 'Subscribe error:', error);
    });
  },

  /**
   * One-shot fetch of all entries for a period.
   */
  async getByPeriod(periodId: string): Promise<LedgerEntry[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('periodId', '==', periodId),
      orderBy('date', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
  },

  /**
   * Fetch entries linked to a specific business object.
   */
  async getByRelated(relatedId: string): Promise<LedgerEntry[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('relatedId', '==', relatedId),
      orderBy('date', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
  },

  // ── Trial Balance ──────────────────────────────────────────

  /**
   * Compute trial balance for a given period (or all time if no period).
   * Iterates all ledger entries, accumulates debit/credit per account,
   * and checks the fundamental equation: totalDebit === totalCredit.
   */
  async getTrialBalance(periodId?: string): Promise<TrialBalance> {
    let entries: LedgerEntry[];
    if (periodId) {
      entries = await this.getByPeriod(periodId);
    } else {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
    }

    // Accumulate per-account totals
    const debits = new Map<AccountCode, number>();
    const credits = new Map<AccountCode, number>();

    for (const entry of entries) {
      debits.set(entry.debitAccount, (debits.get(entry.debitAccount) || 0) + entry.amount);
      credits.set(entry.creditAccount, (credits.get(entry.creditAccount) || 0) + entry.amount);
    }

    // Build rows for every account that has any activity
    const allCodes = new Set<AccountCode>([...debits.keys(), ...credits.keys()]);
    const rows: TrialBalanceRow[] = [];

    for (const code of allCodes) {
      const d = debits.get(code) || 0;
      const c = credits.get(code) || 0;
      const acctType = ACCOUNT_TYPES[code];
      // Normal balance: assets/expenses are debit-normal, liabilities/equity/revenue are credit-normal
      const isDebitNormal = acctType === 'asset' || acctType === 'expense';
      const balance = isDebitNormal ? d - c : c - d;

      rows.push({
        accountCode: code,
        accountName: ACCOUNT_NAMES[code] || code,
        debitTotal: round2(d),
        creditTotal: round2(c),
        balance: round2(balance),
      });
    }

    // Sort by account code
    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = round2(rows.reduce((sum, r) => sum + r.debitTotal, 0));
    const totalCredit = round2(rows.reduce((sum, r) => sum + r.creditTotal, 0));

    return {
      periodId,
      rows,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      computedAt: new Date().toISOString(),
    };
  },

  /**
   * Get the balance for a single account (sum of debits − credits, sign-aware).
   */
  async getAccountBalance(accountCode: AccountCode, periodId?: string): Promise<number> {
    const trial = await this.getTrialBalance(periodId);
    const row = trial.rows.find(r => r.accountCode === accountCode);
    return row?.balance ?? 0;
  },
};

// ─── Utility ──────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
