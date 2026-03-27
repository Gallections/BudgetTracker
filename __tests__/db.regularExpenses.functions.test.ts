import * as Crypto from 'expo-crypto';

// Controlled mock db — defined before jest.mock so the factory can close over it
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
  mockDb.withTransactionAsync.mockImplementation((fn: () => Promise<void>) => fn());
});

import {
  getRegularExpenses,
  upsertRegularExpense,
  softDeleteRegularExpense,
  updateExpensesOrder,
  FREQUENCIES,
  FREQUENCY_MONTHLY_MULTIPLIER,
} from '../db/regularExpenses';

const baseExpense = () => ({
  name: 'Netflix',
  category: 'Subscriptions',
  amount: 17.99,
  currency: 'CAD',
  frequency: 'monthly' as const,
  due_day: 15 as number | null,
  outstanding_balance: null as number | null,
  notes: null as string | null,
  sort_order: 0,
});

// ─── FREQUENCIES constant ─────────────────────────────────────────────────────

describe('FREQUENCIES', () => {
  it('contains all 6 expected frequency values', () => {
    expect(FREQUENCIES).toEqual(['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually']);
  });
});

// ─── FREQUENCY_MONTHLY_MULTIPLIER ─────────────────────────────────────────────

describe('FREQUENCY_MONTHLY_MULTIPLIER', () => {
  it('once multiplier is 0 (excluded from monthly total)', () => {
    expect(FREQUENCY_MONTHLY_MULTIPLIER.once).toBe(0);
  });

  it('monthly multiplier is 1', () => {
    expect(FREQUENCY_MONTHLY_MULTIPLIER.monthly).toBe(1);
  });

  it('weekly multiplier is 52/12', () => {
    expect(FREQUENCY_MONTHLY_MULTIPLIER.weekly).toBeCloseTo(52 / 12);
  });

  it('biweekly multiplier is 26/12', () => {
    expect(FREQUENCY_MONTHLY_MULTIPLIER.biweekly).toBeCloseTo(26 / 12);
  });

  it('quarterly multiplier is 1/3', () => {
    expect(FREQUENCY_MONTHLY_MULTIPLIER.quarterly).toBeCloseTo(1 / 3);
  });

  it('annually multiplier is 1/12', () => {
    expect(FREQUENCY_MONTHLY_MULTIPLIER.annually).toBeCloseTo(1 / 12);
  });
});

// ─── getRegularExpenses ───────────────────────────────────────────────────────

describe('getRegularExpenses', () => {
  it('calls getAllAsync once', async () => {
    await getRegularExpenses();
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('filters by deleted_at IS NULL', async () => {
    await getRegularExpenses();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('orders by sort_order ASC', async () => {
    await getRegularExpenses();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('sort_order ASC');
  });

  it('returns whatever getAllAsync resolves with', async () => {
    const rows = [{ id: '1', name: 'Netflix', amount: 17.99 }];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    const result = await getRegularExpenses();
    expect(result).toEqual(rows);
  });

  it('returns empty array when no rows exist', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const result = await getRegularExpenses();
    expect(result).toEqual([]);
  });
});

// ─── upsertRegularExpense — insert ────────────────────────────────────────────

describe('upsertRegularExpense — insert (no id)', () => {
  it('calls runAsync once', async () => {
    await upsertRegularExpense(baseExpense());
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses generated UUID when no id is provided', async () => {
    (Crypto.randomUUID as jest.Mock).mockReturnValue('generated-uuid');
    const result = await upsertRegularExpense(baseExpense());
    expect(result.id).toBe('generated-uuid');
  });

  it('returns deleted_at as null', async () => {
    const result = await upsertRegularExpense(baseExpense());
    expect(result.deleted_at).toBeNull();
  });

  it('preserves all input fields in the returned object', async () => {
    const input = baseExpense();
    const result = await upsertRegularExpense(input);
    expect(result.name).toBe(input.name);
    expect(result.amount).toBe(input.amount);
    expect(result.currency).toBe(input.currency);
    expect(result.frequency).toBe(input.frequency);
    expect(result.sort_order).toBe(input.sort_order);
  });

  it('SQL contains INSERT with ON CONFLICT upsert', async () => {
    await upsertRegularExpense(baseExpense());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO regular_expenses');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE SET');
  });

  it('passes null for due_day when not provided', async () => {
    await upsertRegularExpense({ ...baseExpense(), due_day: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[6]).toBeNull();
  });

  it('passes null for outstanding_balance when not provided', async () => {
    await upsertRegularExpense({ ...baseExpense(), outstanding_balance: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[7]).toBeNull();
  });

  it('passes null for notes when notes is null', async () => {
    await upsertRegularExpense({ ...baseExpense(), notes: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[8]).toBeNull();
  });
});

// ─── upsertRegularExpense — update ────────────────────────────────────────────

describe('upsertRegularExpense — update (with id)', () => {
  it('uses the provided id', async () => {
    const result = await upsertRegularExpense({ ...baseExpense(), id: 'existing-123' });
    expect(result.id).toBe('existing-123');
  });

  it('does not call randomUUID when id is provided', async () => {
    const cryptoSpy = jest.spyOn(Crypto, 'randomUUID');
    await upsertRegularExpense({ ...baseExpense(), id: 'existing-123' });
    expect(cryptoSpy).not.toHaveBeenCalled();
  });
});

// ─── softDeleteRegularExpense ─────────────────────────────────────────────────

describe('softDeleteRegularExpense', () => {
  it('calls runAsync once', async () => {
    await softDeleteRegularExpense('some-id');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('passes the target id to the query', async () => {
    await softDeleteRegularExpense('target-id');
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args).toContain('target-id');
  });

  it('sets deleted_at rather than hard-deleting', async () => {
    await softDeleteRegularExpense('target-id');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at');
    expect(sql.toUpperCase()).not.toMatch(/DELETE FROM/);
  });

  it('sets deleted_at to a valid recent ISO timestamp', async () => {
    const before = new Date().toISOString();
    await softDeleteRegularExpense('target-id');
    const after = new Date().toISOString();
    const args = mockDb.runAsync.mock.calls[0][1] as string[];
    expect(args[0] >= before).toBe(true);
    expect(args[0] <= after).toBe(true);
  });
});

// ─── updateExpensesOrder ──────────────────────────────────────────────────────

describe('updateExpensesOrder', () => {
  it('wraps updates in a transaction', async () => {
    await updateExpensesOrder(['a', 'b', 'c']);
    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('calls runAsync once per id', async () => {
    await updateExpensesOrder(['a', 'b', 'c']);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(3);
  });

  it('assigns correct sort_order to each id', async () => {
    await updateExpensesOrder(['first', 'second', 'third']);
    expect(mockDb.runAsync.mock.calls[0][1]).toEqual([0, 'first']);
    expect(mockDb.runAsync.mock.calls[1][1]).toEqual([1, 'second']);
    expect(mockDb.runAsync.mock.calls[2][1]).toEqual([2, 'third']);
  });

  it('handles empty array without error', async () => {
    await expect(updateExpensesOrder([])).resolves.toBeUndefined();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('handles single item', async () => {
    await updateExpensesOrder(['only-one']);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.runAsync.mock.calls[0][1]).toEqual([0, 'only-one']);
  });
});
