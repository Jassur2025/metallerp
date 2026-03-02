/**
 * Shared validation utilities for Cloud Functions.
 * Server-side validation — NEVER trust client input.
 */

export function assertString(val: unknown, field: string): asserts val is string {
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

export function assertPositiveNumber(val: unknown, field: string): asserts val is number {
  if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
    throw new Error(`${field} must be a positive number, got ${val}`);
  }
}

export function assertNonNegativeNumber(val: unknown, field: string): asserts val is number {
  if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
    throw new Error(`${field} must be a non-negative number, got ${val}`);
  }
}

export function assertArray(val: unknown, field: string): asserts val is unknown[] {
  if (!Array.isArray(val) || val.length === 0) {
    throw new Error(`${field} must be a non-empty array`);
  }
}

export function assertOneOf<T extends string>(
  val: unknown,
  allowed: readonly T[],
  field: string,
): asserts val is T {
  if (!allowed.includes(val as T)) {
    throw new Error(`${field} must be one of [${allowed.join(", ")}], got ${val}`);
  }
}

/** Safely parse a number, returning 0 for non-finite values */
export const safeNum = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Round to 2 decimal places */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
