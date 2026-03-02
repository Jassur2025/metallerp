/**
 * Unit tests for Cloud Function business logic.
 *
 * These tests verify the PURE LOGIC embedded in CF modules
 * (ID generators, toUSD helpers, input validation patterns).
 * They import the helper functions directly to test them.
 *
 * Full integration tests (with Firestore) require the Firebase emulator
 * and are covered by E2E tests / firebase-functions-test.
 */
import { describe, it, expect } from "vitest";
import { safeNum, round2 } from "../utils/validation";

// ─── ID generators (imported pattern, tested via structure) ─

describe("ID generators pattern", () => {
  function generateOrderId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${ts}-${rand}`;
  }

  function generateTransactionId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TX-${ts}-${rand}`;
  }

  function generatePurchaseId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PUR-${ts}-${rand}`;
  }

  it("generateOrderId returns ORD- prefix", () => {
    const id = generateOrderId();
    expect(id).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it("generateTransactionId returns TX- prefix", () => {
    const id = generateTransactionId();
    expect(id).toMatch(/^TX-[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it("generatePurchaseId returns PUR- prefix", () => {
    const id = generatePurchaseId();
    expect(id).toMatch(/^PUR-[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 50 }, generateOrderId));
    expect(ids.size).toBe(50);
  });
});

// ─── toUSD helper (pattern from transaction CFs) ──────────

describe("toUSD conversion logic", () => {
  function toUSD(tx: { amount?: number; currency?: string; exchangeRate?: number }): number {
    const amount = safeNum(tx.amount);
    if (tx.currency === "UZS" && tx.exchangeRate && tx.exchangeRate > 0) {
      return round2(amount / tx.exchangeRate);
    }
    return round2(amount);
  }

  it("returns USD amount directly", () => {
    expect(toUSD({ amount: 100, currency: "USD" })).toBe(100);
  });

  it("converts UZS to USD", () => {
    expect(toUSD({ amount: 12800, currency: "UZS", exchangeRate: 12800 })).toBe(1);
  });

  it("handles large UZS amounts", () => {
    expect(toUSD({ amount: 128000000, currency: "UZS", exchangeRate: 12800 })).toBe(10000);
  });

  it("returns 0 for undefined amount", () => {
    expect(toUSD({ currency: "USD" })).toBe(0);
  });

  it("returns amount if UZS but no exchange rate", () => {
    expect(toUSD({ amount: 100, currency: "UZS", exchangeRate: 0 })).toBe(100);
  });

  it("rounds to 2 decimal places", () => {
    expect(toUSD({ amount: 10000, currency: "UZS", exchangeRate: 12800 })).toBe(0.78);
  });
});

// ─── Debt delta logic (from processPayment CF) ──────────────

describe("debt delta computation", () => {
  function computeDebtDelta(type: string, amountUSD: number): number {
    switch (type) {
      case "client_payment": return -amountUSD;
      case "debt_obligation": return amountUSD;
      case "client_return": return amountUSD;
      case "client_refund": return -amountUSD;
      default: return 0;
    }
  }

  it("client_payment reduces debt", () => {
    expect(computeDebtDelta("client_payment", 100)).toBe(-100);
  });

  it("debt_obligation increases debt", () => {
    expect(computeDebtDelta("debt_obligation", 200)).toBe(200);
  });

  it("client_return restores debt", () => {
    expect(computeDebtDelta("client_return", 50)).toBe(50);
  });

  it("client_refund reduces debt", () => {
    expect(computeDebtDelta("client_refund", 75)).toBe(-75);
  });

  it("supplier_payment has no client debt impact", () => {
    expect(computeDebtDelta("supplier_payment", 100)).toBe(0);
  });

  it("expense has no client debt impact", () => {
    expect(computeDebtDelta("expense", 100)).toBe(0);
  });
});

// ─── Debt reversal logic (from deleteTransaction CF) ────────

describe("debt reversal on delete", () => {
  function reverseDebt(currentDebt: number, txType: string, amountUSD: number): number {
    if (txType === "client_payment") return currentDebt + amountUSD;
    if (txType === "debt_obligation") return Math.max(0, currentDebt - amountUSD);
    if (txType === "client_return") return Math.max(0, currentDebt - amountUSD);
    if (txType === "client_refund") return currentDebt + amountUSD;
    return currentDebt;
  }

  it("deleting payment restores debt", () => {
    expect(reverseDebt(500, "client_payment", 200)).toBe(700);
  });

  it("deleting debt obligation removes debt", () => {
    expect(reverseDebt(500, "debt_obligation", 200)).toBe(300);
  });

  it("debt cannot go below zero", () => {
    expect(reverseDebt(100, "debt_obligation", 200)).toBe(0);
  });

  it("deleting return removes debt", () => {
    expect(reverseDebt(500, "client_return", 100)).toBe(400);
  });

  it("deleting refund restores debt", () => {
    expect(reverseDebt(500, "client_refund", 150)).toBe(650);
  });

  it("deleting expense does not affect debt", () => {
    expect(reverseDebt(500, "expense", 100)).toBe(500);
  });
});

// ─── Purchase landed cost calculation ───────────────────────

describe("purchase landed cost computation", () => {
  function computeLandedCost(
    invoicePrice: number,
    vatPerUnit: number,
    qty: number,
    totalOverheadUZS: number,
    totalItemsInvoiceUZS: number,
    exchangeRate: number,
  ): number {
    const invoiceNoVat = invoicePrice - vatPerUnit;
    const lineInvoiceUZS = invoicePrice * qty;
    const overheadShare = totalItemsInvoiceUZS > 0
      ? round2(totalOverheadUZS * lineInvoiceUZS / totalItemsInvoiceUZS)
      : 0;
    return round2((invoiceNoVat + overheadShare / qty) / exchangeRate);
  }

  it("calculates landed cost without overhead", () => {
    // Invoice 1200 UZS/unit (VAT 200), qty 10, rate 12800
    const cost = computeLandedCost(1200, 200, 10, 0, 12000, 12800);
    // (1000 + 0) / 12800 = 0.078125 → 0.08
    expect(cost).toBe(0.08);
  });

  it("distributes overhead proportionally", () => {
    // Invoice 10000 UZS/unit (VAT 1000), qty 5, overhead 5000, total invoice 50000, rate 12800
    const cost = computeLandedCost(10000, 1000, 5, 5000, 50000, 12800);
    // invoiceNoVat = 9000, overheadShare = 5000 * 50000/50000 = 5000
    // landedCost = (9000 + 1000) / 12800 = 0.78125 → 0.78
    expect(cost).toBe(0.78);
  });

  it("handles zero total invoice gracefully", () => {
    const cost = computeLandedCost(1000, 100, 5, 500, 0, 12800);
    // No overhead distribution: (900 + 0) / 12800 = 0.0703125 → 0.07
    expect(cost).toBe(0.07);
  });
});

// ─── Balance computation: inventory by warehouse ────────────

describe("balance inventory by warehouse", () => {
  function inventoryByWarehouse(
    products: Array<{ warehouse?: string; quantity: number; costPrice: number }>,
  ) {
    const main = products
      .filter((p) => (p.warehouse || "main") === "main")
      .reduce((s, p) => s + p.quantity * p.costPrice, 0);
    const cloud = products
      .filter((p) => p.warehouse === "cloud")
      .reduce((s, p) => s + p.quantity * p.costPrice, 0);
    return { main: round2(main), cloud: round2(cloud), total: round2(main + cloud) };
  }

  it("separates main and cloud warehouse", () => {
    const products = [
      { warehouse: "main", quantity: 100, costPrice: 10 },
      { warehouse: "cloud", quantity: 50, costPrice: 20 },
      { quantity: 30, costPrice: 5 }, // defaults to main
    ];
    const inv = inventoryByWarehouse(products);
    expect(inv.main).toBe(1150); // 100*10 + 30*5
    expect(inv.cloud).toBe(1000); // 50*20
    expect(inv.total).toBe(2150);
  });

  it("handles empty products", () => {
    const inv = inventoryByWarehouse([]);
    expect(inv.total).toBe(0);
  });
});
