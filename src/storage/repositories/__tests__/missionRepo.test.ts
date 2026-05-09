import Database from 'better-sqlite3';
import type { DbDriver } from '@/storage/db';
import { MIGRATION_001 } from '@/storage/migrations/001_initial';
import { MIGRATION_002 } from '@/storage/migrations/002_missions_generated_for';
import { createNodeSqliteDriver } from '@/storage/testHelpers';
import {
  getActiveDailyMissions,
  getActiveWeeklyMissions,
  getRecentlyCompleted,
  insertMissions,
  markCompleted,
  type Mission,
} from '@/storage/repositories/missionRepo';

const dailyFixture: Mission = {
  id: 'daily_con_cardio_2026-05-08',
  templateId: 'daily_con_cardio',
  description: 'Move your body for 20 minutes',
  attribute: 'CON',
  type: 'daily',
  bonusXp: 50,
  progress: 0,
  target: 1,
  status: 'active',
  generatedAt: '2026-05-08T00:00:00Z',
  generatedFor: '2026-05-08',
  expiresAt: '2026-05-09T00:00:00Z',
  completedAt: null,
};

const weeklyFixture: Mission = {
  id: 'weekly_str_lift_2026-04-27',
  templateId: 'weekly_str_lift',
  description: 'Strength train 3 times this week',
  attribute: 'STR',
  type: 'weekly',
  bonusXp: 200,
  progress: 0,
  target: 3,
  status: 'active',
  generatedAt: '2026-04-27T00:00:00Z',
  generatedFor: '2026-04-27',
  expiresAt: '2026-05-04T00:00:00Z',
  completedAt: null,
};

describe('missionRepo', () => {
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

  it('getActiveDailyMissions returns [] on empty DB', async () => {
    expect(await getActiveDailyMissions(driver, '2026-05-08')).toEqual([]);
  });

  it('getActiveWeeklyMissions returns [] on empty DB', async () => {
    expect(await getActiveWeeklyMissions(driver, '2026-04-27')).toEqual([]);
  });

  it('insertMissions then getActiveDailyMissions returns the mission', async () => {
    await insertMissions(driver, [dailyFixture]);
    const active = await getActiveDailyMissions(driver, '2026-05-08');
    expect(active).toHaveLength(1);
    expect(active[0]!).toMatchObject({
      id: 'daily_con_cardio_2026-05-08',
      templateId: 'daily_con_cardio',
      description: 'Move your body for 20 minutes',
      attribute: 'CON',
      type: 'daily',
      bonusXp: 50,
      progress: 0,
      target: 1,
      status: 'active',
      generatedAt: '2026-05-08T00:00:00Z',
      generatedFor: '2026-05-08',
      completedAt: null,
    });
    // expires_at populated on insert (daily → +1 day at midnight Z).
    expect(active[0]!.expiresAt).toBe('2026-05-09T00:00:00Z');
  });

  it('getActiveDailyMissions returns [] for a different day', async () => {
    await insertMissions(driver, [dailyFixture]);
    expect(await getActiveDailyMissions(driver, '2026-05-09')).toEqual([]);
  });

  it('insertMissions is idempotent (INSERT OR IGNORE)', async () => {
    await insertMissions(driver, [dailyFixture]);
    await insertMissions(driver, [dailyFixture]);
    const active = await getActiveDailyMissions(driver, '2026-05-08');
    expect(active).toHaveLength(1);
  });

  it('getActiveWeeklyMissions returns weekly mission for matching mondayOfWeek', async () => {
    await insertMissions(driver, [weeklyFixture]);
    const active = await getActiveWeeklyMissions(driver, '2026-04-27');
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe('weekly_str_lift_2026-04-27');
    // weekly → generatedFor +7 days.
    expect(active[0]!.expiresAt).toBe('2026-05-04T00:00:00Z');
  });

  it('weekly missions are not returned by getActiveDailyMissions', async () => {
    await insertMissions(driver, [weeklyFixture]);
    expect(await getActiveDailyMissions(driver, '2026-04-27')).toEqual([]);
  });

  it('markCompleted sets status and completedAt; mission no longer in active list', async () => {
    await insertMissions(driver, [dailyFixture]);
    await markCompleted(driver, dailyFixture.id, '2026-05-08T10:00:00Z');

    expect(await getActiveDailyMissions(driver, '2026-05-08')).toEqual([]);

    const completed = await getRecentlyCompleted(driver, '2026-05-01');
    expect(completed).toHaveLength(1);
    expect(completed[0]!.status).toBe('completed');
    expect(completed[0]!.completedAt).toBe('2026-05-08T10:00:00Z');
  });

  it('getRecentlyCompleted filters by completedAt >= sinceDay', async () => {
    await insertMissions(driver, [
      dailyFixture,
      { ...dailyFixture, id: 'daily_old', generatedFor: '2026-04-15' },
    ]);
    await markCompleted(driver, dailyFixture.id, '2026-05-08T10:00:00Z');
    await markCompleted(driver, 'daily_old', '2026-04-15T10:00:00Z');

    const recent = await getRecentlyCompleted(driver, '2026-05-01');
    expect(recent.map((m) => m.id)).toEqual(['daily_con_cardio_2026-05-08']);
  });

  it('getRecentlyCompleted orders by completedAt DESC', async () => {
    await insertMissions(driver, [dailyFixture, { ...dailyFixture, id: 'daily_other' }]);
    await markCompleted(driver, 'daily_other', '2026-05-08T08:00:00Z');
    await markCompleted(driver, dailyFixture.id, '2026-05-08T12:00:00Z');

    const recent = await getRecentlyCompleted(driver, '2026-05-01');
    expect(recent.map((m) => m.id)).toEqual(['daily_con_cardio_2026-05-08', 'daily_other']);
  });
});
