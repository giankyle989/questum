import * as SQLite from 'expo-sqlite';

/**
 * Minimal driver interface used by the migration runner and repositories.
 * Production: backed by expo-sqlite. Tests: backed by better-sqlite3 (see testHelpers.ts).
 */
export interface DbDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

const DB_NAME = 'questum.db';

let cachedDriver: DbDriver | null = null;

/** Production driver — opens the on-device SQLite file lazily and caches the handle. */
export async function getDb(): Promise<DbDriver> {
  if (cachedDriver) return cachedDriver;

  const native = await SQLite.openDatabaseAsync(DB_NAME);

  cachedDriver = {
    execAsync: (sql) => native.execAsync(sql),
    runAsync: (sql, params = []) => native.runAsync(sql, params as SQLite.SQLiteBindValue[]),
    getFirstAsync: <T>(sql: string, params: ReadonlyArray<unknown> = []) =>
      native.getFirstAsync<T>(sql, params as SQLite.SQLiteBindValue[]),
    getAllAsync: <T>(sql: string, params: ReadonlyArray<unknown> = []) =>
      native.getAllAsync<T>(sql, params as SQLite.SQLiteBindValue[]),
    withTransactionAsync: (fn) => native.withTransactionAsync(fn),
  };

  return cachedDriver;
}

/** Test-only: reset the cached driver so tests start from a fresh state. */
export function _resetDbCacheForTesting(): void {
  cachedDriver = null;
}
