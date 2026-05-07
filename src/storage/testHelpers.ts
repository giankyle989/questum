import type Database from 'better-sqlite3';
import type { DbDriver } from './db';

/**
 * Test-only adapter. better-sqlite3 is synchronous; we wrap each call in
 * Promise.resolve(...) to satisfy the async DbDriver interface.
 */
export function createNodeSqliteDriver(db: Database.Database): DbDriver {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params = []) {
      const info = db.prepare(sql).run(...(params as unknown[]));
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: info.changes,
      };
    },
    async getFirstAsync<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      const row = db.prepare(sql).get(...(params as unknown[]));
      return (row as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      return db.prepare(sql).all(...(params as unknown[])) as T[];
    },
    async withTransactionAsync(fn) {
      // better-sqlite3 transactions are synchronous; for tests we accept a
      // best-effort wrapper that just runs fn and lets exceptions propagate.
      await fn();
    },
  };
}
