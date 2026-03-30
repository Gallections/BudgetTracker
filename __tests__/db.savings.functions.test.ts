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
  // Re-apply default implementations after clearAllMocks
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.withTransactionAsync.mockImplementation((fn: () => Promise<void>) => fn());
});

import {
  getSavingsAccounts,
  upsertSavingsAccount,
  softDeleteSavingsAccount,
  updateSavingsOrder,
  adjustAccountBalance,
} from '../db/savings';

const baseAccount = () => ({
  name: 'TD Chequing',
  institution: 'TD Bank' as string | null,
  balance: 1500.0,
  currency: 'CAD',
  account_type: 'Chequing',
  notes: null as string | null,
  sort_order: 0,
});

// ─── getSavingsAccounts ───────────────────────────────────────────────────────

describe('getSavingsAccounts', () => {
  it('calls getAllAsync once', async () => {
    await getSavingsAccounts();
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('filters by deleted_at IS NULL', async () => {
    await getSavingsAccounts();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('orders by sort_order ASC', async () => {
    await getSavingsAccounts();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('sort_order ASC');
  });

  it('returns whatever getAllAsync resolves with', async () => {
    const rows = [{ id: '1', name: 'TFSA', balance: 5000 }];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    const result = await getSavingsAccounts();
    expect(result).toEqual(rows);
  });

  it('returns empty array when no rows exist', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const result = await getSavingsAccounts();
    expect(result).toEqual([]);
  });
});

// ─── upsertSavingsAccount — insert ───────────────────────────────────────────

describe('upsertSavingsAccount — insert (no id)', () => {
  it('calls runAsync once', async () => {
    await upsertSavingsAccount(baseAccount());
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses generated UUID when no id is provided', async () => {
    (Crypto.randomUUID as jest.Mock).mockReturnValue('generated-uuid');
    const result = await upsertSavingsAccount(baseAccount());
    expect(result.id).toBe('generated-uuid');
  });

  it('returns deleted_at as null', async () => {
    const result = await upsertSavingsAccount(baseAccount());
    expect(result.deleted_at).toBeNull();
  });

  it('preserves all input fields in the returned object', async () => {
    const input = baseAccount();
    const result = await upsertSavingsAccount(input);
    expect(result.name).toBe(input.name);
    expect(result.balance).toBe(input.balance);
    expect(result.currency).toBe(input.currency);
    expect(result.account_type).toBe(input.account_type);
    expect(result.sort_order).toBe(input.sort_order);
  });

  it('returns a valid ISO 8601 updated_at timestamp', async () => {
    const result = await upsertSavingsAccount(baseAccount());
    expect(result.updated_at).toBeTruthy();
    expect(new Date(result.updated_at).toISOString()).toBe(result.updated_at);
  });

  it('passes null for institution when institution is null', async () => {
    await upsertSavingsAccount({ ...baseAccount(), institution: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[2]).toBeNull(); // institution is 3rd bind param
  });

  it('passes null for notes when notes is null', async () => {
    await upsertSavingsAccount({ ...baseAccount(), notes: null });
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[6]).toBeNull(); // notes is 7th bind param
  });

  it('SQL contains INSERT with ON CONFLICT upsert', async () => {
    await upsertSavingsAccount(baseAccount());
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO savings_accounts');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE SET');
  });
});

// ─── upsertSavingsAccount — update ───────────────────────────────────────────

describe('upsertSavingsAccount — update (with id)', () => {
  it('uses the provided id', async () => {
    const result = await upsertSavingsAccount({ ...baseAccount(), id: 'existing-123' });
    expect(result.id).toBe('existing-123');
  });

  it('does not call randomUUID when id is provided', async () => {
    const cryptoSpy = jest.spyOn(Crypto, 'randomUUID');
    await upsertSavingsAccount({ ...baseAccount(), id: 'existing-123' });
    expect(cryptoSpy).not.toHaveBeenCalled();
  });
});

// ─── softDeleteSavingsAccount ─────────────────────────────────────────────────

describe('softDeleteSavingsAccount', () => {
  it('calls runAsync twice (account soft-delete + transaction unlink)', async () => {
    await softDeleteSavingsAccount('some-id');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
  });

  it('passes the target id to the query', async () => {
    await softDeleteSavingsAccount('target-id');
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args).toContain('target-id');
  });

  it('sets deleted_at rather than hard-deleting', async () => {
    await softDeleteSavingsAccount('target-id');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at');
    expect(sql.toUpperCase()).not.toMatch(/DELETE FROM/);
  });

  it('sets deleted_at to a valid recent ISO timestamp', async () => {
    const before = new Date().toISOString();
    await softDeleteSavingsAccount('target-id');
    const after = new Date().toISOString();
    const args = mockDb.runAsync.mock.calls[0][1] as string[];
    expect(args[0] >= before).toBe(true);
    expect(args[0] <= after).toBe(true);
  });

  it('unlinking: calls runAsync twice (account delete + transaction unlink)', async () => {
    await softDeleteSavingsAccount('acct-1');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
  });

  it('unlinking: second query NULLs source_account_id on linked transactions', async () => {
    await softDeleteSavingsAccount('acct-1');
    const sql: string = mockDb.runAsync.mock.calls[1][0];
    expect(sql).toContain('source_account_id = NULL');
    expect(sql).toContain('source_account_id = ?');
  });

  it('unlinking: passes account id to the unlink query', async () => {
    await softDeleteSavingsAccount('acct-xyz');
    const args: unknown[] = mockDb.runAsync.mock.calls[1][1];
    expect(args[0]).toBe('acct-xyz');
  });
});

// ─── updateSavingsOrder ───────────────────────────────────────────────────────

describe('updateSavingsOrder', () => {
  it('wraps updates in a transaction', async () => {
    await updateSavingsOrder(['a', 'b', 'c']);
    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('calls runAsync once per id', async () => {
    await updateSavingsOrder(['a', 'b', 'c']);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(3);
  });

  it('assigns correct sort_order to each id', async () => {
    await updateSavingsOrder(['first', 'second', 'third']);
    expect(mockDb.runAsync.mock.calls[0][1]).toEqual([0, 'first']);
    expect(mockDb.runAsync.mock.calls[1][1]).toEqual([1, 'second']);
    expect(mockDb.runAsync.mock.calls[2][1]).toEqual([2, 'third']);
  });

  it('handles empty array without error', async () => {
    await expect(updateSavingsOrder([])).resolves.toBeUndefined();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('handles single item', async () => {
    await updateSavingsOrder(['only-one']);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.runAsync.mock.calls[0][1]).toEqual([0, 'only-one']);
  });
});

// ─── adjustAccountBalance ─────────────────────────────────────────────────────

describe('adjustAccountBalance', () => {
  it('calls runAsync once', async () => {
    await adjustAccountBalance('acct-1', -50);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('SQL uses balance = balance + ?', async () => {
    await adjustAccountBalance('acct-1', -50);
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('balance = balance + ?');
  });

  it('passes delta as first parameter', async () => {
    await adjustAccountBalance('acct-1', -75.50);
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[0]).toBe(-75.50);
  });

  it('passes account id as last parameter', async () => {
    await adjustAccountBalance('target-acct', 100);
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[args.length - 1]).toBe('target-acct');
  });

  it('works with positive delta (credit)', async () => {
    await adjustAccountBalance('acct-2', +200);
    const args: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(args[0]).toBe(200);
  });

  it('updates updated_at to a recent ISO timestamp', async () => {
    const before = new Date().toISOString();
    await adjustAccountBalance('acct-1', -10);
    const after = new Date().toISOString();
    const args = mockDb.runAsync.mock.calls[0][1] as unknown[];
    const updatedAt = args[1] as string;
    expect(updatedAt >= before).toBe(true);
    expect(updatedAt <= after).toBe(true);
  });
});
