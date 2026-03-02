/**
 * Accounting types — Chart of Accounts & General Ledger
 *
 * Based on NSBU (Национальные стандарты бухучёта Узбекистана),
 * simplified for metal-trading operations.
 */

// ─── Chart of Accounts ──────────────────────────────────────
// Account codes follow Uzbekistan NSBU numbering convention.

export enum AccountCode {
  // ── Активы (Assets) ───────────────────────────────────────
  FIXED_ASSETS          = '0100',  // Основные средства
  ACCUM_DEPRECIATION    = '0200',  // Амортизация ОС (contra-asset)
  INVENTORY             = '2900',  // ТМЗ (Товарно-материальные запасы)
  ACCOUNTS_RECEIVABLE   = '4010',  // Дебиторская задолженность
  VAT_RECEIVABLE        = '4410',  // НДС к возмещению (входящий)
  CASH_USD              = '5010',  // Касса USD
  CASH_UZS              = '5020',  // Касса UZS
  BANK_UZS              = '5110',  // Расчётный счёт UZS

  // ── Пассивы (Liabilities) ─────────────────────────────────
  ACCOUNTS_PAYABLE      = '6010',  // Кредиторская задолженность (поставщики)
  VAT_PAYABLE           = '6410',  // НДС к уплате (исходящий)
  SALARY_PAYABLE        = '6710',  // Задолженность по зарплате

  // ── Капитал (Equity) ──────────────────────────────────────
  EQUITY                = '8300',  // Уставный капитал
  RETAINED_EARNINGS     = '8700',  // Нераспределённая прибыль

  // ── Доходы и Расходы (Income & Expenses) ──────────────────
  REVENUE               = '9010',  // Выручка от реализации
  COGS                  = '9110',  // Себестоимость реализованной продукции
  COMMERCIAL_EXPENSES   = '9410',  // Коммерческие расходы
  ADMIN_EXPENSES        = '9420',  // Административные расходы
  DEPRECIATION_EXPENSE  = '9430',  // Расходы на амортизацию
}

/** Human-readable names for each account code */
export const ACCOUNT_NAMES: Record<AccountCode, string> = {
  [AccountCode.FIXED_ASSETS]:        'Основные средства',
  [AccountCode.ACCUM_DEPRECIATION]:  'Амортизация ОС',
  [AccountCode.INVENTORY]:           'ТМЗ (Товарно-мат. запасы)',
  [AccountCode.ACCOUNTS_RECEIVABLE]: 'Дебиторская задолженность',
  [AccountCode.VAT_RECEIVABLE]:      'НДС к возмещению',
  [AccountCode.CASH_USD]:            'Касса USD',
  [AccountCode.CASH_UZS]:            'Касса UZS',
  [AccountCode.BANK_UZS]:            'Расчётный счёт',
  [AccountCode.ACCOUNTS_PAYABLE]:    'Кредиторская задолженность',
  [AccountCode.VAT_PAYABLE]:         'НДС к уплате',
  [AccountCode.SALARY_PAYABLE]:      'Задолженность по зарплате',
  [AccountCode.EQUITY]:              'Уставный капитал',
  [AccountCode.RETAINED_EARNINGS]:   'Нераспределённая прибыль',
  [AccountCode.REVENUE]:             'Выручка от реализации',
  [AccountCode.COGS]:                'Себестоимость',
  [AccountCode.COMMERCIAL_EXPENSES]: 'Коммерческие расходы',
  [AccountCode.ADMIN_EXPENSES]:      'Административные расходы',
  [AccountCode.DEPRECIATION_EXPENSE]:'Расходы на амортизацию',
};

/** Classification of each account — determines normal balance (debit or credit) */
export type AccountType = 'asset' | 'contra_asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export const ACCOUNT_TYPES: Record<AccountCode, AccountType> = {
  [AccountCode.FIXED_ASSETS]:        'asset',
  [AccountCode.ACCUM_DEPRECIATION]:  'contra_asset',
  [AccountCode.INVENTORY]:           'asset',
  [AccountCode.ACCOUNTS_RECEIVABLE]: 'asset',
  [AccountCode.VAT_RECEIVABLE]:      'asset',
  [AccountCode.CASH_USD]:            'asset',
  [AccountCode.CASH_UZS]:            'asset',
  [AccountCode.BANK_UZS]:            'asset',
  [AccountCode.ACCOUNTS_PAYABLE]:    'liability',
  [AccountCode.VAT_PAYABLE]:         'liability',
  [AccountCode.SALARY_PAYABLE]:      'liability',
  [AccountCode.EQUITY]:              'equity',
  [AccountCode.RETAINED_EARNINGS]:   'equity',
  [AccountCode.REVENUE]:             'revenue',
  [AccountCode.COGS]:                'expense',
  [AccountCode.COMMERCIAL_EXPENSES]: 'expense',
  [AccountCode.ADMIN_EXPENSES]:      'expense',
  [AccountCode.DEPRECIATION_EXPENSE]:'expense',
};

// ─── Ledger Entry ────────────────────────────────────────────

/** A single double-entry journal line (always comes in debit/credit pairs) */
export interface LedgerEntry {
  id: string;
  /** ISO date of the underlying business event */
  date: string;
  /** Account debited */
  debitAccount: AccountCode;
  /** Account credited */
  creditAccount: AccountCode;
  /** Amount in USD (base currency) */
  amount: number;
  /** Amount in UZS (for UZS-denominated operations) */
  amountUZS?: number;
  /** Exchange rate used for conversion */
  exchangeRate?: number;
  /** Human-readable description */
  description: string;
  /** What business object created this entry */
  relatedType?: 'order' | 'purchase' | 'expense' | 'transaction' | 'depreciation';
  /** ID of the related business object */
  relatedId?: string;
  /** Accounting period (format: "2026-02") */
  periodId?: string;
  /** Who created the entry (email) */
  createdBy: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

// ─── Accounting Period ───────────────────────────────────────

export interface AccountingPeriod {
  /** Format: "2026-02" */
  id: string;
  year: number;
  month: number;
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
  /** Opening balances carried from previous period close */
  openingBalances?: Partial<Record<AccountCode, number>>;
}

// ─── Trial Balance ───────────────────────────────────────────

export interface TrialBalanceRow {
  accountCode: AccountCode;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export interface TrialBalance {
  periodId?: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  computedAt: string;
}
