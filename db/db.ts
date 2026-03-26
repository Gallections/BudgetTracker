import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'pocketledger.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return db;
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
      deleted_at TEXT
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
      deleted_at TEXT
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
}
