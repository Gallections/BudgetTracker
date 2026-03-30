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
  getMonthlySpendTrend,
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
  type: 'expense' as const,
  source_account_id: null as string | null,
  regular_expense_id: null as string | null,
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

  it('defaults type to "expense" when not provided', async () => {
    const { type: _t, ...withoutType } = baseTx();
    const result = await insertTransaction({ ...withoutType, type: 'expense' });
    expect(result.type).toBe('expense');
  });

  it('preserves type "income" when provided', async () => {
    const result = await insertTransaction({ ...baseTx(), type: 'income' });
    expect(result.type).toBe('income');
  });

  it('includes type in the SQL parameters', async () => {
    await insertTransaction({ ...baseTx(), type: 'income' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args).toContain('income');
  });

  it('includes source_account_id column in INSERT SQL', async () => {
    await insertTransaction(baseTx());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('source_account_id');
  });

  it('passes null for source_account_id when not provided', async () => {
    await insertTransaction({ ...baseTx(), source_account_id: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    // second-to-last param is source_account_id (last is regular_expense_id)
    expect(args[args.length - 2]).toBeNull();
  });

  it('passes source_account_id when provided', async () => {
    await insertTransaction({ ...baseTx(), source_account_id: 'acct-abc' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[args.length - 2]).toBe('acct-abc');
  });

  it('includes regular_expense_id column in INSERT SQL', async () => {
    await insertTransaction(baseTx());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('regular_expense_id');
  });

  it('passes null for regular_expense_id when not provided', async () => {
    await insertTransaction({ ...baseTx(), regular_expense_id: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[args.length - 1]).toBeNull();
  });

  it('passes regular_expense_id when provided', async () => {
    await insertTransaction({ ...baseTx(), regular_expense_id: 'exp-1' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[args.length - 1]).toBe('exp-1');
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

  it('applies income type filter when provided', async () => {
    await getTransactions({ type: 'income' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain("type = 'income'");
  });

  it('applies expense type filter including NULL rows', async () => {
    await getTransactions({ type: 'expense' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain("type = 'expense' OR type IS NULL");
  });

  it('does not add type filter when not provided', async () => {
    await getTransactions();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).not.toContain("type = 'income'");
    expect(sql).not.toContain("type = 'expense'");
  });

  it('applies search filter LIKE on merchant and notes', async () => {
    await getTransactions({ search: 'netflix' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('merchant LIKE ?');
    expect(sql).toContain('notes LIKE ?');
  });

  it('pushes search term as %term% twice into params', async () => {
    await getTransactions({ search: 'netflix' });
    const params: unknown[] = mockDb.getAllAsync.mock.calls[0][1];
    expect(params).toContain('%netflix%');
    expect(params.filter(p => p === '%netflix%')).toHaveLength(2);
  });

  it('does not add search condition when search is undefined', async () => {
    await getTransactions();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).not.toContain('LIKE');
  });

  it('does not add search condition when search is empty string', async () => {
    await getTransactions({ search: '' });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).not.toContain('LIKE');
  });

  it('adds source_account_id IS NULL when unlinkedOnly is true', async () => {
    await getTransactions({ unlinkedOnly: true });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('source_account_id IS NULL');
  });

  it('does not add source_account_id filter when unlinkedOnly is false', async () => {
    await getTransactions({ unlinkedOnly: false });
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).not.toContain('source_account_id IS NULL');
  });
});

// ─── getMonthlySpendTrend ─────────────────────────────────────────────────────

describe('getMonthlySpendTrend', () => {
  it('calls getAllAsync once', async () => {
    await getMonthlySpendTrend();
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('SQL uses strftime to group by month', async () => {
    await getMonthlySpendTrend();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain("strftime('%Y-%m', date)");
    expect(sql).toContain('GROUP BY month');
  });

  it('SQL filters out deleted rows', async () => {
    await getMonthlySpendTrend();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('SQL only includes expense rows', async () => {
    await getMonthlySpendTrend();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain("type = 'expense' OR type IS NULL");
  });

  it('SQL orders results ascending', async () => {
    await getMonthlySpendTrend();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('ORDER BY month ASC');
  });

  it('passes a date string as the start date param', async () => {
    await getMonthlySpendTrend(6);
    const params: unknown[] = mockDb.getAllAsync.mock.calls[0][1];
    expect(params).toHaveLength(1);
    expect(typeof params[0]).toBe('string');
    expect(params[0] as string).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('returns whatever getAllAsync resolves with', async () => {
    const rows = [{ month: '2026-01', amount: 300 }, { month: '2026-02', amount: 450 }];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    expect(await getMonthlySpendTrend()).toEqual(rows);
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
  const txWithId = () => ({ ...baseTx(), id: 'tx-99', type: 'expense' as const });

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
    // params: amount, currency, amount_in_base, category, merchant, notes, date, type, id
    expect(args[5]).toBeNull();
  });

  it('includes type in UPDATE SQL', async () => {
    await updateTransaction(txWithId());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('type = ?');
  });

  it('passes the correct type value', async () => {
    await updateTransaction({ ...txWithId(), type: 'income' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args).toContain('income');
  });

  it('includes source_account_id in UPDATE SQL', async () => {
    await updateTransaction(txWithId());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('source_account_id = ?');
  });

  it('passes null for source_account_id when not set', async () => {
    await updateTransaction({ ...txWithId(), source_account_id: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    // params: amount, currency, amount_in_base, category, merchant, notes, date, type, source_account_id, id
    expect(args[8]).toBeNull();
  });

  it('passes source_account_id when provided', async () => {
    await updateTransaction({ ...txWithId(), source_account_id: 'acct-1' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[8]).toBe('acct-1');
  });

  it('includes regular_expense_id in UPDATE SQL', async () => {
    await updateTransaction(txWithId());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('regular_expense_id = ?');
  });

  it('passes null for regular_expense_id when not set', async () => {
    await updateTransaction({ ...txWithId(), regular_expense_id: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    // params: amount, currency, amount_in_base, category, merchant, notes, date, type, source_account_id, regular_expense_id, id
    expect(args[9]).toBeNull();
  });

  it('passes regular_expense_id when provided', async () => {
    await updateTransaction({ ...txWithId(), regular_expense_id: 'exp-42' });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[9]).toBe('exp-42');
  });
});
