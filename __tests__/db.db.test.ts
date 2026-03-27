import { openDatabaseAsync, mockDb } from '../__mocks__/expo-sqlite';

// Use the moduleNameMapper mock (expo-sqlite → __mocks__/expo-sqlite.ts)
jest.mock('expo-sqlite');

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  openDatabaseAsync.mockResolvedValue(mockDb);
});

describe('getDatabase', () => {
  it('calls openDatabaseAsync with the correct database name', async () => {
    jest.isolateModules(() => {
      const { getDatabase } = require('../db/db');
      getDatabase();
    });
    await new Promise(r => setTimeout(r, 10));
    expect(openDatabaseAsync).toHaveBeenCalledWith('pocketledger.db');
  });

  it('returns the same instance on repeated calls (singleton)', async () => {
    let db1: unknown, db2: unknown;
    await jest.isolateModulesAsync(async () => {
      const { getDatabase } = require('../db/db');
      db1 = await getDatabase();
      db2 = await getDatabase();
    });
    expect(db1).toBe(db2);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});

describe('initDatabase — schema SQL', () => {
  let capturedSqlCalls: string[] = [];
  let schemaSql = '';

  beforeEach(async () => {
    capturedSqlCalls = [];
    mockDb.execAsync.mockImplementation(async (sql: string) => {
      capturedSqlCalls.push(sql);
    });
    await jest.isolateModulesAsync(async () => {
      const { initDatabase } = require('../db/db');
      await initDatabase();
    });
    // First call is always the main schema SQL
    schemaSql = capturedSqlCalls[0] ?? '';
  });

  it('calls execAsync at least once for the main schema', () => {
    expect(mockDb.execAsync).toHaveBeenCalled();
  });

  it('enables WAL journal mode', () => {
    expect(schemaSql).toContain('PRAGMA journal_mode = WAL');
  });

  it('creates transactions table', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS transactions');
  });

  it('creates savings_accounts table', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS savings_accounts');
  });

  it('creates regular_expenses table', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS regular_expenses');
  });

  it('creates exchange_rate_cache table', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS exchange_rate_cache');
  });

  it('creates user_settings table', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS user_settings');
  });

  it('seeds base_currency = CAD', () => {
    expect(schemaSql).toContain("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('base_currency', 'CAD')");
  });

  it('seeds monthly_budget default', () => {
    expect(schemaSql).toContain("INSERT OR IGNORE INTO user_settings (key, value) VALUES ('monthly_budget', '2000')");
  });

  it('transactions table has deleted_at column', () => {
    const block = schemaSql.slice(schemaSql.indexOf('CREATE TABLE IF NOT EXISTS transactions'));
    expect(block).toContain('deleted_at');
  });

  it('savings_accounts table has deleted_at column', () => {
    const block = schemaSql.slice(schemaSql.indexOf('CREATE TABLE IF NOT EXISTS savings_accounts'));
    expect(block).toContain('deleted_at');
  });

  it('regular_expenses table has deleted_at column', () => {
    const block = schemaSql.slice(schemaSql.indexOf('CREATE TABLE IF NOT EXISTS regular_expenses'));
    expect(block).toContain('deleted_at');
  });

  it('runs migration ALTER statements for new columns', () => {
    const allSql = capturedSqlCalls.join('\n');
    expect(allSql).toContain('ALTER TABLE transactions ADD COLUMN type');
    expect(allSql).toContain('ALTER TABLE regular_expenses ADD COLUMN start_date');
  });
});
