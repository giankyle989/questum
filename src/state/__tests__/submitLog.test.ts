import Database from 'better-sqlite3';
import type { AIService, ClassifyLogInput, LogResult } from '@/ai/AIService';
import { MockAIService } from '@/ai/MockAIService';
import type { Attribute } from '@/game/constants';
import type { DbDriver } from '@/storage/db';
import { MIGRATION_001 } from '@/storage/migrations/001_initial';
import { MIGRATION_002 } from '@/storage/migrations/002_missions_generated_for';
import * as characterRepo from '@/storage/repositories/characterRepo';
import * as logRepo from '@/storage/repositories/logRepo';
import * as missionRepo from '@/storage/repositories/missionRepo';
import { type Mission } from '@/storage/repositories/missionRepo';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import { createNodeSqliteDriver } from '@/storage/testHelpers';
import { missionRowToInstance, submitLog } from '@/state/submitLog';

const TODAY = '2026-05-08';

function freshDriver(): { raw: Database.Database; driver: DbDriver } {
  const raw = new Database(':memory:');
  raw.exec(MIGRATION_001);
  raw.exec(MIGRATION_002);
  return { raw, driver: createNodeSqliteDriver(raw) };
}

describe('submitLog', () => {
  let raw: Database.Database;
  let driver: DbDriver;
  let aiService: MockAIService;

  beforeEach(() => {
    const fresh = freshDriver();
    raw = fresh.raw;
    driver = fresh.driver;
    aiService = new MockAIService();
  });

  afterEach(() => {
    raw.close();
  });

  it('happy path: writes log, updates attribute_state, sets streak.current_length=1', async () => {
    const result = await submitLog('ran 5km', { aiService, db: driver, today: TODAY });

    expect(result.ok).toBe(true);

    const logs = await logRepo.getRecentLogs(driver, 10, 0);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.text).toBe('ran 5km');
    expect(logs[0]!.aiSource).toBe('mock');

    const attrStates = await characterRepo.getAttributeStates(driver);
    const con = attrStates.find((a) => a.attribute === 'CON');
    expect(con).toBeDefined();
    expect(con!.inProgressXp).toBeGreaterThan(0);

    const streak = await characterRepo.getStreak(driver);
    expect(streak.currentLength).toBe(1);
  });

  it('low-confidence input returns { ok: false, reason: "low-confidence" } and writes nothing', async () => {
    const result = await submitLog('xyz abc', { aiService, db: driver, today: TODAY });

    expect(result).toEqual({ ok: false, reason: 'low-confidence' });

    const logs = await logRepo.getRecentLogs(driver, 10, 0);
    expect(logs).toHaveLength(0);
  });

  it('invalid-primary returns { ok: false, reason: "invalid-primary" }', async () => {
    const stub: jest.Mock<Promise<LogResult>, [ClassifyLogInput, AbortSignal | undefined]> = jest
      .fn<Promise<LogResult>, [ClassifyLogInput, AbortSignal | undefined]>()
      .mockResolvedValue({
        summary: 'test log',
        primaryAttribute: 'INVALID' as Attribute,
        attributeXP: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
        totalXP: 0,
        matchedMissions: [],
        confidence: 0.9,
        improvementDetected: false,
      });
    const stubService: AIService = {
      sourceId: 'mock',
      displayName: 'Stub',
      isAvailable: async () => true,
      classifyLog: stub as unknown as AIService['classifyLog'],
    };

    const result = await submitLog('test log', {
      aiService: stubService,
      db: driver,
      today: TODAY,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid-primary' });

    const logs = await logRepo.getRecentLogs(driver, 10, 0);
    expect(logs).toHaveLength(0);
  });

  it('returns { ok: false, reason: "aborted" } when signal already aborted before AI call', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await submitLog('ran 5km', {
      aiService,
      db: driver,
      today: TODAY,
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: false, reason: 'aborted' });

    const logs = await logRepo.getRecentLogs(driver, 10, 0);
    expect(logs).toHaveLength(0);
  });

  it('matches an active mission and marks it completed', async () => {
    const mission: Mission = {
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
      generatedFor: TODAY,
      expiresAt: '2026-05-09T00:00:00Z',
      completedAt: null,
    };
    await missionRepo.insertMissions(driver, [mission]);

    // MockAIService.matchMissions requires >=2 overlapping content words (>=4 chars)
    // between the log text and the mission description. Tokens >=4 chars in
    // "Move your body for 20 minutes" are: move, your, body, minutes. The phrase
    // below shares "move" and "body" (exact matches; tokenizer does not stem).
    const result = await submitLog('did a 20 minutes cardio run to move my body', {
      aiService,
      db: driver,
      today: TODAY,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.missionCompletions.length).toBeGreaterThan(0);
      expect(result.missionCompletions).toContain(mission.id);
    }

    const completed = await missionRepo.getRecentlyCompleted(driver, TODAY);
    expect(completed.find((m) => m.id === mission.id)?.status).toBe('completed');
  });

  it('respects the daily XP cap: CON stays at 200 when already capped', async () => {
    // Pre-seed daily_xp_earned to the cap (200) for CON.
    await driver.runAsync(
      'INSERT INTO daily_xp_earned (day, attribute, xp_earned) VALUES (?, ?, ?)',
      [TODAY, 'CON', 200],
    );

    const result = await submitLog('ran 5km', { aiService, db: driver, today: TODAY });
    expect(result.ok).toBe(true);

    const earned = await logRepo.getDailyXpEarned(driver, TODAY);
    expect(earned.CON).toBe(200);
  });

  it('streak is 1 after two submits on the same day', async () => {
    const r1 = await submitLog('ran 5km', { aiService, db: driver, today: TODAY });
    expect(r1.ok).toBe(true);
    const r2 = await submitLog('went for a long run', { aiService, db: driver, today: TODAY });
    expect(r2.ok).toBe(true);

    const streak = await characterRepo.getStreak(driver);
    expect(streak.currentLength).toBe(1);
  });

  it('reports a level-up when CON crosses the level-2 threshold', async () => {
    // level 1 → level 2 threshold is 100 XP. Seed 95 so any CON gain crosses.
    await driver.runAsync(
      'INSERT OR REPLACE INTO attribute_state (attribute, level, in_progress_xp) VALUES (?, ?, ?)',
      ['CON', 1, 95],
    );

    const result = await submitLog('ran 5km', { aiService, db: driver, today: TODAY });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.levelUps.some((lu) => lu.attribute === 'CON')).toBe(true);
    }
  });

  it('writes ai_source_last_used = sourceId after a successful submit', async () => {
    const result = await submitLog('ran 5km', { aiService, db: driver, today: TODAY });
    expect(result.ok).toBe(true);

    const value = await settingsRepo.getSetting(driver, 'ai_source_last_used');
    expect(value).toBe('mock');
  });

  it('first-ever log: lastLogDay is null → streak.current_length = 1', async () => {
    // Fresh DB; no logs at all. submit should pass null through to engine.
    const lastBefore = await logRepo.getLastLogDay(driver);
    expect(lastBefore).toBeNull();

    const result = await submitLog('ran 5km', { aiService, db: driver, today: TODAY });
    expect(result.ok).toBe(true);

    const streak = await characterRepo.getStreak(driver);
    expect(streak.currentLength).toBe(1);
  });

  it('missionRowToInstance maps bonusXp → bonusXP and passes other fields through', () => {
    const row: Mission = {
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

    const instance = missionRowToInstance(row);

    expect(instance).toEqual({
      id: 'daily_con_cardio_2026-05-08',
      templateId: 'daily_con_cardio',
      description: 'Move your body for 20 minutes',
      attribute: 'CON',
      type: 'daily',
      bonusXP: 50,
      generatedFor: '2026-05-08',
    });
    expect(instance.bonusXP).toBe(row.bonusXp);
  });

  it('returns { ok: false, reason: "storage-error" } when the transaction throws', async () => {
    const wrapped: DbDriver = {
      ...driver,
      withTransactionAsync: async () => {
        throw new Error('synthetic transaction failure');
      },
    };

    const result = await submitLog('ran 5km', { aiService, db: wrapped, today: TODAY });

    expect(result).toEqual({ ok: false, reason: 'storage-error' });
  });
});
