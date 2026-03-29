import { transactionsToCSV, buildBackupObject, BackupData } from '../utils/exportData';
import { Transaction } from '../db/transactions';

// Mock heavy dependencies — only testing pure formatting functions
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('../db/transactions', () => ({ getTransactions: jest.fn(), insertTransaction: jest.fn() }));
jest.mock('../db/savings', () => ({ getSavingsAccounts: jest.fn(), upsertSavingsAccount: jest.fn() }));
jest.mock('../db/regularExpenses', () => ({ getRegularExpenses: jest.fn(), upsertRegularExpense: jest.fn() }));
jest.mock('../db/customCategories', () => ({ getCustomCategories: jest.fn(), upsertCustomCategory: jest.fn() }));

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  amount: 17.99,
  currency: 'CAD',
  amount_in_base_currency: 17.99,
  category: 'Subscriptions',
  merchant: 'Netflix',
  notes: null,
  date: '2026-03-26',
  created_at: '2026-03-26T10:00:00.000Z',
  deleted_at: null,
  type: 'expense',
  source_account_id: null,
  ...overrides,
});

// ─── transactionsToCSV ────────────────────────────────────────────────────────

describe('transactionsToCSV', () => {
  it('includes a header row', () => {
    const csv = transactionsToCSV([]);
    expect(csv.split('\n')[0]).toContain('date');
    expect(csv.split('\n')[0]).toContain('amount');
    expect(csv.split('\n')[0]).toContain('merchant');
  });

  it('returns only header when no transactions', () => {
    const csv = transactionsToCSV([]);
    expect(csv.split('\n')).toHaveLength(1);
  });

  it('produces one data row per transaction', () => {
    const csv = transactionsToCSV([makeTx(), makeTx({ id: 'tx-2' })]);
    expect(csv.split('\n')).toHaveLength(3); // header + 2 rows
  });

  it('includes transaction fields in row', () => {
    const csv = transactionsToCSV([makeTx()]);
    expect(csv).toContain('Netflix');
    expect(csv).toContain('17.99');
    expect(csv).toContain('2026-03-26');
  });

  it('escapes commas in merchant names', () => {
    const csv = transactionsToCSV([makeTx({ merchant: 'Smith, Jones & Co' })]);
    expect(csv).toContain('"Smith, Jones & Co"');
  });

  it('escapes double quotes in values', () => {
    const csv = transactionsToCSV([makeTx({ notes: 'He said "hello"' })]);
    expect(csv).toContain('He said ""hello""');
  });

  it('handles null notes as empty string', () => {
    const csv = transactionsToCSV([makeTx({ notes: null })]);
    const lines = csv.split('\n');
    expect(lines[1]).toBeDefined();
    // notes column should be empty (no crash)
    expect(lines[1]).not.toContain('null');
  });

  it('includes type field', () => {
    const csv = transactionsToCSV([makeTx({ type: 'income' })]);
    expect(csv).toContain('income');
  });
});

// ─── buildBackupObject ────────────────────────────────────────────────────────

describe('buildBackupObject', () => {
  const emptyBackup: BackupData = {
    version: 1,
    exportedAt: '2026-03-26T00:00:00.000Z',
    transactions: [],
    savingsAccounts: [],
    regularExpenses: [],
    customCategories: [],
  };

  it('returns valid JSON string', () => {
    const json = buildBackupObject(emptyBackup);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('serialized object contains version', () => {
    const parsed = JSON.parse(buildBackupObject(emptyBackup));
    expect(parsed.version).toBe(1);
  });

  it('serialized object contains exportedAt', () => {
    const parsed = JSON.parse(buildBackupObject(emptyBackup));
    expect(parsed.exportedAt).toBe('2026-03-26T00:00:00.000Z');
  });

  it('includes transactions array', () => {
    const backup = { ...emptyBackup, transactions: [makeTx()] };
    const parsed = JSON.parse(buildBackupObject(backup));
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0].merchant).toBe('Netflix');
  });

  it('includes all four data arrays', () => {
    const parsed = JSON.parse(buildBackupObject(emptyBackup));
    expect(Array.isArray(parsed.transactions)).toBe(true);
    expect(Array.isArray(parsed.savingsAccounts)).toBe(true);
    expect(Array.isArray(parsed.regularExpenses)).toBe(true);
    expect(Array.isArray(parsed.customCategories)).toBe(true);
  });

  it('produces pretty-printed JSON (has newlines)', () => {
    const json = buildBackupObject(emptyBackup);
    expect(json).toContain('\n');
  });
});
