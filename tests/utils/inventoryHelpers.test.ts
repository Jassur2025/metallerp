/**
 * Tests for utils/inventoryHelpers.ts
 *
 * getMissingItems — checks which order items cannot be fulfilled from stock.
 */
import { describe, it, expect } from 'vitest';
import { getMissingItems } from '../../utils/inventoryHelpers';
import type { OrderItem, Product } from '../../types';
import { Unit, ProductType } from '../../types';

// ---------- Factories ----------
const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Test Product',
  type: ProductType.PIPE,
  dimensions: '100x50',
  steelGrade: 'Ст3',
  quantity: 10,
  unit: Unit.METER,
  pricePerUnit: 100,
  costPrice: 80,
  minStockLevel: 0,
  ...overrides,
});

const makeItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  productId: 'p1',
  productName: 'Test Product',
  quantity: 5,
  priceAtSale: 100,
  costAtSale: 80,
  total: 500,
  unit: Unit.METER,
  ...overrides,
});

// ---------- Tests ----------
describe('getMissingItems', () => {
  it('returns empty array when all items are in stock', () => {
    const products = [makeProduct({ id: 'p1', quantity: 10 })];
    const items = [makeItem({ productId: 'p1', quantity: 5 })];
    expect(getMissingItems(items, products)).toEqual([]);
  });

  it('returns empty array when items exactly equal stock', () => {
    const products = [makeProduct({ id: 'p1', quantity: 5 })];
    const items = [makeItem({ productId: 'p1', quantity: 5 })];
    expect(getMissingItems(items, products)).toEqual([]);
  });

  it('returns missing row when demand exceeds stock', () => {
    const products = [makeProduct({ id: 'p1', quantity: 3 })];
    const items = [makeItem({ productId: 'p1', quantity: 7 })];
    const result = getMissingItems(items, products);
    expect(result).toHaveLength(1);
    expect(result[0].item.productId).toBe('p1');
    expect(result[0].available).toBe(3);
    expect(result[0].missingQty).toBe(4);
  });

  it('returns missing row when product not found', () => {
    const products: Product[] = [];
    const items = [makeItem({ productId: 'nonexistent', quantity: 2 })];
    const result = getMissingItems(items, products);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(0);
    expect(result[0].missingQty).toBe(2);
  });

  it('returns missing row when product has zero stock', () => {
    const products = [makeProduct({ id: 'p1', quantity: 0 })];
    const items = [makeItem({ productId: 'p1', quantity: 3 })];
    const result = getMissingItems(items, products);
    expect(result).toHaveLength(1);
    expect(result[0].missingQty).toBe(3);
  });

  it('handles multiple items — some missing, some not', () => {
    const products = [
      makeProduct({ id: 'p1', quantity: 10 }),
      makeProduct({ id: 'p2', quantity: 2 }),
      makeProduct({ id: 'p3', quantity: 0 }),
    ];
    const items = [
      makeItem({ productId: 'p1', quantity: 5 }),  // In stock
      makeItem({ productId: 'p2', quantity: 8 }),  // Missing 6
      makeItem({ productId: 'p3', quantity: 1 }),  // Missing 1
    ];
    const result = getMissingItems(items, products);
    expect(result).toHaveLength(2);
    expect(result[0].item.productId).toBe('p2');
    expect(result[0].missingQty).toBe(6);
    expect(result[1].item.productId).toBe('p3');
    expect(result[1].missingQty).toBe(1);
  });

  it('returns empty array for empty items list', () => {
    const products = [makeProduct()];
    expect(getMissingItems([], products)).toEqual([]);
  });

  it('returns empty array when items and products are both empty', () => {
    expect(getMissingItems([], [])).toEqual([]);
  });

  it('preserves the full OrderItem in the result', () => {
    const products = [makeProduct({ id: 'p1', quantity: 2 })];
    const item = makeItem({ productId: 'p1', quantity: 5, productName: 'Steel Pipe', priceAtSale: 200 });
    const result = getMissingItems([item], products);
    expect(result[0].item).toEqual(item);
    expect(result[0].item.productName).toBe('Steel Pipe');
    expect(result[0].item.priceAtSale).toBe(200);
  });
});
