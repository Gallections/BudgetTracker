import { getDatabase } from './db';

export async function getUserSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setUserSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getBaseCurrency(): Promise<string> {
  return (await getUserSetting('base_currency')) ?? 'CAD';
}

export async function setBaseCurrency(currency: string): Promise<void> {
  return setUserSetting('base_currency', currency);
}

export async function getBudgets(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM user_settings WHERE key LIKE 'budget_%'"
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    const category = row.key.replace('budget_', '');
    const amount = parseFloat(row.value);
    if (!isNaN(amount)) result[category] = amount;
  }
  return result;
}

export async function setBudget(category: string, amount: number): Promise<void> {
  return setUserSetting(`budget_${category}`, amount.toString());
}

export async function clearBudget(category: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', [`budget_${category}`]);
}

// ─── Theme preference ─────────────────────────────────────────────────────────

export async function getThemePreference(): Promise<'system' | 'light' | 'dark'> {
  const val = await getUserSetting('theme_preference');
  if (val === 'light' || val === 'dark' || val === 'system') return val;
  return 'system';
}

export async function setThemePreference(theme: 'system' | 'light' | 'dark'): Promise<void> {
  return setUserSetting('theme_preference', theme);
}

// ─── Merchant overrides ────────────────────────────────────────────────────────
// key pattern: merchant_override_{lowercased merchant} → category name

export async function getMerchantOverrides(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM user_settings WHERE key LIKE 'merchant_override_%'"
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    const merchant = row.key.replace('merchant_override_', '');
    result[merchant] = row.value;
  }
  return result;
}

export async function setMerchantOverride(merchant: string, category: string): Promise<void> {
  return setUserSetting(`merchant_override_${merchant.toLowerCase().trim()}`, category);
}

export async function clearMerchantOverride(merchant: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', [
    `merchant_override_${merchant.toLowerCase().trim()}`,
  ]);
}

// ─── Default spending account ──────────────────────────────────────────────────

export async function getDefaultAccountId(): Promise<string | null> {
  return getUserSetting('default_account_id');
}

export async function setDefaultAccountId(id: string | null): Promise<void> {
  if (id) {
    return setUserSetting('default_account_id', id);
  }
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', ['default_account_id']);
}
