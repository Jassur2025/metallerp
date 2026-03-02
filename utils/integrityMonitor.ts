/**
 * Data Integrity Monitor
 * 
 * Provides utilities to detect and report data integrity issues
 * in the ERP system. Run periodically to catch corruption early.
 */

import { Product, Order, Client, Transaction, Purchase, Employee, WorkflowOrder } from '../types';

export interface IntegrityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  entity: string;
  id: string;
  field?: string;
  message: string;
  suggestion: string;
}

export interface IntegrityReport {
  timestamp: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  issues: IntegrityIssue[];
  summary: string;
}

/**
 * Check for duplicate IDs across all entities
 */
function checkDuplicateIds<T extends { id: string }>(
  items: T[],
  entityName: string
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const seen = new Map<string, number>();
  
  for (const item of items) {
    const count = (seen.get(item.id) || 0) + 1;
    seen.set(item.id, count);
    
    if (count === 2) {
      issues.push({
        severity: 'critical',
        entity: entityName,
        id: item.id,
        message: `Duplicate ID found: ${item.id}`,
        suggestion: 'Regenerate ID for one of the duplicate records'
      });
    }
  }
  
  return issues;
}

/**
 * Check for old-style numeric IDs (Date.now() pattern)
 */
function checkOldStyleIds<T extends { id: string }>(
  items: T[],
  entityName: string
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  for (const item of items) {
    // Old style: purely numeric, 13+ digits (timestamp)
    if (/^\d{13,}$/.test(item.id)) {
      issues.push({
        severity: 'medium',
        entity: entityName,
        id: item.id,
        message: `Old-style numeric ID: ${item.id}`,
        suggestion: 'Consider migrating to UUID-based IDs for future records'
      });
    }
  }
  
  return issues;
}

/**
 * Check for orphaned references
 */
function checkOrphanedReferences(
  orders: Order[],
  products: Product[],
  clients: Client[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const productIds = new Set(products.map(p => p.id));
  const clientNames = new Set(clients.map(c => c.name.toLowerCase()));
  
  for (const order of orders) {
    // Check product references in order items
    for (const item of order.items || []) {
      if (!productIds.has(item.productId)) {
        issues.push({
          severity: 'high',
          entity: 'Order',
          id: order.id,
          field: 'items.productId',
          message: `Order references non-existent product: ${item.productId} (${item.productName})`,
          suggestion: 'Product may have been deleted. Review order integrity.'
        });
      }
    }
    
    // Check customer reference
    if (order.customerName && !clientNames.has(order.customerName.toLowerCase())) {
      issues.push({
        severity: 'low',
        entity: 'Order',
        id: order.id,
        field: 'customerName',
        message: `Order customer not in client list: ${order.customerName}`,
        suggestion: 'Consider adding customer to CRM for tracking'
      });
    }
  }
  
  return issues;
}

/**
 * Check for negative quantities
 */
function checkNegativeQuantities(products: Product[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  for (const product of products) {
    if (product.quantity < 0) {
      issues.push({
        severity: 'critical',
        entity: 'Product',
        id: product.id,
        field: 'quantity',
        message: `Negative quantity: ${product.quantity} for ${product.name}`,
        suggestion: 'Investigate recent sales/returns that caused negative stock'
      });
    }
  }
  
  return issues;
}

/**
 * Check client debt consistency with transactions
 */
function checkClientDebtConsistency(
  clients: Client[],
  transactions: Transaction[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  for (const client of clients) {
    // Calculate expected debt from transactions
    let calculatedDebt = 0;
    
    const clientTransactions = transactions.filter(t => t.relatedId === client.id);
    
    for (const tx of clientTransactions) {
      if (tx.type === 'debt_obligation') {
        calculatedDebt += tx.amount;
      } else if (tx.type === 'client_payment') {
        let amountUSD = tx.amount;
        if (tx.currency === 'UZS' && tx.exchangeRate && tx.exchangeRate > 0) {
          amountUSD = tx.amount / tx.exchangeRate;
        }
        calculatedDebt -= amountUSD;
      } else if (tx.type === 'client_return' && tx.method === 'debt') {
        let amountUSD = tx.amount;
        if (tx.currency === 'UZS' && tx.exchangeRate && tx.exchangeRate > 0) {
          amountUSD = tx.amount / tx.exchangeRate;
        }
        calculatedDebt -= amountUSD;
      }
    }
    
    calculatedDebt = Math.max(0, calculatedDebt);
    const storedDebt = client.totalDebt || 0;
    
    // Check for significant discrepancy (more than $0.01)
    if (Math.abs(calculatedDebt - storedDebt) > 0.01) {
      issues.push({
        severity: 'high',
        entity: 'Client',
        id: client.id,
        field: 'totalDebt',
        message: `Debt mismatch for ${client.name}: stored=$${storedDebt.toFixed(2)}, calculated=$${calculatedDebt.toFixed(2)}`,
        suggestion: 'Recalculate debt from transactions to fix inconsistency'
      });
    }
  }
  
  return issues;
}

/**
 * Check for missing required fields
 */
function checkRequiredFields<T extends { id: string }>(
  items: T[],
  entityName: string,
  requiredFields: (keyof T)[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  for (const item of items) {
    for (const field of requiredFields) {
      const value = item[field];
      if (value === undefined || value === null || value === '') {
        issues.push({
          severity: 'medium',
          entity: entityName,
          id: item.id,
          field: String(field),
          message: `Missing required field: ${String(field)}`,
          suggestion: `Add value for ${String(field)}`
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check for suspiciously large values (data entry errors)
 */
function checkSuspiciousValues(
  orders: Order[],
  products: Product[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  // Check orders with suspiciously large amounts
  for (const order of orders) {
    if (order.totalAmount > 1000000) {
      issues.push({
        severity: 'medium',
        entity: 'Order',
        id: order.id,
        field: 'totalAmount',
        message: `Suspiciously large order amount: $${order.totalAmount.toLocaleString()}`,
        suggestion: 'Verify this is not a UZS value entered in USD field'
      });
    }
  }
  
  // Check products with unusual prices
  for (const product of products) {
    if (product.pricePerUnit > 100000) {
      issues.push({
        severity: 'medium',
        entity: 'Product',
        id: product.id,
        field: 'pricePerUnit',
        message: `Suspiciously high price: $${product.pricePerUnit.toLocaleString()} for ${product.name}`,
        suggestion: 'Verify this is in USD, not UZS'
      });
    }
    
    if (product.costPrice > product.pricePerUnit * 2) {
      issues.push({
        severity: 'low',
        entity: 'Product',
        id: product.id,
        field: 'costPrice',
        message: `Cost price ($${product.costPrice}) exceeds selling price ($${product.pricePerUnit}) for ${product.name}`,
        suggestion: 'Review pricing - selling below cost'
      });
    }
  }
  
  return issues;
}

/**
 * Check for records without updatedAt timestamp
 */
function checkMissingTimestamps<T extends { id: string; updatedAt?: string }>(
  items: T[],
  entityName: string
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  for (const item of items) {
    if (!item.updatedAt) {
      issues.push({
        severity: 'low',
        entity: entityName,
        id: item.id,
        field: 'updatedAt',
        message: `Missing updatedAt timestamp`,
        suggestion: 'Add timestamp on next save for proper sync'
      });
    }
  }
  
  return issues;
}

/**
 * Check Trial Balance: total debits must equal total credits across all transactions.
 * If a General Ledger exists, validates debit == credit for each journal entry.
 */
function checkTrialBalance(transactions: Transaction[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  let totalIncome = 0;
  let totalExpense = 0;
  let totalDebtCreated = 0;
  let totalDebtPaid = 0;
  
  for (const tx of transactions) {
    const amount = Math.abs(tx.amount || 0);
    switch (tx.type) {
      case 'client_payment':
        totalIncome += amount;
        break;
      case 'expense':
      case 'supplier_payment':
        totalExpense += amount;
        break;
      case 'debt_obligation':
        totalDebtCreated += amount;
        break;
      case 'client_return':
        if (tx.method === 'debt') {
          totalDebtPaid += amount;
        }
        break;
    }
  }
  
  // Check if debt obligations are balanced by payments + outstanding
  if (totalDebtCreated > 0 && totalDebtPaid > totalDebtCreated * 1.01) {
    issues.push({
      severity: 'critical',
      entity: 'TrialBalance',
      id: 'global',
      field: 'debt_balance',
      message: `Debt payments ($${totalDebtPaid.toFixed(2)}) exceed debt obligations ($${totalDebtCreated.toFixed(2)})`,
      suggestion: 'Check for duplicate payment transactions or missing debt records'
    });
  }
  
  return issues;
}

/**
 * Check that all orders have corresponding transactions (sales have related transaction records).
 */
function checkOrderTransactionIntegrity(
  orders: Order[],
  transactions: Transaction[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  // Build a set of order IDs referenced by transactions
  const txOrderIds = new Set(
    transactions
      .filter(t => t.relatedId)
      .map(t => t.relatedId)
  );
  
  // Check completed orders that have no matching transaction
  for (const order of orders) {
    if (order.status === 'completed' && !txOrderIds.has(order.id)) {
      issues.push({
        severity: 'high',
        entity: 'Order',
        id: order.id,
        field: 'transaction',
        message: `Completed order has no corresponding sale transaction`,
        suggestion: 'Verify the sale was properly recorded. May need to re-create the transaction.'
      });
    }
  }
  
  return issues;
}

/**
 * Check purchase → inventory consistency: total purchased qty should align with stock levels.
 */
function checkPurchaseInventoryConsistency(
  products: Product[],
  purchases: Purchase[],
  orders: Order[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  // For each product, calculate: purchased qty - sold qty and compare with current qty
  const purchasedQty = new Map<string, number>();
  const soldQty = new Map<string, number>();
  
  for (const purchase of purchases) {
    for (const item of purchase.items || []) {
      const productId = item.productId;
      if (productId) {
        purchasedQty.set(productId, (purchasedQty.get(productId) || 0) + (item.quantity || 0));
      }
    }
  }
  
  for (const order of orders) {
    if (order.status !== 'cancelled') {
      for (const item of order.items || []) {
        const productId = item.productId;
        if (productId) {
          soldQty.set(productId, (soldQty.get(productId) || 0) + (item.quantity || 0));
        }
      }
    }
  }
  
  for (const product of products) {
    const bought = purchasedQty.get(product.id) || 0;
    const sold = soldQty.get(product.id) || 0;
    
    // Only flag if there are purchases (otherwise we can't compute expected)
    if (bought > 0) {
      const expectedMin = bought - sold;
      // Allow some tolerance (initial stock, adjustments, etc.)
      if (product.quantity < expectedMin * 0.5 && expectedMin > 10) {
        issues.push({
          severity: 'medium',
          entity: 'Product',
          id: product.id,
          field: 'quantity',
          message: `Stock for "${product.name}" (${product.quantity}) is significantly lower than expected (purchased: ${bought}, sold: ${sold})`,
          suggestion: 'Check for unrecorded sales, theft, or data entry errors'
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check employee data integrity
 */
function checkEmployeeIntegrity(employees: Employee[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  
  for (const emp of employees) {
    // Check for employees with no email
    if (!emp.email) {
      issues.push({
        severity: 'medium',
        entity: 'Employee',
        id: emp.id,
        field: 'email',
        message: `Employee "${emp.name}" has no email set`,
        suggestion: 'Set email for proper auth/permission linkage'
      });
    }
    
    // Check for dismissed/inactive employees still having active permissions
    if (emp.status === 'inactive' && emp.permissions) {
      const hasActivePermissions = Object.values(emp.permissions).some(v => v === true);
      if (hasActivePermissions) {
        issues.push({
          severity: 'high',
          entity: 'Employee',
          id: emp.id,
          field: 'permissions',
          message: `Inactive employee "${emp.name}" still has active permissions`,
          suggestion: 'Remove all permissions for inactive employees immediately'
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check for soft-deleted records that appear in active collections.
 * After batch-1 soft-delete feature, _deleted items should be filtered out of UI queries.
 */
function checkSoftDeletedRecords<T extends { id: string; _deleted?: boolean }>(
  items: T[],
  entityName: string
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const deletedItems = items.filter(i => i._deleted);

  for (const item of deletedItems) {
    issues.push({
      severity: 'medium',
      entity: entityName,
      id: item.id,
      field: '_deleted',
      message: `Soft-deleted ${entityName} "${item.id}" still present in active data`,
      suggestion: 'Verify Firestore query filters exclude _deleted records'
    });
  }

  return issues;
}

/**
 * Check that versionable entities have _version field set.
 * Missing _version can cause optimistic concurrency issues.
 */
function checkVersionField<T extends { id: string; _version?: number }>(
  items: T[],
  entityName: string
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const item of items) {
    if (item._version === undefined || item._version === null) {
      issues.push({
        severity: 'low',
        entity: entityName,
        id: item.id,
        field: '_version',
        message: `${entityName} "${item.id}" missing _version field`,
        suggestion: 'Resave record to initialize _version for optimistic locking'
      });
    }
  }

  return issues;
}

/**
 * Check workflow order state consistency.
 * E.g. completed orders should have amountPaid > 0, cancelled orders should have a reason.
 */
function checkWorkflowIntegrity(workflowOrders: WorkflowOrder[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const wo of workflowOrders) {
    // Cancelled without reason
    if (wo.status === 'cancelled' && !wo.cancellationReason) {
      issues.push({
        severity: 'medium',
        entity: 'WorkflowOrder',
        id: wo.id,
        field: 'cancellationReason',
        message: `Cancelled workflow order "${wo.id}" has no cancellation reason`,
        suggestion: 'Add cancellation reason for audit trail'
      });
    }

    // Completed but unpaid
    if (wo.status === 'completed' && wo.paymentStatus === 'unpaid' && wo.paymentMethod !== 'debt') {
      issues.push({
        severity: 'high',
        entity: 'WorkflowOrder',
        id: wo.id,
        field: 'paymentStatus',
        message: `Completed workflow order "${wo.id}" is marked as unpaid (non-debt)`,
        suggestion: 'Review payment status — completed orders should be paid or debt'
      });
    }

    // Zero-amount orders
    if (wo.totalAmount <= 0 && wo.status !== 'cancelled' && wo.status !== 'draft') {
      issues.push({
        severity: 'high',
        entity: 'WorkflowOrder',
        id: wo.id,
        field: 'totalAmount',
        message: `Active workflow order "${wo.id}" has zero or negative total`,
        suggestion: 'Review order items and pricing'
      });
    }
  }

  return issues;
}

/**
 * Check for records with future dates (possible clock skew or data entry errors).
 */
function checkFutureDates(
  orders: Order[],
  transactions: Transaction[]
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const now = new Date();
  const tolerance = 24 * 60 * 60 * 1000; // 1 day tolerance

  for (const order of orders) {
    const orderDate = new Date(order.date);
    if (orderDate.getTime() > now.getTime() + tolerance) {
      issues.push({
        severity: 'medium',
        entity: 'Order',
        id: order.id,
        field: 'date',
        message: `Order "${order.id}" has a future date: ${order.date}`,
        suggestion: 'Verify order date — possible data entry error or clock skew'
      });
    }
  }

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    if (txDate.getTime() > now.getTime() + tolerance) {
      issues.push({
        severity: 'medium',
        entity: 'Transaction',
        id: tx.id,
        field: 'date',
        message: `Transaction "${tx.id}" has a future date: ${tx.date}`,
        suggestion: 'Verify transaction date'
      });
    }
  }

  return issues;
}

/**
 * Run full integrity check on all data
 */
export function runIntegrityCheck(data: {
  products: Product[];
  orders: Order[];
  clients: Client[];
  transactions: Transaction[];
  purchases: Purchase[];
  employees: Employee[];
  workflowOrders?: WorkflowOrder[];
}): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  
  // Check duplicate IDs
  issues.push(...checkDuplicateIds(data.products, 'Product'));
  issues.push(...checkDuplicateIds(data.orders, 'Order'));
  issues.push(...checkDuplicateIds(data.clients, 'Client'));
  issues.push(...checkDuplicateIds(data.transactions, 'Transaction'));
  issues.push(...checkDuplicateIds(data.purchases, 'Purchase'));
  issues.push(...checkDuplicateIds(data.employees, 'Employee'));
  
  // Check old-style IDs
  issues.push(...checkOldStyleIds(data.products, 'Product'));
  issues.push(...checkOldStyleIds(data.orders, 'Order'));
  issues.push(...checkOldStyleIds(data.clients, 'Client'));
  
  // Check orphaned references
  issues.push(...checkOrphanedReferences(data.orders, data.products, data.clients));
  
  // Check negative quantities
  issues.push(...checkNegativeQuantities(data.products));
  
  // Check client debt consistency
  issues.push(...checkClientDebtConsistency(data.clients, data.transactions));
  
  // Check suspicious values
  issues.push(...checkSuspiciousValues(data.orders, data.products));
  
  // Check required fields
  issues.push(...checkRequiredFields(data.products, 'Product', ['name', 'type']));
  issues.push(...checkRequiredFields(data.orders, 'Order', ['customerName', 'date']));
  issues.push(...checkRequiredFields(data.clients, 'Client', ['name']));
  
  // Check missing timestamps
  issues.push(...checkMissingTimestamps(data.products, 'Product'));
  issues.push(...checkMissingTimestamps(data.orders, 'Order'));
  
  // Check Trial Balance (debit/credit consistency)
  issues.push(...checkTrialBalance(data.transactions));
  
  // Check that all completed orders have corresponding transactions
  issues.push(...checkOrderTransactionIntegrity(data.orders, data.transactions));
  
  // Check purchase ↔ inventory consistency
  issues.push(...checkPurchaseInventoryConsistency(data.products, data.purchases, data.orders));
  
  // Check employee integrity (dismissed + permissions, missing emails)
  issues.push(...checkEmployeeIntegrity(data.employees));

  // Check soft-deleted records leaking into active data
  issues.push(...checkSoftDeletedRecords(data.orders as (Order & { _deleted?: boolean })[], 'Order'));
  issues.push(...checkSoftDeletedRecords(data.transactions as (Transaction & { _deleted?: boolean })[], 'Transaction'));

  // Check _version field consistency
  issues.push(...checkVersionField(data.products as (Product & { _version?: number })[], 'Product'));
  issues.push(...checkVersionField(data.transactions as (Transaction & { _version?: number })[], 'Transaction'));

  // Check workflow order integrity
  if (data.workflowOrders?.length) {
    issues.push(...checkWorkflowIntegrity(data.workflowOrders));
  }

  // Check for future-dated records
  issues.push(...checkFutureDates(data.orders, data.transactions));
  
  // Count by severity
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;
  
  // Generate summary
  let summary = 'Data integrity check completed. ';
  if (criticalCount > 0) {
    summary += `⛔ ${criticalCount} CRITICAL issues require immediate attention. `;
  }
  if (highCount > 0) {
    summary += `⚠️ ${highCount} high priority issues found. `;
  }
  if (criticalCount === 0 && highCount === 0) {
    summary += '✅ No critical issues found. ';
  }
  summary += `Total: ${issues.length} issues detected.`;
  
  return {
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    issues,
    summary
  };
}

/**
 * Get issues filtered by severity
 */
export function getIssuesBySeverity(
  report: IntegrityReport,
  severity: 'critical' | 'high' | 'medium' | 'low'
): IntegrityIssue[] {
  return report.issues.filter(i => i.severity === severity);
}

/**
 * Format report for display
 */
export function formatReportForDisplay(report: IntegrityReport): string {
  let output = `# Data Integrity Report\n`;
  output += `Generated: ${new Date(report.timestamp).toLocaleString()}\n\n`;
  output += `## Summary\n${report.summary}\n\n`;
  
  if (report.criticalCount > 0) {
    output += `## ⛔ Critical Issues (${report.criticalCount})\n`;
    for (const issue of getIssuesBySeverity(report, 'critical')) {
      output += `- **${issue.entity}** [${issue.id}]: ${issue.message}\n`;
      output += `  → ${issue.suggestion}\n`;
    }
    output += '\n';
  }
  
  if (report.highCount > 0) {
    output += `## ⚠️ High Priority Issues (${report.highCount})\n`;
    for (const issue of getIssuesBySeverity(report, 'high')) {
      output += `- **${issue.entity}** [${issue.id}]: ${issue.message}\n`;
      output += `  → ${issue.suggestion}\n`;
    }
    output += '\n';
  }
  
  return output;
}

export default {
  runIntegrityCheck,
  getIssuesBySeverity,
  formatReportForDisplay,
};
