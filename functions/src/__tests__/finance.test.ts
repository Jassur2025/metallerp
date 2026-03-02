/**
 * Unit tests for CF finance utilities.
 * Tests: AccountCode enum, cashAccount, weightedAvgCost, generateSaleLedgerEntries.
 */
import { describe, it, expect } from "vitest";
import {
  AccountCode,
  cashAccount,
  weightedAvgCost,
  generateSaleLedgerEntries,
} from "../utils/finance";

describe("AccountCode enum", () => {
  it("has expected NSBU account codes", () => {
    expect(AccountCode.INVENTORY).toBe("2900");
    expect(AccountCode.CASH_USD).toBe("5010");
    expect(AccountCode.CASH_UZS).toBe("5020");
    expect(AccountCode.BANK_UZS).toBe("5110");
    expect(AccountCode.ACCOUNTS_RECEIVABLE).toBe("4010");
    expect(AccountCode.ACCOUNTS_PAYABLE).toBe("6010");
    expect(AccountCode.REVENUE).toBe("9010");
    expect(AccountCode.COGS).toBe("9110");
    expect(AccountCode.VAT_PAYABLE).toBe("6410");
    expect(AccountCode.VAT_RECEIVABLE).toBe("4410");
  });
});

describe("cashAccount", () => {
  it("returns CASH_USD for cash + USD", () => {
    expect(cashAccount("cash", "USD")).toBe(AccountCode.CASH_USD);
  });
  it("returns CASH_UZS for cash + UZS", () => {
    expect(cashAccount("cash", "UZS")).toBe(AccountCode.CASH_UZS);
  });
  it("returns BANK_UZS for bank payment", () => {
    expect(cashAccount("bank", "USD")).toBe(AccountCode.BANK_UZS);
    expect(cashAccount("bank", "UZS")).toBe(AccountCode.BANK_UZS);
  });
  it("returns BANK_UZS for card payment", () => {
    expect(cashAccount("card")).toBe(AccountCode.BANK_UZS);
  });
  it("defaults to CASH_USD when no currency specified", () => {
    expect(cashAccount("cash")).toBe(AccountCode.CASH_USD);
  });
});

describe("weightedAvgCost", () => {
  it("computes weighted average correctly", () => {
    // 100 units @ $10 + 50 units @ $20 = 150 units @ $13.33
    expect(weightedAvgCost(100, 10, 50, 20)).toBe(13.33);
  });
  it("handles zero old quantity (first purchase)", () => {
    expect(weightedAvgCost(0, 0, 100, 15)).toBe(15);
  });
  it("handles zero total quantity", () => {
    expect(weightedAvgCost(0, 10, 0, 20)).toBe(0);
  });
  it("returns rounded to 2 decimal places", () => {
    // 3 @ $1 + 7 @ $2 = 10 @ $1.70
    expect(weightedAvgCost(3, 1, 7, 2)).toBe(1.7);
  });
  it("handles equal costs", () => {
    expect(weightedAvgCost(50, 10, 50, 10)).toBe(10);
  });
});

describe("generateSaleLedgerEntries", () => {
  const baseInput = {
    orderId: "ORD-TEST",
    customerName: "Test Client",
    date: "2025-01-15T10:00:00.000Z",
    revenueUSD: 1000,
    totalCOGS: 600,
    vatAmount: 120,
    exchangeRate: 12800,
    totalAmountUZS: 12800000,
    paymentMethod: "cash",
    cashPaidUSD: 1000,
    debtUSD: 0,
    paymentCurrency: "USD",
    createdBy: "test@test.com",
  };

  it("generates revenue entry for cash sale", () => {
    const entries = generateSaleLedgerEntries(baseInput);
    const revenueEntry = entries.find((e) => e.creditAccount === AccountCode.REVENUE && e.debitAccount !== AccountCode.REVENUE);
    expect(revenueEntry).toBeTruthy();
    expect(revenueEntry!.debitAccount).toBe(AccountCode.CASH_USD);
    expect(revenueEntry!.amount).toBe(1000);
  });

  it("generates COGS entry", () => {
    const entries = generateSaleLedgerEntries(baseInput);
    const cogsEntry = entries.find((e) => e.debitAccount === AccountCode.COGS);
    expect(cogsEntry).toBeTruthy();
    expect(cogsEntry!.creditAccount).toBe(AccountCode.INVENTORY);
    expect(cogsEntry!.amount).toBe(600);
  });

  it("generates VAT entry", () => {
    const entries = generateSaleLedgerEntries(baseInput);
    const vatEntry = entries.find((e) => e.creditAccount === AccountCode.VAT_PAYABLE);
    expect(vatEntry).toBeTruthy();
    expect(vatEntry!.debitAccount).toBe(AccountCode.REVENUE);
    expect(vatEntry!.amount).toBe(120);
  });

  it("generates debt entry for debt sale", () => {
    const debtInput = {
      ...baseInput,
      paymentMethod: "debt",
      cashPaidUSD: 0,
      debtUSD: 1000,
    };
    const entries = generateSaleLedgerEntries(debtInput);
    const debtEntry = entries.find((e) => e.debitAccount === AccountCode.ACCOUNTS_RECEIVABLE);
    expect(debtEntry).toBeTruthy();
    expect(debtEntry!.amount).toBe(1000);
  });

  it("generates both cash and debt entries for mixed sale", () => {
    const mixedInput = {
      ...baseInput,
      paymentMethod: "mixed",
      cashPaidUSD: 700,
      debtUSD: 300,
    };
    const entries = generateSaleLedgerEntries(mixedInput);
    const cashEntry = entries.find(
      (e) => e.debitAccount === AccountCode.CASH_USD && e.creditAccount === AccountCode.REVENUE,
    );
    const debtEntry = entries.find((e) => e.debitAccount === AccountCode.ACCOUNTS_RECEIVABLE);
    expect(cashEntry).toBeTruthy();
    expect(cashEntry!.amount).toBe(700);
    expect(debtEntry).toBeTruthy();
    expect(debtEntry!.amount).toBe(300);
  });

  it("returns empty array for zero revenue", () => {
    const zeroInput = { ...baseInput, revenueUSD: 0 };
    expect(generateSaleLedgerEntries(zeroInput)).toEqual([]);
  });

  it("uses bank account for bank sale", () => {
    const bankInput = { ...baseInput, paymentMethod: "bank", paymentCurrency: "UZS" };
    const entries = generateSaleLedgerEntries(bankInput);
    const revenueEntry = entries.find((e) => e.creditAccount === AccountCode.REVENUE && e.debitAccount !== AccountCode.REVENUE);
    expect(revenueEntry!.debitAccount).toBe(AccountCode.BANK_UZS);
  });

  it("all entries have required fields", () => {
    const entries = generateSaleLedgerEntries(baseInput);
    for (const entry of entries) {
      expect(entry.date).toBeTruthy();
      expect(entry.debitAccount).toBeTruthy();
      expect(entry.creditAccount).toBeTruthy();
      expect(entry.amount).toBeGreaterThan(0);
      expect(entry.description).toBeTruthy();
      expect(entry.createdBy).toBe("test@test.com");
      expect(entry.relatedType).toBe("order");
      expect(entry.relatedId).toBe("ORD-TEST");
    }
  });
});
