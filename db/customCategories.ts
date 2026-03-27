import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';

export interface CustomCategory {
  id: string;
  name: string;
  keywords: string[];
  sort_order: number;
  deleted_at: string | null;
}

interface RawCustomCategory {
  id: string;
  name: string;
  keywords: string;
  sort_order: number;
  deleted_at: string | null;
}

export async function getCustomCategories(): Promise<CustomCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawCustomCategory>(
    'SELECT * FROM custom_categories WHERE deleted_at IS NULL ORDER BY sort_order ASC'
  );
  return rows.map(r => ({
    ...r,
    keywords: JSON.parse(r.keywords) as string[],
  }));
}

export async function upsertCustomCategory(
  cat: Omit<CustomCategory, 'id' | 'deleted_at'> & { id?: string }
): Promise<CustomCategory> {
  const db = await getDatabase();
  const id = cat.id ?? Crypto.randomUUID();
  const keywordsJson = JSON.stringify(cat.keywords);

  await db.runAsync(
    `INSERT OR REPLACE INTO custom_categories (id, name, keywords, sort_order, deleted_at)
     VALUES (?, ?, ?, ?, NULL)`,
    [id, cat.name, keywordsJson, cat.sort_order]
  );

  return { id, name: cat.name, keywords: cat.keywords, sort_order: cat.sort_order, deleted_at: null };
}

export async function softDeleteCustomCategory(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE custom_categories SET deleted_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}

export async function updateCustomCategoriesOrder(ids: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.runAsync(
        'UPDATE custom_categories SET sort_order = ? WHERE id = ?',
        [i, ids[i]]
      );
    }
  });
}
