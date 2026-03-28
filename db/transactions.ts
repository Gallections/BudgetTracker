import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  amount_in_base_currency: number;
  category: string;
  merchant: string;
  notes: string | null;
  date: string;
  created_at: string;
  deleted_at: string | null;
  type: 'income' | 'expense';
}

export async function insertTransaction(
  tx: Omit<Transaction, 'id' | 'created_at' | 'deleted_at'> & { id?: string }
): Promise<Transaction> {
  const db = await getDatabase();
  const id = tx.id ?? Crypto.randomUUID();
  const created_at = new Date().toISOString();
  const type = tx.type ?? 'expense';

  await db.runAsync(
    `INSERT INTO transactions (id, amount, currency, amount_in_base_currency, category, merchant, notes, date, created_at, deleted_at, type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, tx.amount, tx.currency, tx.amount_in_base_currency, tx.category, tx.merchant, tx.notes ?? null, tx.date, created_at, type]
  );

  return { ...tx, id, created_at, deleted_at: null, type };
}

export async function getTransactions(options?: {
  limit?: number;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: 'income' | 'expense';
  search?: string;
}): Promise<Transaction[]> {
  const db = await getDatabase();
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (options?.type === 'expense') {
    conditions.push("(type = 'expense' OR type IS NULL)");
  } else if (options?.type === 'income') {
    conditions.push("type = 'income'");
  }
  if (options?.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }
  if (options?.dateFrom) {
    conditions.push('date >= ?');
    params.push(options.dateFrom);
  }
  if (options?.dateTo) {
    conditions.push('date <= ?');
    params.push(options.dateTo);
  }
  if (options?.search) {
    const s = `%${options.search}%`;
    conditions.push('(merchant LIKE ? OR notes LIKE ?)');
    params.push(s, s);
  }

  const where = conditions.join(' AND ');
  const limit = options?.limit ? ` LIMIT ${options.limit}` : '';
  const sql = `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC, created_at DESC${limit}`;

  return db.getAllAsync<Transaction>(sql, params);
}

export async function getMonthlySpendTrend(months = 6): Promise<{ month: string; amount: number }[]> {
  const db = await getDatabase();
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
  const y = startDate.getFullYear();
  const m = String(startDate.getMonth() + 1).padStart(2, '0');
  const dateFrom = `${y}-${m}-01`;

  return db.getAllAsync<{ month: string; amount: number }>(
    `SELECT strftime('%Y-%m', date) as month, SUM(amount) as amount
     FROM transactions
     WHERE deleted_at IS NULL
       AND (type = 'expense' OR type IS NULL)
       AND date >= ?
     GROUP BY month
     ORDER BY month ASC`,
    [dateFrom]
  );
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE transactions SET deleted_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}

export async function updateTransaction(
  tx: Omit<Transaction, 'created_at' | 'deleted_at'>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE transactions SET
       amount = ?, currency = ?, amount_in_base_currency = ?,
       category = ?, merchant = ?, notes = ?, date = ?, type = ?
     WHERE id = ?`,
    [tx.amount, tx.currency, tx.amount_in_base_currency, tx.category, tx.merchant, tx.notes ?? null, tx.date, tx.type, tx.id]
  );
}
