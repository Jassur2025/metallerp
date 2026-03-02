/**
 * Unit tests for idempotency utility functions.
 *
 * Tests the pure validation logic and document structure.
 * Integration tests (actual Firestore reads/writes inside transactions)
 * require the Firebase emulator and are covered by E2E.
 */
import { describe, it, expect } from "vitest";
import { isValidRequestId } from "../utils/idempotency";

describe("isValidRequestId", () => {
  it("accepts valid UUID v4", () => {
    expect(isValidRequestId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidRequestId("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isValidRequestId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("accepts case-insensitive UUIDs", () => {
    expect(isValidRequestId("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    expect(isValidRequestId("550e8400-E29B-41d4-A716-446655440000")).toBe(true);
  });

  it("rejects non-string values", () => {
    expect(isValidRequestId(undefined)).toBe(false);
    expect(isValidRequestId(null)).toBe(false);
    expect(isValidRequestId(123)).toBe(false);
    expect(isValidRequestId({})).toBe(false);
    expect(isValidRequestId([])).toBe(false);
    expect(isValidRequestId(true)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRequestId("")).toBe(false);
  });

  it("rejects malformed UUIDs", () => {
    // Missing section
    expect(isValidRequestId("550e8400-e29b-41d4-a716")).toBe(false);
    // Extra section
    expect(isValidRequestId("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
    // Wrong separators
    expect(isValidRequestId("550e8400_e29b_41d4_a716_446655440000")).toBe(false);
    // No separators
    expect(isValidRequestId("550e8400e29b41d4a716446655440000")).toBe(false);
    // Too short segment
    expect(isValidRequestId("550e840-e29b-41d4-a716-446655440000")).toBe(false);
    // Non-hex characters
    expect(isValidRequestId("550e8400-e29b-41d4-a716-44665544000g")).toBe(false);
  });

  it("rejects random strings", () => {
    expect(isValidRequestId("hello-world")).toBe(false);
    expect(isValidRequestId("ORD-ABC123-XYZ")).toBe(false);
    expect(isValidRequestId("not-a-uuid-at-all")).toBe(false);
  });

  it("rejects strings with surrounding whitespace", () => {
    expect(isValidRequestId(" 550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isValidRequestId("550e8400-e29b-41d4-a716-446655440000 ")).toBe(false);
  });
});
