import Database from 'better-sqlite3';
import type { DbDriver } from '@/storage/db';
import { MIGRATION_001 } from '@/storage/migrations/001_initial';
import { MIGRATION_002 } from '@/storage/migrations/002_missions_generated_for';
import { createNodeSqliteDriver } from '@/storage/testHelpers';
import { getAllSettings, getSetting, setSetting } from '@/storage/repositories/settingsRepo';

describe('settingsRepo', () => {
  let raw: Database.Database;
  let driver: DbDriver;

  beforeEach(() => {
    raw = new Database(':memory:');
    raw.exec(MIGRATION_001);
    raw.exec(MIGRATION_002);
    driver = createNodeSqliteDriver(raw);
  });

  afterEach(() => {
    raw.close();
  });

  it('getSetting returns null on empty DB', async () => {
    expect(await getSetting(driver, 'onboarding_complete')).toBeNull();
  });

  it('setSetting then getSetting returns the value', async () => {
    await setSetting(driver, 'onboarding_complete', 'true');
    expect(await getSetting(driver, 'onboarding_complete')).toBe('true');
  });

  it('setSetting overwrites existing value (final wins)', async () => {
    await setSetting(driver, 'onboarding_complete', 'false');
    await setSetting(driver, 'onboarding_complete', 'true');
    expect(await getSetting(driver, 'onboarding_complete')).toBe('true');
  });

  it('getAllSettings returns {} on empty DB', async () => {
    expect(await getAllSettings(driver)).toEqual({});
  });

  it('getAllSettings returns all set keys', async () => {
    await setSetting(driver, 'onboarding_complete', 'true');
    await setSetting(driver, 'notifications_enabled', 'false');
    expect(await getAllSettings(driver)).toEqual({
      onboarding_complete: 'true',
      notifications_enabled: 'false',
    });
  });

  it('SettingKey union includes "last_decay_run_day"', async () => {
    // Compile-time verification: this call must typecheck. The key may be unset
    // at runtime, in which case getSetting returns null.
    expect(await getSetting(driver, 'last_decay_run_day')).toBeNull();

    await setSetting(driver, 'last_decay_run_day', '2026-05-08');
    expect(await getSetting(driver, 'last_decay_run_day')).toBe('2026-05-08');
  });
});
