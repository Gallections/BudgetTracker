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
}

export async function insertTransaction(
  tx: Omit<Transaction, 'id' | 'created_at' | 'deleted_at'>
): Promise<Transaction> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const created_at = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO transactions (id, amount, currency, amount_in_base_currency, category, merchant, notes, date, created_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, tx.amount, tx.currency, tx.amount_in_base_currency, tx.category, tx.merchant, tx.notes ?? null, tx.date, created_at]
  );

  return { ...tx, id, created_at, deleted_at: null };
}

export async function getTransactions(options?: {
  limit?: number;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Transaction[]> {
  const db = await getDatabase();
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

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

  const where = conditions.join(' AND ');
  const limit = options?.limit ? ` LIMIT ${options.limit}` : '';
  const sql = `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC, created_at DESC${limit}`;

  return db.getAllAsync<Transaction>(sql, params);
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
       category = ?, merchant = ?, notes = ?, date = ?
     WHERE id = ?`,
    [tx.amount, tx.currency, tx.amount_in_base_currency, tx.category, tx.merchant, tx.notes ?? null, tx.date, tx.id]
  );
}
