/**
 * Unit tests for pure service functions
 *
 * Covers:
 *  - findOrCreateClient (from clientService)
 *  - transactionService._toUSD
 */

import { describe, it, expect } from 'vitest';
import { findOrCreateClient } from '../../services/clientService';
import { transactionService } from '../../services/transactionService';
import type { Client } from '../../types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'CLI-001',
  name: 'Existing Client',
  phone: '901234567',
  creditLimit: 1000,
  totalPurchases: 0,
  totalDebt: 0,
  ...overrides,
});

// ─── findOrCreateClient ─────────────────────────────────────────────────────

describe('findOrCreateClient', () => {
  it('finds existing client by exact name match', () => {
    const clients = [makeClient()];
    const result = findOrCreateClient(clients, 'Existing Client');
    expect(result.isNew).toBe(false);
    expect(result.client.id).toBe('CLI-001');
    expect(result.index).toBe(0);
  });

  it('finds existing client case-insensitively', () => {
    const clients = [makeClient()];
    const result = findOrCreateClient(clients, 'existing client');
    expect(result.isNew).toBe(false);
    expect(result.client.id).toBe('CLI-001');
  });

  it('finds existing client with UPPERCASE', () => {
    const clients = [makeClient()];
    const result = findOrCreateClient(clients, 'EXISTING CLIENT');
    expect(result.isNew).toBe(false);
  });

  it('creates new client when not found', () => {
    const clients = [makeClient()];
    const result = findOrCreateClient(clients, 'New Person', '998901111111');
    expect(result.isNew).toBe(true);
    expect(result.client.name).toBe('New Person');
    expect(result.client.phone).toBe('998901111111');
    expect(result.client.id).toMatch(/^CLI-/);
    expect(result.clients).toHaveLength(2);
    expect(result.index).toBe(1);
  });

  it('new client has default values', () => {
    const result = findOrCreateClient([], 'Test');
    expect(result.client.creditLimit).toBe(0);
    expect(result.client.totalPurchases).toBe(0);
    expect(result.client.totalDebt).toBe(0);
    expect(result.client.notes).toBe('Автоматически создан');
  });

  it('uses custom phone and notes', () => {
    const result = findOrCreateClient([], 'Test', '111222333', 'Custom note');
    expect(result.client.phone).toBe('111222333');
    expect(result.client.notes).toBe('Custom note');
  });

  it('returns original clients array when found (not mutated)', () => {
    const clients = [makeClient()];
    const result = findOrCreateClient(clients, 'Existing Client');
    expect(result.clients).toBe(clients); // same reference
  });

  it('returns new array when client created', () => {
    const clients = [makeClient()];
    const result = findOrCreateClient(clients, 'New');
    expect(result.clients).not.toBe(clients); // new array
    expect(result.clients).toHaveLength(2);
  });

  it('handles empty name gracefully', () => {
    const result = findOrCreateClient([], '');
    expect(result.isNew).toBe(true);
    expect(result.client.name).toBe('');
  });

  it('handles empty clients array', () => {
    const result = findOrCreateClient([], 'Alice');
    expect(result.isNew).toBe(true);
    expect(result.index).toBe(0);
  });
});

// ─── transactionService._toUSD ──────────────────────────────────────────────

describe('transactionService._toUSD', () => {
  it('returns amount directly for USD currency', () => {
    const result = transactionService._toUSD({ amount: 100, currency: 'USD' });
    expect(result).toBe(100);
  });

  it('converts UZS to USD using exchange rate', () => {
    const result = transactionService._toUSD({ amount: 128000, currency: 'UZS', exchangeRate: 12800 });
    expect(result).toBe(10);
  });

  it('returns amount when currency is undefined', () => {
    const result = transactionService._toUSD({ amount: 50 });
    expect(result).toBe(50);
  });

  it('returns amount when UZS but no exchange rate', () => {
    const result = transactionService._toUSD({ amount: 1000, currency: 'UZS' });
    expect(result).toBe(1000);
  });

  it('returns amount when UZS but zero exchange rate', () => {
    const result = transactionService._toUSD({ amount: 1000, currency: 'UZS', exchangeRate: 0 });
    expect(result).toBe(1000);
  });

  it('handles fractional conversion', () => {
    const result = transactionService._toUSD({ amount: 6400, currency: 'UZS', exchangeRate: 12800 });
    expect(result).toBeCloseTo(0.5);
  });
});
