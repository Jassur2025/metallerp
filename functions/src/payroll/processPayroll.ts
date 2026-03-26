/**
 * processPayroll — Callable Cloud Function (Задача B.9)
 *
 * Server-side payroll accrual with atomic:
 *   - Reads employees, orders, expenses for the target month
 *   - Calculates base salary (prorated) + KPI bonus for each employee
 *   - Creates accrual ledger entries: Дт 9420 (ADMIN_EXPENSES) / Кт 6710 (SALARY_PAYABLE)
 *   - Journal event for audit trail
 *   - Idempotent per month (safe to call multiple times)
 *
 * CLIENT sends:
 *   - year: number
 *   - month: number (1-12)
 *   - exchangeRate: number (USD→UZS, used to convert UZS advances)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { checkRateLimit } from "../utils/rateLimiter";
import { safeNum, round2 } from "../utils/validation";
import { AccountCode, type LedgerEntryData } from "../utils/finance";

const DEFAULT_EXCHANGE_RATE = 12800;

// ─── Cloud Function ─────────────────────────────────────────

export const processPayroll = onCall(
  {
    region: "europe-west1",
    enforceAppCheck: false,
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    // 1. Auth + role check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const uid = request.auth.uid;
    const userEmail = request.auth.token.email || uid;

    const db = getFirestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can process payroll",
      );
    }

    // Rate limit: 2 per minute
    await checkRateLimit(uid, "processPayroll", {
      maxCalls: 2,
      windowMs: 60_000,
    });

    // 2. Validate input
    const data = request.data;
    const year = safeNum(data.year);
    const month = safeNum(data.month); // 1-12
    const exchangeRate = safeNum(data.exchangeRate) || DEFAULT_EXCHANGE_RATE;

    if (year < 2020 || year > 2100) {
      throw new HttpsError("invalid-argument", "Invalid year");
    }
    if (month < 1 || month > 12) {
      throw new HttpsError("invalid-argument", "Month must be 1-12");
    }

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const monthIndex = month - 1; // JS months are 0-based
    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59);
    const daysInMonth = endOfMonth.getDate();
    const nowIso = new Date().toISOString();

    // 3. Check idempotency — look for existing payroll journal for this month
    const existingPayroll = await db
      .collection("journalEvents")
      .where("action", "==", "payroll_accrual")
      .where("metadata.monthKey", "==", monthKey)
      .limit(1)
      .get();

    if (!existingPayroll.empty) {
      return {
        processed: 0,
        totalAccrual: 0,
        monthKey,
        message: `Payroll already processed for ${monthKey}`,
      };
    }

    // 4. Read data
    const [employeesSnap, ordersSnap, transactionsSnap] = await Promise.all([
      db.collection("employees").get(),
      db.collection("orders").get(),
      db.collection("transactions").get(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Doc = Record<string, any>;

    // Filter employees: active or terminated after month start
    const employees: Doc[] = employeesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Doc))
      .filter((emp) => {
        return (
          emp.status === "active" ||
          (emp.terminationDate && new Date(emp.terminationDate) >= startOfMonth)
        );
      });

    // Filter orders: completed, in this month
    const monthOrders: Doc[] = ordersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Doc))
      .filter((ord) => {
        if (ord.status !== "completed") return false;
        const d = new Date(ord.date);
        return d >= startOfMonth && d <= endOfMonth;
      });

    // Filter expenses (transactions with type='expense') in this month
    const monthExpenses: Doc[] = transactionsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Doc))
      .filter((tx) => {
        if (tx.type !== "expense") return false;
        const d = new Date(tx.date);
        return d >= startOfMonth && d <= endOfMonth;
      });

    // 5. Calculate payroll for each employee
    interface PayrollLine {
      employeeId: string;
      employeeName: string;
      baseSalary: number;
      kpiBonus: number;
      totalAccrual: number;
    }

    const lines: PayrollLine[] = [];

    for (const emp of employees) {
      const salary = safeNum(emp.salary);
      if (salary <= 0) continue;

      let baseSalary = salary;
      let daysWorked = daysInMonth;

      const hireDate = new Date(emp.hireDate || "2020-01-01");
      const termDate = emp.terminationDate
        ? new Date(emp.terminationDate)
        : null;

      // Prorate if hired this month
      if (hireDate > startOfMonth && hireDate <= endOfMonth) {
        daysWorked -= hireDate.getDate() - 1;
      }
      // Prorate if terminated this month
      if (termDate && termDate >= startOfMonth && termDate <= endOfMonth) {
        daysWorked -= daysInMonth - termDate.getDate();
      }
      // Not in service this month
      if (
        hireDate > endOfMonth ||
        (termDate && termDate < startOfMonth)
      ) {
        daysWorked = 0;
      }

      if (daysWorked < daysInMonth && daysInMonth > 0) {
        baseSalary = (salary / daysInMonth) * Math.max(0, daysWorked);
      }
      baseSalary = round2(baseSalary);

      if (baseSalary <= 0) continue;

      // KPI bonus: commissionRate% of profit on employee's orders
      let kpiBonus = 0;
      if (emp.hasKPI && safeNum(emp.commissionRate) > 0) {
        const empOrders = monthOrders.filter(
          (o) =>
            o.sellerId === emp.id || o.sellerName === emp.name,
        );
        const profitTotal = empOrders.reduce(
          (sum: number, order) => {
            const items = order.items;
            if (!Array.isArray(items)) return sum;
            return (
              sum +
              items.reduce((s: number, item: Doc) => {
                const cost = safeNum(item.costAtSale);
                const price = safeNum(item.priceAtSale);
                const qty = safeNum(item.quantity);
                return s + (price - cost) * qty;
              }, 0)
            );
          },
          0,
        );
        kpiBonus = round2(profitTotal * (safeNum(emp.commissionRate) / 100));
      }

      const totalAccrual = round2(baseSalary + Math.max(0, kpiBonus));

      lines.push({
        employeeId: emp.id,
        employeeName: emp.name || "Unknown",
        baseSalary,
        kpiBonus: round2(Math.max(0, kpiBonus)),
        totalAccrual,
      });
    }

    if (lines.length === 0) {
      return {
        processed: 0,
        totalAccrual: 0,
        monthKey,
        message: "No employees with salary found",
      };
    }

    // 6. Write ledger entries + journal inside transaction
    const grandTotal = round2(lines.reduce((s, l) => s + l.totalAccrual, 0));

    // Firestore limits: 500 writes per transaction
    // Each employee = 1 ledger entry. Plus 1 journal. Should be fine.
    await db.runTransaction(async (tx) => {
      // One ledger entry per employee (for detailed reporting)
      for (const line of lines) {
        const entry: LedgerEntryData = {
          date: nowIso,
          debitAccount: AccountCode.ADMIN_EXPENSES,
          creditAccount: AccountCode.SALARY_PAYABLE,
          amount: line.totalAccrual,
          description: `Начисление ЗП: ${line.employeeName} (${monthKey})${line.kpiBonus > 0 ? ` +KPI $${line.kpiBonus}` : ""}`,
          relatedType: "expense",
          relatedId: line.employeeId,
          periodId: monthKey,
          createdBy: userEmail,
          createdAt: nowIso,
        };
        tx.set(db.collection("ledgerEntries").doc(), entry);
      }

      // Journal event
      tx.set(db.collection("journalEvents").doc(), {
        action: "payroll_accrual",
        description: `Начисление ЗП за ${monthKey} — ${lines.length} сотрудников — $${grandTotal}`,
        userId: uid,
        userEmail,
        metadata: {
          monthKey,
          employeesCount: lines.length,
          totalAccrual: grandTotal,
          lines: lines.map((l) => ({
            id: l.employeeId,
            name: l.employeeName,
            salary: l.baseSalary,
            kpi: l.kpiBonus,
            total: l.totalAccrual,
          })),
        },
        createdAt: nowIso,
      });
    });

    return {
      processed: lines.length,
      totalAccrual: grandTotal,
      monthKey,
      message: `Payroll accrual for ${lines.length} employees, total $${grandTotal}`,
    };
  },
);
