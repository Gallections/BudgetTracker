import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface SavingsAccount {
  id: string;
  name: string;
  institution: string | null;
  balance: number;
  currency: string;
  account_type: string;
  notes: string | null;
  sort_order: number;
  updated_at: string;
  deleted_at: string | null;
}

export type AccountType = 'Chequing' | 'Savings' | 'Investment' | 'Cash' | 'Crypto' | 'Other';
export const ACCOUNT_TYPES: AccountType[] = ['Chequing', 'Savings', 'Investment', 'Cash', 'Crypto', 'Other'];

export async function getSavingsAccounts(): Promise<SavingsAccount[]> {
  const db = await getDatabase();
  return db.getAllAsync<SavingsAccount>(
    'SELECT * FROM savings_accounts WHERE deleted_at IS NULL ORDER BY sort_order ASC, updated_at DESC'
  );
}

export async function upsertSavingsAccount(
  account: Omit<SavingsAccount, 'id' | 'updated_at' | 'deleted_at'> & { id?: string }
): Promise<SavingsAccount> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = account.id ?? Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO savings_accounts (id, name, institution, balance, currency, account_type, notes, sort_order, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       institution = excluded.institution,
       balance = excluded.balance,
       currency = excluded.currency,
       account_type = excluded.account_type,
       notes = excluded.notes,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
    [id, account.name, account.institution ?? null, account.balance, account.currency,
     account.account_type, account.notes ?? null, account.sort_order, now]
  );

  return { ...account, id, updated_at: now, deleted_at: null };
}

export async function softDeleteSavingsAccount(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE savings_accounts SET deleted_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}

export async function adjustAccountBalance(id: string, delta: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE savings_accounts SET balance = balance + ?, updated_at = ? WHERE id = ?',
    [delta, new Date().toISOString(), id]
  );
}

export async function updateSavingsOrder(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE savings_accounts SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
    }
  });
}
