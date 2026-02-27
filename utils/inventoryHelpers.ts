import type { OrderItem, Product } from '../types';

/**
 * A row describing missing inventory for a given order item.
 */
export interface MissingItemRow {
  /** The order item missing from stock */
  item: OrderItem;
  /** Currently available quantity in stock */
  available: number;
  /** How many units are short (need − available, ≥ 0) */
  missingQty: number;
}

/**
 * Check which order items cannot be fully fulfilled from current stock.
 *
 * Shared across Sales, Procurement, and Workflow modules.
 *
 * @param items   - order items to check
 * @param products - current product inventory
 * @returns array of rows for items that are partially or fully out of stock
 */
export function getMissingItems(items: OrderItem[], products: Product[]): MissingItemRow[] {
  const missing: MissingItemRow[] = [];

  items.forEach(it => {
    const p = products.find(pp => pp.id === it.productId);
    const available = p?.quantity ?? 0;
    const missingQty = Math.max(0, it.quantity - available);

    if (!p || missingQty > 0) {
      missing.push({ item: it, available, missingQty });
    }
  });

  return missing;
}
