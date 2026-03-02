/**
 * MetalMaster ERP — Cloud Functions entry point
 *
 * All callable/trigger functions are exported from here.
 * Firebase deploys only the exports from this file.
 */

import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK (uses default credentials in Cloud Functions)
initializeApp();

// ─── Sales ──────────────────────────────────────────────────
export { commitSale } from "./sales/commitSale";

// ─── Purchases (Задача 6.1) ────────────────────────────────
export { commitPurchase } from "./purchases/commitPurchase";

// ─── Payments (Задача 6.2) ──────────────────────────────────
export { processPayment } from "./payments/processPayment";

// ─── Transactions (Задачи 6.3, 6.4) ────────────────────────
export { updateTransaction } from "./transactions/updateTransaction";
export { deleteTransaction } from "./transactions/deleteTransaction";

// ─── Balance (Задача 7.1) ───────────────────────────────────
export { computeBalance } from "./balance/computeBalance";

// ─── Reports (Задача 13.2) ──────────────────────────────────
export { generateReport } from "./reports/generateReport";

// ─── Auth triggers (Задача 8.3) ─────────────────────────────
export { onEmployeeChange } from "./auth/onEmployeeChange";
