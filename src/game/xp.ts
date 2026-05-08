import type { Attribute } from '@/game/constants';

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
