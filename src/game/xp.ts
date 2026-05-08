import { DAILY_ATTRIBUTE_XP_CAP, type Attribute } from '@/game/constants';

/**
 * XP needed to reach level `N` from level `N - 1`. `N` is the **target** level.
 * Per GAME_RULES §Level threshold formula: `xpToReachLevel(N) = 100 * (N - 1)` for N ≥ 2.
 * Examples: xpToReachLevel(2) === 100, xpToReachLevel(11) === 1000.
 */
export function xpToReachLevel(level: number): number {
  if (level < 2) {
    throw new Error(`xpToReachLevel: level must be >= 2 (got ${level})`);
  }
  return 100 * (level - 1);
}

/**
 * Cumulative XP from level 1 to level N. Equals 50 * N * (N - 1).
 */
export function totalXPForLevel(level: number): number {
  if (level < 1) {
    throw new Error(`totalXPForLevel: level must be >= 1 (got ${level})`);
  }
  return 50 * level * (level - 1);
}

/**
 * Character level = floor of the average of the six attribute levels.
 */
export function characterLevel(levels: Record<Attribute, number>): number {
  const sum = levels.STR + levels.DEX + levels.CON + levels.INT + levels.WIS + levels.CHA;
  return Math.floor(sum / 6);
}

/**
 * Multiplies XP by 1.25 when an improvement was detected on the log, otherwise
 * returns the input unchanged. Returns a float — rounding is the caller's job
 * (typically via `applyXPMultipliers`).
 */
export function applyImprovementBonus(xp: number, improvementDetected: boolean): number {
  if (!improvementDetected) return xp;
  return xp * 1.25;
}

/**
 * Multiplies XP by the streak multiplier. Returns a float — rounding is the
 * caller's job (typically via `applyXPMultipliers`).
 */
export function applyStreakMultiplier(xp: number, multiplier: number): number {
  return xp * multiplier;
}

/**
 * Canonical XP-multiplier pipeline: applies the improvement bonus and the
 * streak multiplier, then rounds to integer **once**. Callers building
 * `requestedGains` for `applyLogXP` should always go through this function so
 * the rounding strategy matches `GAME_RULES.md`.
 */
export function applyXPMultipliers(
  baseXP: number,
  improvementDetected: boolean,
  streakMultiplier: number,
): number {
  const afterImprovement = applyImprovementBonus(baseXP, improvementDetected);
  const afterStreak = applyStreakMultiplier(afterImprovement, streakMultiplier);
  return Math.round(afterStreak);
}

/**
 * Returns the amount of XP that can actually land on an attribute given today's
 * accumulated XP for that attribute. Excess is silently dropped per GAME_RULES.
 */
export function clampToDailyCap(requested: number, alreadyEarnedToday: number): number {
  const headroom = Math.max(0, DAILY_ATTRIBUTE_XP_CAP - alreadyEarnedToday);
  return Math.min(requested, headroom);
}
