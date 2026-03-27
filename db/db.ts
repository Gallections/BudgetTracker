import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'pocketledger.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Migration v2: add type column to transactions (nullable — NOT NULL DEFAULT fails on SQLite < 3.37.0)
  try {
    await database.execAsync(
      `ALTER TABLE transactions ADD COLUMN type TEXT DEFAULT 'expense'`
    );
  } catch {
    // Column already exists — idempotent
  }
  // Backfill any rows inserted before migration ran (NULL → 'expense')
  try {
    await database.execAsync(
      `UPDATE transactions SET type = 'expense' WHERE type IS NULL`
    );
  } catch {
    // Best-effort backfill
  }

  // Migration v3: add start_date column to regular_expenses
  try {
    await database.execAsync(
      `ALTER TABLE regular_expenses ADD COLUMN start_date TEXT`
    );
  } catch {
    // Column already exists — idempotent
  }
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      amount_in_base_currency REAL NOT NULL,
      category TEXT NOT NULL,
      merchant TEXT NOT NULL,
      notes TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      type TEXT NOT NULL DEFAULT 'expense'
    );

    CREATE TABLE IF NOT EXISTS savings_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      institution TEXT,
      balance REAL NOT NULL,
      currency TEXT NOT NULL,
      account_type TEXT NOT NULL,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS regular_expenses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      frequency TEXT NOT NULL,
      due_day INTEGER,
      outstanding_balance REAL,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      start_date TEXT
    );

    CREATE TABLE IF NOT EXISTS exchange_rate_cache (
      base_currency TEXT NOT NULL,
      target_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (base_currency, target_currency)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO user_settings (key, value) VALUES ('base_currency', 'CAD');
    INSERT OR IGNORE INTO user_settings (key, value) VALUES ('monthly_budget', '2000');
  `);

  await runMigrations(database);
}
