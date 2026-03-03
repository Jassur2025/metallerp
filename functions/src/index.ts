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
export { deletePurchase } from "./purchases/deletePurchase";

// ─── Orders (Задача B.4) ───────────────────────────────────
export { deleteOrder } from "./orders/deleteOrder";

// ─── Payments (Задача 6.2) ──────────────────────────────────
export { processPayment } from "./payments/processPayment";

// ─── Transactions (Задачи 6.3, 6.4) ────────────────────────
export { updateTransaction } from "./transactions/updateTransaction";
export { deleteTransaction } from "./transactions/deleteTransaction";

// ─── Balance (Задача 7.1) ───────────────────────────────────
export { computeBalance } from "./balance/computeBalance";

// ─── Reports (Задача 13.2) ──────────────────────────────────
export { generateReport } from "./reports/generateReport";

// ─── Fixed Assets (Задача B.6, B.7, B.10) ───────────────────
export { runDepreciation } from "./assets/runDepreciation";
export { deleteFixedAsset } from "./assets/deleteFixedAsset";
export { purchaseFixedAsset } from "./assets/purchaseFixedAsset";

// ─── Payroll (Задача B.9) ───────────────────────────────────
export { processPayroll } from "./payroll/processPayroll";

// ─── Auth triggers (Задача 8.3) ─────────────────────────────
export { onEmployeeChange } from "./auth/onEmployeeChange";
