import type { AIService, ClassifyLogInput } from '@/ai/AIService';
import type { ISODate } from '@/game/calendar';
import { ATTRIBUTES, type Attribute } from '@/game/constants';
import {
  applyMissionBonus,
  mondayOf,
  validateMatchedMissions,
  type MissionInstance,
} from '@/game/missions';
import { getStreakMultiplier, updatePersistedStreak } from '@/game/streak';
import { validateLogResult } from '@/game/validation';
import { applyLogXP, applyXPMultipliers, type AttributeStateLike, type LevelUp } from '@/game/xp';
import * as characterRepo from '@/storage/repositories/characterRepo';
import * as logRepo from '@/storage/repositories/logRepo';
import * as missionRepo from '@/storage/repositories/missionRepo';
import { type Mission } from '@/storage/repositories/missionRepo';
import * as settingsRepo from '@/storage/repositories/settingsRepo';
import type { DbDriver } from '@/storage/db';

export interface SubmitLogDeps {
  aiService: AIService;
  db: DbDriver;
  today: ISODate;
  signal?: AbortSignal;
}

export type SubmitLogResult =
  | { ok: true; levelUps: LevelUp[]; missionCompletions: string[] }
  | {
      ok: false;
      reason: 'low-confidence' | 'invalid-primary' | 'aborted' | 'storage-error' | 'unknown';
    };

/**
 * Maps a `Mission` row from the storage layer to the engine's `MissionInstance`
 * shape. The only field that differs is the bonus XP key (`bonusXp` → `bonusXP`).
 */
export function missionRowToInstance(m: Mission): MissionInstance {
  return {
    id: m.id,
    templateId: m.templateId,
    description: m.description,
    attribute: m.attribute,
    type: m.type,
    bonusXP: m.bonusXp,
    generatedFor: m.generatedFor,
  };
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'AbortError'
  );
}

function buildAttributeStates(
  rows: ReadonlyArray<{ attribute: Attribute; level: number; inProgressXp: number }>,
): Record<Attribute, AttributeStateLike> {
  const result = {} as Record<Attribute, AttributeStateLike>;
  for (const attr of ATTRIBUTES) {
    result[attr] = { level: 1, inProgressXp: 0 };
  }
  for (const row of rows) {
    result[row.attribute] = { level: row.level, inProgressXp: row.inProgressXp };
  }
  return result;
}

/**
 * Composition centerpiece for the log submission flow. Runs the AI classifier,
 * validates the result, walks the pure game-engine pipeline, and persists all
 * effects in a single transaction.
 *
 * Phase 5 swap point: replace `deps.aiService` with the Apple Foundation Models
 * implementation. No other code in this file changes.
 */
export async function submitLog(text: string, deps: SubmitLogDeps): Promise<SubmitLogResult> {
  // 1. Pre-AI abort check
  if (deps.signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }

  // 2. Fetch active missions split by type (parallel)
  const mondayOfToday = mondayOf(deps.today);
  const [activeDailies, activeWeeklies] = await Promise.all([
    missionRepo.getActiveDailyMissions(deps.db, deps.today),
    missionRepo.getActiveWeeklyMissions(deps.db, mondayOfToday),
  ]);
  const activeMissions = [...activeDailies, ...activeWeeklies];

  // 3. Independent reads in parallel: completed-today set, streak, last log day
  const [recentlyCompletedRows, streak, lastLogDay] = await Promise.all([
    missionRepo.getRecentlyCompleted(deps.db, deps.today),
    characterRepo.getStreak(deps.db),
    logRepo.getLastLogDay(deps.db),
  ]);
  const todayCompletedSet = new Set<string>(recentlyCompletedRows.map((m) => m.id));

  // 4. Build AI input
  const classifyInput: ClassifyLogInput = {
    text,
    activeMissions: activeMissions.map((m) => ({
      id: m.id,
      description: m.description,
      attribute: m.attribute,
    })),
    currentStreak: streak.currentLength,
  };

  // 5. Call AI service with abort handling
  let aiResult;
  try {
    aiResult = await deps.aiService.classifyLog(classifyInput, deps.signal);
  } catch (err) {
    if (isAbortError(err)) {
      return { ok: false, reason: 'aborted' };
    }
    return { ok: false, reason: 'unknown' };
  }

  // 6. Validate AI result
  const validation = validateLogResult(aiResult);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  const validated = validation.value;

  // 7. Load attribute states, default missing entries to {level:1, inProgressXp:0}
  const attributeStateRows = await characterRepo.getAttributeStates(deps.db);
  const attributeStates = buildAttributeStates(attributeStateRows);

  // 8. Today's already-earned XP (sparse partial)
  const alreadyEarnedToday = await logRepo.getDailyXpEarned(deps.db, deps.today);

  // 9. Streak multiplier
  const streakMultiplier = getStreakMultiplier(streak.currentLength);

  // 10. Compute requested gains via the canonical multiplier pipeline
  const requestedGains: Partial<Record<Attribute, number>> = {};
  for (const attr of ATTRIBUTES) {
    requestedGains[attr] = applyXPMultipliers(
      validated.attributeXP[attr] ?? 0,
      validated.improvementDetected,
      streakMultiplier,
    );
  }

  // 11. Apply XP through the engine
  const { newStates, actuallyApplied, levelUps } = applyLogXP({
    states: attributeStates,
    requestedGains,
    alreadyEarnedToday,
  });

  // 12. Validate matched missions against the active set + already-completed set
  const { completedIds, bonusByAttribute } = validateMatchedMissions({
    matchedIds: validated.matchedMissions,
    activeMissions: activeMissions.map(missionRowToInstance),
    completedIds: todayCompletedSet,
  });

  // 13. Apply mission bonuses (no daily cap)
  const { newStates: finalStates, levelUps: bonusLevelUps } = applyMissionBonus(
    newStates,
    bonusByAttribute,
  );

  // 14. Streak update — engine handles `lastLogDay === null` (first-ever log) internally
  const { newStreak, newLongestStreak } = updatePersistedStreak({
    currentStreak: streak.currentLength,
    currentLongestStreak: streak.longestLength,
    lastLogDay,
    today: deps.today,
    pauseWindows: [],
  });

  // 15. Persist everything inside a transaction
  try {
    const nowIso = new Date().toISOString();
    await deps.db.withTransactionAsync(async () => {
      await logRepo.insertLog(deps.db, {
        text,
        createdAt: nowIso,
        day: deps.today,
        aiSummary: validated.summary,
        primaryAttribute: validated.primaryAttribute,
        totalXp: validated.totalXP,
        confidence: validated.confidence,
        improvement: validated.improvementDetected,
        aiSource: deps.aiService.sourceId,
        attributeXp: validated.attributeXP,
      });
      await logRepo.incrementDailyXpEarned(deps.db, deps.today, actuallyApplied);
      await characterRepo.updateAttributeStates(
        deps.db,
        ATTRIBUTES.map((attr) => ({
          attribute: attr,
          // engine guarantees all six attributes are present in finalStates
          level: finalStates[attr]!.level,
          inProgressXp: finalStates[attr]!.inProgressXp,
        })),
      );
      await characterRepo.updateStreak(deps.db, {
        currentLength: newStreak,
        longestLength: newLongestStreak,
      });
      for (const id of completedIds) {
        await missionRepo.markCompleted(deps.db, id, nowIso);
      }
      await settingsRepo.setSetting(deps.db, 'ai_source_last_used', deps.aiService.sourceId);
    });
  } catch {
    return { ok: false, reason: 'storage-error' };
  }

  // 16. Return success
  return {
    ok: true,
    levelUps: [...levelUps, ...bonusLevelUps],
    missionCompletions: completedIds,
  };
}
