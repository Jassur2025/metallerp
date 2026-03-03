/**
 * Payroll Atomic Service — calls Cloud Functions for server-side payroll operations
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface ProcessPayrollInput {
  year: number;
  month: number; // 1-12
  exchangeRate: number;
}

interface ProcessPayrollResult {
  processed: number;
  totalAccrual: number;
  monthKey: string;
  message: string;
}

const processPayrollCF = httpsCallable<ProcessPayrollInput, ProcessPayrollResult>(
  functions,
  'processPayroll'
);

export const payrollAtomicService = {
  /**
   * Process payroll accrual for a given month.
   * Server-side: creates salary accrual ledger entries + journal event.
   * Idempotent per month (safe to call multiple times).
   */
  async processPayroll(input: ProcessPayrollInput): Promise<ProcessPayrollResult> {
    const { data } = await processPayrollCF(input);
    return data;
  },
};
