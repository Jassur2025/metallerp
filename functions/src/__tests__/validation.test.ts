/**
 * Unit tests for CF validation utilities.
 * Pure functions — no Firebase mocks needed.
 */
import { describe, it, expect } from "vitest";
import {
  assertString,
  assertPositiveNumber,
  assertNonNegativeNumber,
  assertArray,
  assertOneOf,
  safeNum,
  round2,
} from "../utils/validation";

describe("safeNum", () => {
  it("returns number for valid number", () => {
    expect(safeNum(42)).toBe(42);
  });
  it("returns 0 for NaN", () => {
    expect(safeNum(NaN)).toBe(0);
  });
  it("returns 0 for Infinity", () => {
    expect(safeNum(Infinity)).toBe(0);
  });
  it("parses string numbers", () => {
    expect(safeNum("123.45")).toBe(123.45);
  });
  it("returns 0 for non-numeric string", () => {
    expect(safeNum("abc")).toBe(0);
  });
  it("returns 0 for undefined", () => {
    expect(safeNum(undefined)).toBe(0);
  });
  it("returns 0 for null", () => {
    expect(safeNum(null)).toBe(0);
  });
  it("returns 0 for object", () => {
    expect(safeNum({})).toBe(0);
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.005)).toBe(1);
    expect(round2(1.555)).toBe(1.56);
    expect(round2(100.999)).toBe(101);
  });
  it("handles negative numbers", () => {
    expect(round2(-1.555)).toBe(-1.55);
  });
  it("handles zero", () => {
    expect(round2(0)).toBe(0);
  });
  it("handles whole numbers", () => {
    expect(round2(42)).toBe(42);
  });
});

describe("assertString", () => {
  it("passes for valid string", () => {
    expect(() => assertString("hello", "test")).not.toThrow();
  });
  it("throws for empty string", () => {
    expect(() => assertString("", "test")).toThrow("test must be a non-empty string");
  });
  it("throws for whitespace-only string", () => {
    expect(() => assertString("   ", "test")).toThrow("test must be a non-empty string");
  });
  it("throws for number", () => {
    expect(() => assertString(42 as any, "test")).toThrow();
  });
  it("throws for null", () => {
    expect(() => assertString(null as any, "test")).toThrow();
  });
});

describe("assertPositiveNumber", () => {
  it("passes for positive number", () => {
    expect(() => assertPositiveNumber(1, "test")).not.toThrow();
    expect(() => assertPositiveNumber(0.001, "test")).not.toThrow();
  });
  it("throws for zero", () => {
    expect(() => assertPositiveNumber(0, "test")).toThrow();
  });
  it("throws for negative", () => {
    expect(() => assertPositiveNumber(-1, "test")).toThrow();
  });
  it("throws for NaN", () => {
    expect(() => assertPositiveNumber(NaN, "test")).toThrow();
  });
  it("throws for string", () => {
    expect(() => assertPositiveNumber("5" as any, "test")).toThrow();
  });
});

describe("assertNonNegativeNumber", () => {
  it("passes for zero", () => {
    expect(() => assertNonNegativeNumber(0, "test")).not.toThrow();
  });
  it("passes for positive", () => {
    expect(() => assertNonNegativeNumber(100, "test")).not.toThrow();
  });
  it("throws for negative", () => {
    expect(() => assertNonNegativeNumber(-0.01, "test")).toThrow();
  });
});

describe("assertArray", () => {
  it("passes for non-empty array", () => {
    expect(() => assertArray([1], "test")).not.toThrow();
  });
  it("throws for empty array", () => {
    expect(() => assertArray([], "test")).toThrow("test must be a non-empty array");
  });
  it("throws for non-array", () => {
    expect(() => assertArray("string" as any, "test")).toThrow();
  });
  it("throws for null", () => {
    expect(() => assertArray(null as any, "test")).toThrow();
  });
});

describe("assertOneOf", () => {
  it("passes for valid value", () => {
    expect(() => assertOneOf("cash", ["cash", "bank", "card"] as const, "method")).not.toThrow();
  });
  it("throws for invalid value", () => {
    expect(() => assertOneOf("crypto", ["cash", "bank", "card"] as const, "method")).toThrow(
      /method must be one of/,
    );
  });
});
