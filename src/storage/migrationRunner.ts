import type { DbDriver } from './db';
import type { Migration } from './migrations';

export type { Migration };

const SCHEMA_VERSION_DDL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

/**
 * Apply any migrations whose version is not yet recorded in `schema_version`,
 * in ascending version order. Idempotent: re-running with the same input is a no-op.
 *
 * Each migration's SQL is executed via `execAsync`, so a single migration
 * SQL string may contain multiple statements separated by semicolons.
 */
export async function applyMigrations(
  driver: DbDriver,
  migrations: ReadonlyArray<Migration>,
): Promise<void> {
  await driver.execAsync(SCHEMA_VERSION_DDL);

  const applied = await driver.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_version',
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  for (const m of sorted) {
    if (appliedSet.has(m.version)) continue;

    await driver.execAsync(m.sql);
    await driver.runAsync('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      m.version,
      new Date().toISOString(),
    ]);
  }
}
