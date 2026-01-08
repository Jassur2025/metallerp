/**
 * Data Integrity Monitor
 * 
 * Provides utilities to detect and report data integrity issues
 * in the ERP system. Run periodically to catch corruption early.
 */

import { Product, Order, Client, Transaction, Purchase, Employee } from '../types';

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
 * Run full integrity check on all data
 */
export function runIntegrityCheck(data: {
  products: Product[];
  orders: Order[];
  clients: Client[];
  transactions: Transaction[];
  purchases: Purchase[];
  employees: Employee[];
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
