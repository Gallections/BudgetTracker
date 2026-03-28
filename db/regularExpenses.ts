import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface RegularExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  frequency: string;
  due_day: number | null;
  outstanding_balance: number | null;
  notes: string | null;
  sort_order: number;
  deleted_at: string | null;
  start_date: string | null;
  last_posted_at: string | null;
}

export type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
export const FREQUENCIES: Frequency[] = ['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

export const FREQUENCY_MONTHLY_MULTIPLIER: Record<Frequency, number> = {
  once: 0,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annually: 1 / 12,
};

export async function getRegularExpenses(): Promise<RegularExpense[]> {
  const db = await getDatabase();
  return db.getAllAsync<RegularExpense>(
    'SELECT * FROM regular_expenses WHERE deleted_at IS NULL ORDER BY sort_order ASC'
  );
}

export async function upsertRegularExpense(
  expense: Omit<RegularExpense, 'id' | 'deleted_at' | 'start_date' | 'last_posted_at'> & { id?: string; start_date?: string | null }
): Promise<RegularExpense> {
  const db = await getDatabase();
  const isNew = !expense.id;
  const id = expense.id ?? Crypto.randomUUID();
  const start_date = expense.start_date ?? (isNew ? new Date().toISOString().split('T')[0] : null);

  await db.runAsync(
    `INSERT INTO regular_expenses (id, name, category, amount, currency, frequency, due_day, outstanding_balance, notes, sort_order, deleted_at, start_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       amount = excluded.amount,
       currency = excluded.currency,
       frequency = excluded.frequency,
       due_day = excluded.due_day,
       outstanding_balance = excluded.outstanding_balance,
       notes = excluded.notes,
       sort_order = excluded.sort_order`,
    [
      id, expense.name, expense.category, expense.amount, expense.currency,
      expense.frequency, expense.due_day ?? null, expense.outstanding_balance ?? null,
      expense.notes ?? null, expense.sort_order, start_date,
    ]
  );

  return { ...expense, id, deleted_at: null, start_date: start_date ?? null, last_posted_at: null };
}

export async function softDeleteRegularExpense(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE regular_expenses SET deleted_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}

export async function markExpensePosted(id: string): Promise<void> {
  const db = await getDatabase();
  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  await db.runAsync(
    'UPDATE regular_expenses SET last_posted_at = ? WHERE id = ?',
    [month, id]
  );
}

export async function updateExpensesOrder(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE regular_expenses SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
    }
  });
}
