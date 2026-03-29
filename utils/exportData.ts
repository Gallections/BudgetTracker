import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getTransactions, insertTransaction, Transaction } from '../db/transactions';
import { getSavingsAccounts, upsertSavingsAccount, SavingsAccount } from '../db/savings';
import { getRegularExpenses, upsertRegularExpense, RegularExpense } from '../db/regularExpenses';
import { getCustomCategories, upsertCustomCategory, CustomCategory } from '../db/customCategories';

// ─── Backup structure ─────────────────────────────────────────────────────────

export interface BackupData {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  savingsAccounts: SavingsAccount[];
  regularExpenses: RegularExpense[];
  customCategories: CustomCategory[];
}

// ─── Pure formatting (unit-testable) ─────────────────────────────────────────

export function transactionsToCSV(transactions: Transaction[]): string {
  const headers = [
    'id', 'date', 'type', 'amount', 'currency',
    'category', 'merchant', 'notes', 'created_at',
  ];
  const escape = (val: string | number | null) => {
    const s = val === null || val === undefined ? '' : String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = transactions.map(t => [
    t.id, t.date, t.type, t.amount, t.currency,
    t.category, t.merchant, t.notes, t.created_at,
  ].map(escape).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function buildBackupObject(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

// ─── Export: CSV transactions ─────────────────────────────────────────────────

export async function exportTransactionsCSV(): Promise<void> {
  const transactions = await getTransactions();
  const csv = transactionsToCSV(transactions);
  const filename = `pocketledger_transactions_${_dateStamp()}.csv`;
  const uri = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Transactions CSV' });
}

// ─── Export: full JSON backup ─────────────────────────────────────────────────

export async function exportFullBackup(): Promise<void> {
  const [transactions, savingsAccounts, regularExpenses, customCategories] = await Promise.all([
    getTransactions(),
    getSavingsAccounts(),
    getRegularExpenses(),
    getCustomCategories(),
  ]);

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    savingsAccounts,
    regularExpenses,
    customCategories,
  };

  const json = buildBackupObject(backup);
  const filename = `pocketledger_backup_${_dateStamp()}.json`;
  const uri = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Backup' });
}

// ─── Import: restore from JSON backup ────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importBackup(): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return { imported: 0, skipped: 0, errors: [] };
  }

  const uri = result.assets[0].uri;
  const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const backup: BackupData = JSON.parse(raw);

  if (!backup.version || !Array.isArray(backup.transactions)) {
    throw new Error('Invalid backup file format.');
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const tx of backup.transactions) {
    try {
      await insertTransaction({
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        amount_in_base_currency: tx.amount_in_base_currency,
        category: tx.category,
        merchant: tx.merchant,
        notes: tx.notes,
        date: tx.date,
        type: tx.type ?? 'expense',
        source_account_id: tx.source_account_id ?? null,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  for (const acct of (backup.savingsAccounts ?? [])) {
    try {
      await upsertSavingsAccount({
        id: acct.id,
        name: acct.name,
        institution: acct.institution,
        balance: acct.balance,
        currency: acct.currency,
        account_type: acct.account_type,
        notes: acct.notes,
        sort_order: acct.sort_order,
      });
      imported++;
    } catch { skipped++; }
  }

  for (const exp of (backup.regularExpenses ?? [])) {
    try {
      await upsertRegularExpense({
        id: exp.id,
        name: exp.name,
        category: exp.category,
        amount: exp.amount,
        currency: exp.currency,
        frequency: exp.frequency,
        due_day: exp.due_day,
        outstanding_balance: exp.outstanding_balance,
        notes: exp.notes,
        sort_order: exp.sort_order,
      });
      imported++;
    } catch { skipped++; }
  }

  for (const cat of (backup.customCategories ?? [])) {
    try {
      await upsertCustomCategory({
        id: cat.id,
        name: cat.name,
        keywords: cat.keywords,
        sort_order: cat.sort_order,
      });
      imported++;
    } catch { skipped++; }
  }

  return { imported, skipped, errors };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
