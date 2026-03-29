import { getSavingsGoals, upsertSavingsGoal, softDeleteSavingsGoal } from '../db/savingsGoals';

let mockDb: {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  withTransactionAsync: jest.Mock;
};

jest.mock('../db/db', () => ({
  getDatabase: jest.fn().mockImplementation(() => Promise.resolve(mockDb)),
  initDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-goal-uuid'),
}));

beforeEach(() => {
  mockDb = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    withTransactionAsync: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
  };
  jest.clearAllMocks();
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
});

const BASE_GOAL = {
  name: 'Emergency Fund',
  target_amount: 10000,
  target_date: null,
  linked_account_id: null,
  notes: null,
  sort_order: 0,
};

// ─── getSavingsGoals ──────────────────────────────────────────────────────────

describe('getSavingsGoals', () => {
  it('calls getAllAsync once', async () => {
    await getSavingsGoals();
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('filters deleted_at IS NULL', async () => {
    await getSavingsGoals();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('orders by sort_order ASC', async () => {
    await getSavingsGoals();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('sort_order ASC');
  });

  it('returns whatever getAllAsync resolves with', async () => {
    const rows = [{ id: '1', name: 'Vacation', target_amount: 3000 }];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    const result = await getSavingsGoals();
    expect(result).toEqual(rows);
  });
});

// ─── upsertSavingsGoal (new) ──────────────────────────────────────────────────

describe('upsertSavingsGoal — new goal', () => {
  it('generates a UUID when no id is provided', async () => {
    await upsertSavingsGoal(BASE_GOAL);
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe('mock-goal-uuid');
  });

  it('calls runAsync once', async () => {
    await upsertSavingsGoal(BASE_GOAL);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('SQL contains INSERT and ON CONFLICT', async () => {
    await upsertSavingsGoal(BASE_GOAL);
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO savings_goals');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
  });

  it('returns object with generated id and deleted_at null', async () => {
    const result = await upsertSavingsGoal(BASE_GOAL);
    expect(result.id).toBe('mock-goal-uuid');
    expect(result.deleted_at).toBeNull();
  });

  it('passes name and target_amount correctly', async () => {
    await upsertSavingsGoal(BASE_GOAL);
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('Emergency Fund');
    expect(params[2]).toBe(10000);
  });

  it('passes null for optional fields when not provided', async () => {
    await upsertSavingsGoal(BASE_GOAL);
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(params[3]).toBeNull(); // target_date
    expect(params[4]).toBeNull(); // linked_account_id
    expect(params[5]).toBeNull(); // notes
  });
});

// ─── upsertSavingsGoal (edit) ─────────────────────────────────────────────────

describe('upsertSavingsGoal — edit existing', () => {
  it('uses provided id instead of generating one', async () => {
    await upsertSavingsGoal({ ...BASE_GOAL, id: 'existing-id' });
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe('existing-id');
  });

  it('passes optional fields when provided', async () => {
    await upsertSavingsGoal({
      ...BASE_GOAL,
      id: 'existing-id',
      target_date: '2026-12-31',
      linked_account_id: 'acct-1',
      notes: 'For rainy days',
    });
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(params[3]).toBe('2026-12-31');
    expect(params[4]).toBe('acct-1');
    expect(params[5]).toBe('For rainy days');
  });
});

// ─── softDeleteSavingsGoal ───────────────────────────────────────────────────

describe('softDeleteSavingsGoal', () => {
  it('calls runAsync once', async () => {
    await softDeleteSavingsGoal('goal-123');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('SQL sets deleted_at', async () => {
    await softDeleteSavingsGoal('goal-123');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('SET deleted_at');
  });

  it('passes the correct id', async () => {
    await softDeleteSavingsGoal('goal-123');
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('goal-123');
  });

  it('sets a non-null deleted_at timestamp', async () => {
    await softDeleteSavingsGoal('goal-123');
    const params = mockDb.runAsync.mock.calls[0][1] as unknown[];
    expect(typeof params[0]).toBe('string');
    expect((params[0] as string).length).toBeGreaterThan(0);
  });
});
