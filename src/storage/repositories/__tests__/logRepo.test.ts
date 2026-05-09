import Database from 'better-sqlite3';
import type { DbDriver } from '@/storage/db';
import { MIGRATION_001 } from '@/storage/migrations/001_initial';
import { MIGRATION_002 } from '@/storage/migrations/002_missions_generated_for';
import { createNodeSqliteDriver } from '@/storage/testHelpers';
import {
  getDailyXpEarned,
  getLastLogDay,
  getRecentLogs,
  incrementDailyXpEarned,
  insertLog,
  pruneDailyXpOlderThanDays,
  type LogInsert,
} from '@/storage/repositories/logRepo';

const baseFixture: LogInsert = {
  text: 'went for a run',
  createdAt: '2026-05-08T07:00:00.000Z',
  day: '2026-05-08',
  aiSummary: 'Morning run',
  primaryAttribute: 'CON',
  totalXp: 25,
  confidence: 0.8,
  improvement: false,
  aiSource: 'mock',
  attributeXp: { CON: 25 },
};

describe('logRepo', () => {
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

  describe('logs', () => {
    it('getLastLogDay returns null on empty DB', async () => {
      expect(await getLastLogDay(driver)).toBeNull();
    });

    it('insertLog assigns id and returns LogEntry with all fields', async () => {
      const entry = await insertLog(driver, baseFixture);
      expect(entry.id).toBeGreaterThan(0);
      expect(entry).toMatchObject({
        text: 'went for a run',
        createdAt: '2026-05-08T07:00:00.000Z',
        day: '2026-05-08',
        aiSummary: 'Morning run',
        primaryAttribute: 'CON',
        totalXp: 25,
        confidence: 0.8,
        improvement: false,
        aiSource: 'mock',
        attributeXp: { CON: 25 },
      });
    });

    it('roundtrips improvement: true as boolean', async () => {
      await insertLog(driver, { ...baseFixture, improvement: true });
      const logs = await getRecentLogs(driver, 10, 0);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.improvement).toBe(true);
    });

    it('improvement defaults to false', async () => {
      await insertLog(driver, baseFixture);
      const logs = await getRecentLogs(driver, 10, 0);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.improvement).toBe(false);
    });

    it('getRecentLogs returns [] on empty DB', async () => {
      expect(await getRecentLogs(driver, 10, 0)).toEqual([]);
    });

    it('getRecentLogs returns most-recent-first after multiple inserts', async () => {
      await insertLog(driver, {
        ...baseFixture,
        text: 'first',
        createdAt: '2026-05-08T07:00:00.000Z',
      });
      await insertLog(driver, {
        ...baseFixture,
        text: 'second',
        createdAt: '2026-05-08T08:00:00.000Z',
      });
      await insertLog(driver, {
        ...baseFixture,
        text: 'third',
        createdAt: '2026-05-08T09:00:00.000Z',
      });

      const logs = await getRecentLogs(driver, 10, 0);
      expect(logs.map((l) => l.text)).toEqual(['third', 'second', 'first']);
    });

    it('getLastLogDay returns the most recent day across multiple inserts', async () => {
      await insertLog(driver, {
        ...baseFixture,
        day: '2026-05-07',
        createdAt: '2026-05-07T08:00:00.000Z',
      });
      await insertLog(driver, {
        ...baseFixture,
        day: '2026-05-08',
        createdAt: '2026-05-08T08:00:00.000Z',
      });
      expect(await getLastLogDay(driver)).toBe('2026-05-08');
    });

    it('attributeXp on returned LogEntry includes only attributes with xp > 0 (sparse)', async () => {
      const entry = await insertLog(driver, {
        ...baseFixture,
        attributeXp: { CON: 25, STR: 0, DEX: 5 },
      });
      expect(entry.attributeXp).toEqual({ CON: 25, DEX: 5 });
      expect(entry.attributeXp).not.toHaveProperty('STR');

      const logs = await getRecentLogs(driver, 10, 0);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.attributeXp).toEqual({ CON: 25, DEX: 5 });
    });
  });

  describe('daily_xp_earned', () => {
    it('getDailyXpEarned returns {} on empty DB', async () => {
      expect(await getDailyXpEarned(driver, '2026-05-08')).toEqual({});
    });

    it('incrementDailyXpEarned then getDailyXpEarned returns the inserted gains', async () => {
      await incrementDailyXpEarned(driver, '2026-05-08', { CON: 30, INT: 20 });
      expect(await getDailyXpEarned(driver, '2026-05-08')).toEqual({ CON: 30, INT: 20 });
    });

    it('incrementDailyXpEarned called twice accumulates', async () => {
      await incrementDailyXpEarned(driver, '2026-05-08', { CON: 30 });
      await incrementDailyXpEarned(driver, '2026-05-08', { CON: 20 });
      expect(await getDailyXpEarned(driver, '2026-05-08')).toEqual({ CON: 50 });
    });

    it('incrementDailyXpEarned isolates by day', async () => {
      await incrementDailyXpEarned(driver, '2026-05-08', { CON: 30 });
      await incrementDailyXpEarned(driver, '2026-05-09', { CON: 10 });
      expect(await getDailyXpEarned(driver, '2026-05-08')).toEqual({ CON: 30 });
      expect(await getDailyXpEarned(driver, '2026-05-09')).toEqual({ CON: 10 });
    });

    it('pruneDailyXpOlderThanDays removes ancient rows but leaves recent ones', async () => {
      // Insert a row with day=2000-01-01 (older than any reasonable retention window).
      await driver.runAsync(
        'INSERT INTO daily_xp_earned (day, attribute, xp_earned) VALUES (?, ?, ?)',
        ['2000-01-01', 'CON', 50],
      );
      // Insert a row with today's day so it survives pruning.
      const today = new Date().toISOString().slice(0, 10);
      await incrementDailyXpEarned(driver, today, { STR: 10 });

      await pruneDailyXpOlderThanDays(driver, 60);

      expect(await getDailyXpEarned(driver, '2000-01-01')).toEqual({});
      expect(await getDailyXpEarned(driver, today)).toEqual({ STR: 10 });
    });
  });
});
