import Database from 'better-sqlite3';
import { applyMigrations } from './migrationRunner';
import type { Migration } from './migrations';
import { createNodeSqliteDriver } from './testHelpers';

describe('applyMigrations', () => {
  let raw: Database.Database;
  let driver: ReturnType<typeof createNodeSqliteDriver>;

  beforeEach(() => {
    raw = new Database(':memory:');
    driver = createNodeSqliteDriver(raw);
  });

  afterEach(() => {
    raw.close();
  });

  it('creates schema_version table when missing and applies all migrations', async () => {
    const migrations: Migration[] = [
      { version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version',
    );
    expect(versions.map((r) => r.version)).toEqual([1]);

    const tables = await driver.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='foo'",
    );
    expect(tables).toHaveLength(1);
  });

  it('skips already-applied migrations on re-run (idempotent)', async () => {
    const migrations: Migration[] = [
      { version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);
    await applyMigrations(driver, migrations);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    );
    expect(versions.map((r) => r.version)).toEqual([1]);
  });

  it('applies only newer migrations on partial state', async () => {
    const v1Only: Migration[] = [{ version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' }];
    await applyMigrations(driver, v1Only);

    const v1AndV2: Migration[] = [
      ...v1Only,
      { version: 2, sql: 'CREATE TABLE bar (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, v1AndV2);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    );
    expect(versions.map((r) => r.version)).toEqual([1, 2]);

    const bar = await driver.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='bar'",
    );
    expect(bar).toHaveLength(1);
  });

  it('applies migrations in numeric order even when input is shuffled', async () => {
    const migrations: Migration[] = [
      { version: 3, sql: 'CREATE TABLE c (id INTEGER PRIMARY KEY);' },
      { version: 1, sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY);' },
      { version: 2, sql: 'CREATE TABLE b (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);

    const versions = await driver.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    );
    expect(versions.map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it('records applied_at as an ISO timestamp', async () => {
    const migrations: Migration[] = [
      { version: 1, sql: 'CREATE TABLE foo (id INTEGER PRIMARY KEY);' },
    ];
    await applyMigrations(driver, migrations);

    const row = await driver.getFirstAsync<{ applied_at: string }>(
      'SELECT applied_at FROM schema_version WHERE version = 1',
    );
    expect(row).not.toBeNull();
    // ISO 8601: 2026-05-07T12:34:56.789Z
    expect(row?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('applies the production 001_initial migration end-to-end', async () => {
    const { MIGRATIONS } = await import('./migrations/index');
    await applyMigrations(driver, [...MIGRATIONS]);

    const tables = await driver.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.map((t) => t.name).filter((n) => !n.startsWith('sqlite_'));
    expect(names).toEqual(
      [
        'attribute_state',
        'character',
        'daily_xp_earned',
        'log_attribute_xp',
        'logs',
        'missions',
        'schema_version',
        'settings',
        'streak',
      ].sort(),
    );
  });
});
