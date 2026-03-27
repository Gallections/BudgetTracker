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
  getCustomCategories,
  upsertCustomCategory,
  softDeleteCustomCategory,
  updateCustomCategoriesOrder,
} from '../db/customCategories';

// ─── getCustomCategories ───────────────────────────────────────────────────────

describe('getCustomCategories', () => {
  it('calls getAllAsync once', async () => {
    await getCustomCategories();
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('filters by deleted_at IS NULL', async () => {
    await getCustomCategories();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('orders by sort_order ASC', async () => {
    await getCustomCategories();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('sort_order ASC');
  });

  it('returns empty array when no rows', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const result = await getCustomCategories();
    expect(result).toEqual([]);
  });

  it('parses keywords JSON string into array', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Entertainment', keywords: '["cineplex","amc"]', sort_order: 0, deleted_at: null },
    ]);
    const result = await getCustomCategories();
    expect(result[0].keywords).toEqual(['cineplex', 'amc']);
  });

  it('returns correct name and id', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'cat-99', name: 'Travel', keywords: '[]', sort_order: 1, deleted_at: null },
    ]);
    const result = await getCustomCategories();
    expect(result[0].id).toBe('cat-99');
    expect(result[0].name).toBe('Travel');
  });

  it('handles empty keywords array', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'cat-2', name: 'Misc', keywords: '[]', sort_order: 0, deleted_at: null },
    ]);
    const result = await getCustomCategories();
    expect(result[0].keywords).toEqual([]);
  });
});

// ─── upsertCustomCategory ──────────────────────────────────────────────────────

describe('upsertCustomCategory', () => {
  it('calls runAsync once', async () => {
    await upsertCustomCategory({ name: 'Entertainment', keywords: [], sort_order: 0 });
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID for new categories', async () => {
    (Crypto.randomUUID as jest.Mock).mockReturnValue('new-uuid-1');
    const result = await upsertCustomCategory({ name: 'Travel', keywords: [], sort_order: 0 });
    expect(result.id).toBe('new-uuid-1');
  });

  it('reuses provided id for existing categories', async () => {
    const result = await upsertCustomCategory({ id: 'existing-id', name: 'Travel', keywords: [], sort_order: 1 });
    expect(result.id).toBe('existing-id');
  });

  it('uses INSERT OR REPLACE SQL', async () => {
    await upsertCustomCategory({ name: 'Test', keywords: [], sort_order: 0 });
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql.toUpperCase()).toContain('INSERT OR REPLACE');
  });

  it('stringifies keywords array to JSON', async () => {
    await upsertCustomCategory({ name: 'Test', keywords: ['cinema', 'movie'], sort_order: 0 });
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('["cinema","movie"]');
  });

  it('returns category with correct name and keywords', async () => {
    const result = await upsertCustomCategory({ name: 'Fun', keywords: ['amusement'], sort_order: 0 });
    expect(result.name).toBe('Fun');
    expect(result.keywords).toEqual(['amusement']);
  });

  it('returns deleted_at as null', async () => {
    const result = await upsertCustomCategory({ name: 'Fun', keywords: [], sort_order: 0 });
    expect(result.deleted_at).toBeNull();
  });
});

// ─── softDeleteCustomCategory ─────────────────────────────────────────────────

describe('softDeleteCustomCategory', () => {
  it('calls runAsync once', async () => {
    await softDeleteCustomCategory('cat-1');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('sets deleted_at rather than hard-deleting', async () => {
    await softDeleteCustomCategory('cat-1');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at');
    expect(sql.toUpperCase()).not.toMatch(/DELETE FROM/);
  });

  it('passes the id as a bind parameter', async () => {
    await softDeleteCustomCategory('target-cat');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('target-cat');
  });

  it('sets deleted_at to a valid recent ISO timestamp', async () => {
    const before = new Date().toISOString();
    await softDeleteCustomCategory('cat-1');
    const after = new Date().toISOString();
    const params = mockDb.runAsync.mock.calls[0][1] as string[];
    expect(params[0] >= before).toBe(true);
    expect(params[0] <= after).toBe(true);
  });
});

// ─── updateCustomCategoriesOrder ──────────────────────────────────────────────

describe('updateCustomCategoriesOrder', () => {
  it('calls withTransactionAsync once', async () => {
    await updateCustomCategoriesOrder(['id-a', 'id-b', 'id-c']);
    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('calls runAsync once per id', async () => {
    await updateCustomCategoriesOrder(['id-a', 'id-b', 'id-c']);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(3);
  });

  it('updates sort_order sequentially starting from 0', async () => {
    await updateCustomCategoriesOrder(['id-a', 'id-b']);
    const firstCall = mockDb.runAsync.mock.calls[0][1] as unknown[];
    const secondCall = mockDb.runAsync.mock.calls[1][1] as unknown[];
    expect(firstCall[0]).toBe(0);
    expect(secondCall[0]).toBe(1);
  });

  it('passes the correct id for each position', async () => {
    await updateCustomCategoriesOrder(['id-x', 'id-y']);
    expect(mockDb.runAsync.mock.calls[0][1]).toContain('id-x');
    expect(mockDb.runAsync.mock.calls[1][1]).toContain('id-y');
  });

  it('handles empty array without error', async () => {
    await expect(updateCustomCategoriesOrder([])).resolves.toBeUndefined();
  });
});
