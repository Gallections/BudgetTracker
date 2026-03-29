import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;       // YYYY-MM-DD
  linked_account_id: string | null;
  notes: string | null;
  sort_order: number;
  deleted_at: string | null;
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const db = await getDatabase();
  return db.getAllAsync<SavingsGoal>(
    'SELECT * FROM savings_goals WHERE deleted_at IS NULL ORDER BY sort_order ASC'
  );
}

export async function upsertSavingsGoal(
  goal: Omit<SavingsGoal, 'id' | 'deleted_at'> & { id?: string }
): Promise<SavingsGoal> {
  const db = await getDatabase();
  const id = goal.id ?? Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO savings_goals (id, name, target_amount, target_date, linked_account_id, notes, sort_order, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       target_amount = excluded.target_amount,
       target_date = excluded.target_date,
       linked_account_id = excluded.linked_account_id,
       notes = excluded.notes,
       sort_order = excluded.sort_order`,
    [
      id, goal.name, goal.target_amount, goal.target_date ?? null,
      goal.linked_account_id ?? null, goal.notes ?? null, goal.sort_order,
    ]
  );

  return { ...goal, id, deleted_at: null };
}

export async function softDeleteSavingsGoal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE savings_goals SET deleted_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}
