import * as Crypto from 'expo-crypto';

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
};

jest.mock('../db/db', () => ({
  getDatabase: jest.fn().mockResolvedValue(mockDb),
  initDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto');

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
});

import {
  insertTransaction,
  getTransactions,
  softDeleteTransaction,
  updateTransaction,
} from '../db/transactions';

const baseTx = () => ({
  amount: 17.99,
  currency: 'CAD',
  amount_in_base_currency: 17.99,
  category: 'Subscriptions',
  merchant: 'Netflix',
  notes: null as string | null,
  date: '2026-03-26',
});

// ─── insertTransaction ────────────────────────────────────────────────────────

describe('insertTransaction', () => {
  it('calls runAsync once', async () => {
    await insertTransaction(baseTx());
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses randomUUID for the id', async () => {
    (Crypto.randomUUID as jest.Mock).mockReturnValue('tx-uuid-1');
    const result = await insertTransaction(baseTx());
    expect(result.id).toBe('tx-uuid-1');
  });

  it('returns deleted_at as null', async () => {
    const result = await insertTransaction(baseTx());
    expect(result.deleted_at).toBeNull();
  });

  it('returns a valid ISO 8601 created_at', async () => {
    const result = await insertTransaction(baseTx());
    expect(new Date(result.created_at).toISOString()).toBe(result.created_at);
  });

  it('preserves all input fields in returned object', async () => {
    const input = baseTx();
    const result = await insertTransaction(input);
    expect(result.amount).toBe(input.amount);
    expect(result.currency).toBe(input.currency);
    expect(result.category).toBe(input.category);
    expect(result.merchant).toBe(input.merchant);
    expect(result.date).toBe(input.date);
  });

  it('passes null for notes when notes is null', async () => {
    await insertTransaction({ ...baseTx(), notes: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[6]).toBeNull();
  });

  it('passes notes string when provided', async () => {
    await insertTransaction({ ...baseTx(), notes: 'work lunch' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[6]).toBe('work lunch');
  });

  it('SQL inserts into transactions table', async () => {
    await insertTransaction(baseTx());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO transactions');
  });
});

// ─── getTransactions ──────────────────────────────────────────────────────────

describe('getTransactions', () => {
  it('calls getAllAsync once', async () => {
    await getTransactions();
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('always filters deleted_at IS NULL', async () => {
    await getTransactions();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('orders by date DESC', async () => {
    await getTransactions();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('date DESC');
  });

  it('returns whatever getAllAsync resolves with', async () => {
    const rows = [{ id: '1', amount: 10, merchant: 'Tim Hortons' }];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    expect(await getTransactions()).toEqual(rows);
  });

  it('applies category filter when provided', async () => {
    await getTransactions({ category: 'Groceries' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('category = ?');
  });

  it('applies dateFrom filter when provided', async () => {
    await getTransactions({ dateFrom: '2026-03-01' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('date >= ?');
  });

  it('applies dateTo filter when provided', async () => {
    await getTransactions({ dateTo: '2026-03-31' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('date <= ?');
  });

  it('applies LIMIT when provided', async () => {
    await getTransactions({ limit: 20 });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('LIMIT 20');
  });

  it('does not add LIMIT when not provided', async () => {
    await getTransactions();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).not.toContain('LIMIT');
  });
});

// ─── softDeleteTransaction ────────────────────────────────────────────────────

describe('softDeleteTransaction', () => {
  it('calls runAsync once', async () => {
    await softDeleteTransaction('tx-1');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('passes the id to the query', async () => {
    await softDeleteTransaction('target-tx');
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args).toContain('target-tx');
  });

  it('sets deleted_at rather than hard-deleting', async () => {
    await softDeleteTransaction('tx-1');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at');
    expect(sql.toUpperCase()).not.toMatch(/DELETE FROM/);
  });

  it('sets deleted_at to a valid recent ISO timestamp', async () => {
    const before = new Date().toISOString();
    await softDeleteTransaction('tx-1');
    const after = new Date().toISOString();
    const args = mockDb.runAsync.mock.calls[0][1] as string[];
    expect(args[0] >= before).toBe(true);
    expect(args[0] <= after).toBe(true);
  });
});

// ─── updateTransaction ────────────────────────────────────────────────────────

describe('updateTransaction', () => {
  const txWithId = () => ({ ...baseTx(), id: 'tx-99' });

  it('calls runAsync once', async () => {
    await updateTransaction(txWithId());
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('SQL uses UPDATE not INSERT', async () => {
    await updateTransaction(txWithId());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql.toUpperCase()).toContain('UPDATE TRANSACTIONS');
    expect(sql.toUpperCase()).not.toContain('INSERT');
  });

  it('passes the id as final bind parameter', async () => {
    await updateTransaction(txWithId());
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[args.length - 1]).toBe('tx-99');
  });

  it('passes null for notes when notes is null', async () => {
    await updateTransaction({ ...txWithId(), notes: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    // notes is the 7th param (index 6): amount, currency, amount_in_base, category, merchant, notes, date, id
    expect(args[5]).toBeNull();
  });
});
