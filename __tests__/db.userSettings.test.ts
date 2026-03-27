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

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
});

import {
  getUserSetting,
  setUserSetting,
  getBaseCurrency,
  setBaseCurrency,
  getBudgets,
  setBudget,
  clearBudget,
  getMerchantOverrides,
  setMerchantOverride,
  clearMerchantOverride,
} from '../db/userSettings';

// ─── getUserSetting ───────────────────────────────────────────────────────────

describe('getUserSetting', () => {
  it('returns value when row found', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ value: 'USD' });
    const result = await getUserSetting('base_currency');
    expect(result).toBe('USD');
  });

  it('returns null when row not found', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const result = await getUserSetting('nonexistent_key');
    expect(result).toBeNull();
  });

  it('queries user_settings table with the given key', async () => {
    await getUserSetting('base_currency');
    const sql: string = mockDb.getFirstAsync.mock.calls[0][0];
    expect(sql).toContain('user_settings');
  });

  it('passes key as bind parameter', async () => {
    await getUserSetting('my_key');
    const params: unknown[] = mockDb.getFirstAsync.mock.calls[0][1];
    expect(params).toContain('my_key');
  });
});

// ─── setUserSetting ───────────────────────────────────────────────────────────

describe('setUserSetting', () => {
  it('calls runAsync once', async () => {
    await setUserSetting('base_currency', 'EUR');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses INSERT OR REPLACE', async () => {
    await setUserSetting('base_currency', 'EUR');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql.toUpperCase()).toContain('INSERT OR REPLACE');
  });

  it('passes key and value as bind parameters', async () => {
    await setUserSetting('my_key', 'my_value');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('my_key');
    expect(params).toContain('my_value');
  });
});

// ─── getBaseCurrency ──────────────────────────────────────────────────────────

describe('getBaseCurrency', () => {
  it('returns stored currency when set', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ value: 'GBP' });
    expect(await getBaseCurrency()).toBe('GBP');
  });

  it('returns CAD as default when not set', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    expect(await getBaseCurrency()).toBe('CAD');
  });
});

// ─── setBaseCurrency ──────────────────────────────────────────────────────────

describe('setBaseCurrency', () => {
  it('calls runAsync once', async () => {
    await setBaseCurrency('USD');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('stores the currency value', async () => {
    await setBaseCurrency('USD');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('USD');
  });
});

// ─── getBudgets ───────────────────────────────────────────────────────────────

describe('getBudgets', () => {
  it('returns empty object when no budget rows', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const result = await getBudgets();
    expect(result).toEqual({});
  });

  it('parses budget rows into category → number map', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { key: 'budget_Groceries', value: '500' },
      { key: 'budget_Housing', value: '1200' },
    ]);
    const result = await getBudgets();
    expect(result['Groceries']).toBe(500);
    expect(result['Housing']).toBe(1200);
  });

  it('ignores rows with non-numeric values', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { key: 'budget_Groceries', value: 'not_a_number' },
    ]);
    const result = await getBudgets();
    expect(result['Groceries']).toBeUndefined();
  });

  it('queries with budget_ prefix filter', async () => {
    await getBudgets();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain("LIKE 'budget_%'");
  });
});

// ─── setBudget ────────────────────────────────────────────────────────────────

describe('setBudget', () => {
  it('calls runAsync once', async () => {
    await setBudget('Groceries', 500);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('stores key as budget_<category>', async () => {
    await setBudget('Groceries', 500);
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('budget_Groceries');
  });

  it('stores amount as string', async () => {
    await setBudget('Housing', 1200);
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('1200');
  });
});

// ─── clearBudget ──────────────────────────────────────────────────────────────

describe('clearBudget', () => {
  it('calls runAsync once', async () => {
    await clearBudget('Groceries');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses DELETE statement', async () => {
    await clearBudget('Groceries');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql.toUpperCase()).toContain('DELETE');
  });

  it('targets the correct budget key', async () => {
    await clearBudget('Housing');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('budget_Housing');
  });
});

// ─── getMerchantOverrides ─────────────────────────────────────────────────────

describe('getMerchantOverrides', () => {
  it('queries with merchant_override_ prefix filter', async () => {
    await getMerchantOverrides();
    const sql: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain("LIKE 'merchant_override_%'");
  });

  it('returns empty object when no overrides', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const result = await getMerchantOverrides();
    expect(result).toEqual({});
  });

  it('strips prefix and maps merchant → category correctly', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { key: 'merchant_override_starbucks', value: 'Food & Drink' },
      { key: 'merchant_override_planet fitness', value: 'Fitness' },
    ]);
    const result = await getMerchantOverrides();
    expect(result['starbucks']).toBe('Food & Drink');
    expect(result['planet fitness']).toBe('Fitness');
  });

  it('handles multiple overrides', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { key: 'merchant_override_a', value: 'Cat A' },
      { key: 'merchant_override_b', value: 'Cat B' },
      { key: 'merchant_override_c', value: 'Cat C' },
    ]);
    const result = await getMerchantOverrides();
    expect(Object.keys(result)).toHaveLength(3);
  });
});

// ─── setMerchantOverride ──────────────────────────────────────────────────────

describe('setMerchantOverride', () => {
  it('calls runAsync once', async () => {
    await setMerchantOverride('Tim Hortons', 'Food & Drink');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('lowercases and trims the merchant in the key', async () => {
    await setMerchantOverride('  Tim Hortons  ', 'Food & Drink');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('merchant_override_tim hortons');
  });

  it('stores the category as the value', async () => {
    await setMerchantOverride('Starbucks', 'Entertainment');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('Entertainment');
  });

  it('uses INSERT OR REPLACE', async () => {
    await setMerchantOverride('Netflix', 'Subscriptions');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql.toUpperCase()).toContain('INSERT OR REPLACE');
  });
});

// ─── clearMerchantOverride ────────────────────────────────────────────────────

describe('clearMerchantOverride', () => {
  it('calls runAsync once', async () => {
    await clearMerchantOverride('Starbucks');
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });

  it('uses DELETE statement', async () => {
    await clearMerchantOverride('Starbucks');
    const sql: string = mockDb.runAsync.mock.calls[0][0];
    expect(sql.toUpperCase()).toContain('DELETE');
  });

  it('targets the correct merchant key (lowercased)', async () => {
    await clearMerchantOverride('Tim Hortons');
    const params: unknown[] = mockDb.runAsync.mock.calls[0][1];
    expect(params).toContain('merchant_override_tim hortons');
  });
});
