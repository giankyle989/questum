import { ATTRIBUTES, DAILY_ATTRIBUTE_XP_CAP, type Attribute } from '@/game/constants';

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

/**
 * Subset of AttributeState that the XP gain function actually mutates. Kept
 * narrow so tests don't need to construct the full AttributeState
 * (which carries the attribute name).
 */
export interface AttributeStateLike {
  level: number;
  inProgressXp: number;
}

export interface ApplyXPGainResult {
  state: AttributeStateLike;
  /** Levels reached during this gain, in order (e.g. [2, 3] for a double). */
  levelUps: number[];
}

/**
 * Adds `gain` XP to a single attribute state, walking through any level
 * thresholds it crosses. Pure: returns a new state object.
 */
export function applyXPGain(state: AttributeStateLike, gain: number): ApplyXPGainResult {
  if (gain < 0) {
    throw new Error(`applyXPGain: gain must be non-negative (got ${gain})`);
  }
  let level = state.level;
  let inProgressXp = state.inProgressXp + gain;
  const levelUps: number[] = [];

  while (true) {
    const threshold = xpToReachLevel(level + 1);
    if (inProgressXp < threshold) break;
    inProgressXp -= threshold;
    level += 1;
    levelUps.push(level);
  }

  return { state: { level, inProgressXp }, levelUps };
}

export interface LevelUp {
  attribute: Attribute;
  newLevel: number;
}

export interface ApplyLogXPInput {
  states: Record<Attribute, AttributeStateLike>;
  /**
   * Post-multiplier integer XP per attribute. Missing keys treated as 0.
   * Callers should produce these via `applyXPMultipliers` so the single-round
   * rounding strategy is preserved end-to-end.
   */
  requestedGains: Partial<Record<Attribute, number>>;
  /** Today's accumulated XP per attribute. Missing keys treated as 0. */
  alreadyEarnedToday: Partial<Record<Attribute, number>>;
}

export interface ApplyLogXPResult {
  newStates: Record<Attribute, AttributeStateLike>;
  /** Amount actually deposited per attribute after cap clamp. */
  actuallyApplied: Record<Attribute, number>;
  levelUps: LevelUp[];
}

export function applyLogXP(input: ApplyLogXPInput): ApplyLogXPResult {
  const newStates = {} as Record<Attribute, AttributeStateLike>;
  const actuallyApplied = {} as Record<Attribute, number>;
  const levelUps: LevelUp[] = [];

  for (const attribute of ATTRIBUTES) {
    const requested = input.requestedGains[attribute] ?? 0;
    const earned = input.alreadyEarnedToday[attribute] ?? 0;
    const toApply = clampToDailyCap(requested, earned);
    const before = input.states[attribute];
    const { state, levelUps: gained } = applyXPGain(before, toApply);
    newStates[attribute] = state;
    actuallyApplied[attribute] = toApply;
    for (const newLevel of gained) {
      levelUps.push({ attribute, newLevel });
    }
  }

  return { newStates, actuallyApplied, levelUps };
}
